"""Local server for SignQuest: the game files, plus the Battle Arena.

Like `python -m http.server`, but tells the browser not to cache files, so a
normal refresh always picks up your latest changes. (Without this, a browser
can mix old and new game files, and then nothing works.)

    python serve.py          -> http://localhost:8000
    python serve.py 8080     -> http://localhost:8080

Other devices on the same Wi-Fi can join at the https:// address it prints,
to battle each other in the Arena. (Browsers only allow the camera on
localhost or https, so it also serves https on port + 443, with a
self-signed certificate made by openssl - the browser warns about it once;
click "Advanced" then "Continue".)

The Arena (everything under /api/) keeps who's online and where they are in
the plaza, parties, challenges, the ranked queue, and live matches, in memory. Only "I signed it, this fast"
ever comes here - the camera and sign reading stay on each player's device.

Accounts (log in and sign up, under /api/account/) are in accounts.py. Hidden
folders like .accounts and .cert are never served.

Raids (/api/raid/...): co-op battles against a zone's giant raid creature,
like Pokemon GO raids. Players who walk up to the same raid (same creature,
same tier) share one room: a short lobby, then a RAID_TIME_S battle where
everyone signs at once and every hit comes off one shared HP pool. The pool
is far too big for one player, so it takes a group. Each player's sign reading
stays on their device; only "I hit it for this much" comes here.

Skyhaven (/api/hub/...): the town in the sky where everyone walks around
together. /api/hub/state says where you are (and any emote you're showing)
and gets back everyone else there. Its Rift spawns a Rift raid boss now and
then (RIFT_BOSSES, on a clock everyone shares: RIFT_CYCLE_S, open for
RIFT_OPEN_S of it); /api/raid/rift says which one, and for how long.

A match is between two sides (one player each, or two parties of the same
size), in one of three game modes. A side is out when its HP runs out.
Ratings go up and down like chess (Elo), whatever the mode.
  duel   - Sign Duel: everyone gets the same letter (every third round, a
           short word); whoever signs it hits the other side, harder the
           faster they are, and the first one to sign gets a bonus.
  clash  - Creature Clash, the RPG mode: a turn-based battle like the ones
           in the zones. Each player brings their hero's spells and their
           buddies (sent in "loadout" when they say hello). Players take
           turns: on your turn you pick a move from your hero or a buddy,
           then sign the letter to use it. Every hero and buddy has its own
           HP: aim at one foe, or use a group move to hit them all (softer
           each). A knocked-out buddy can't use its moves, and a side loses
           when its heroes are down. Signing earns energy for bigger moves;
           moves with an element can be super effective (or weak) against
           the buddy they hit. Shield blocks the next move, Heal heals
           whoever is hurt most, and Stun makes the other side skip a turn.
  riddle - Riddle Rush: you get a clue about the handshape instead of the
           letter. Work out which letter it is and sign it; a wrong guess
           costs you a little HP.
"""

import json
import os
import random
import re
import shutil
import socket
import ssl
import subprocess
import sys
import threading
import time
import uuid
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit

import accounts

ONLINE_S = 10  # seen this recently = online
GONE_S = 25  # a player gone this long leaves their match (and loses)
PARTY_MAX = 3
SIDE_HP = 100  # per player on the side
COUNTDOWN_S = 3  # before each round
LETTER_S = 10  # time to sign a letter
WORD_S = 20  # ...or a word
BETWEEN_S = 3  # to see who hit whom
HIT = 12  # damage for signing it at all
SPEED_HIT = 10  # up to this much more for signing it fast
FIRST_HIT = 6  # bonus for the first one to sign
WORD_TIMES = 2  # a word hits this many times as hard
ELO_K = 32
MODES = {"duel": "Sign Duel", "clash": "Creature Clash", "riddle": "Riddle Rush"}

# Creature Clash (the RPG mode): turn-based.
CLASH_HIT = 8  # a power-1 move, signed slowly
CLASH_SPEED = 0.5  # up to 50% more for signing fast
CLASH_TURN_S = 15  # to sign a letter on your turn
CLASH_WORD_S = 25  # ...or a word
CLASH_AFTER_S = 2.5  # to watch the move land before the next turn
CLASH_COUNTDOWN_S = 2
FAST_LETTER_S = 4  # per letter, to earn a bonus energy
HEAL_PART = 0.3  # a heal restores this much of a fighter's HP
CLASH_GROUP = 0.6  # a group move hits everyone, this much as hard each (GROUP_POWER in config.js)
CLASH_BUDDY_HP = 40  # a buddy's HP, plus 2 a level (a hero has SIDE_HP)
ENERGY_START = 2
ENERGY_MAX = 10
SHIELD_MAX = 2
MOVE_TYPES = ("attack", "shield", "heal", "stun")
# Same chart as ELEMENTS in js/config.js.
BEATS = {
    "fire": ["nature", "ice"], "water": ["fire", "rock"], "nature": ["water", "rock"],
    "lightning": ["water", "ice"], "ice": ["nature", "water"], "rock": ["fire", "lightning"],
    "light": ["dark"], "dark": ["light"],
}

# Riddle Rush.
RIDDLE_S = 15  # to work out the letter and sign it
WRONG_HURT = 4  # a wrong guess costs your side this much HP
START_RATING = 1000

# No J or Z: they're movements, which are harder to read, so not fair in a race.
LETTERS = list("ABCDEFGHIKLMNOPQRSTUVWXY")
# The handshape tips from js/config.js, used as Riddle Rush clues.
TIPS = dict(re.findall(r'^\s+([A-Z]): "([^"]*)",', (Path(__file__).parent / "js" / "config.js").read_text(encoding="utf-8"), re.M))
WORDS = ["CAB", "BED", "SUN", "MOP", "DIG", "FOX", "YAK", "COW", "HAT", "PIG", "BUS", "OWL", "FISH", "STAR", "LAMP", "FROG", "MILK", "RAIN"]

lock = threading.Lock()
players = {}  # id -> player
parties = {}  # id -> {id, leader, members}
challenges = {}  # id -> {id, frm, to, made}
queue = {}  # entry id (party or player) -> {id, members, since}
matches = {}  # id -> match


# ---------- Raids ----------

RAID_LOBBY_S = 30  # the lobby gathers players this long (or until someone starts it)
RAID_TIME_S = 180  # to bring the raid creature down
RAID_GONE_S = 12  # a raider not heard from this long has left
RAID_HP = {1: 1800, 2: 3000, 3: 4500, 4: 6000}  # by tier: about 3, 5, and 8 players' worth; 4 is a Rift boss
RIFT_TIER = 4
# Skyhaven's Rift: one boss at a time, in this order, each open RIFT_OPEN_S out of every RIFT_CYCLE_S.
RIFT_BOSSES = ["raid-rift-chronodrake", "raid-rift-maw", "raid-rift-hydra", "raid-rift-stag", "raid-rift-bloom", "raid-rift-seraph"]
RIFT_CYCLE_S = 15 * 60
RIFT_OPEN_S = 12 * 60
RAID_HIT_MAX = 30  # the most one sign can do (the client sends its own damage)
raids = {}  # room id -> room


def raid_tick():
    t = now()
    for rid, room in list(raids.items()):
        for pid, rp in list(room["players"].items()):
            if t - rp["seen"] > RAID_GONE_S:
                del room["players"][pid]
        if room["phase"] == "lobby" and t >= room["start_at"] and room["players"]:
            room["phase"], room["ends_at"] = "battle", t + RAID_TIME_S
        if room["phase"] == "battle":
            if room["hp"] <= 0:
                room["phase"], room["over_at"] = "won", t
            elif t >= room["ends_at"]:
                room["phase"], room["over_at"] = "lost", t
        # Finished rooms stay a little, so everyone sees how it ended.
        if (not room["players"] and room["phase"] != "battle") or (room.get("over_at") and t - room["over_at"] > 30):
            del raids[rid]


def raid_view(room, pid=None):
    t = now()
    return {
        "room": room["id"], "raid": room["raid"], "tier": room["tier"], "phase": room["phase"],
        "hp": max(0, room["hp"]), "maxHp": room["max_hp"],
        "startsIn": max(0, room["start_at"] - t) if room["phase"] == "lobby" else 0,
        "timeLeft": max(0, room["ends_at"] - t) if room["phase"] == "battle" else 0,
        # (Players are told apart by a short tag, never their private ids.)
        "players": [{"tag": rp["tag"], "name": rp["name"], "look": rp["look"], "dmg": rp["dmg"], "me": p == pid}
                    for p, rp in sorted(room["players"].items(), key=lambda kv: kv[1]["tag"])],
        "hits": room["hits"][-20:],  # recent hits, so everyone sees everyone's spells fly
        "log": room["log"][-6:],
    }


def rift_now(t=None):
    """Which Rift boss is out, and when things change. Everyone works it out from the same clock."""
    t = now() if t is None else t
    turn, into = divmod(t, RIFT_CYCLE_S)
    turn = int(turn)
    up = into < RIFT_OPEN_S
    return {
        "boss": RIFT_BOSSES[turn % len(RIFT_BOSSES)] if up else None,
        "closesIn": RIFT_OPEN_S - into if up else 0,
        "next": RIFT_BOSSES[(turn + 1) % len(RIFT_BOSSES)],
        "nextIn": RIFT_CYCLE_S - into,
        "schedule": [RIFT_BOSSES[(turn + k) % len(RIFT_BOSSES)] for k in range(1, 4)],
    }


def raid_api(path, body):
    raid_tick()
    pid = str(body.get("id") or "")[:40]
    action = path.rsplit("/", 1)[-1]
    if action == "rift":
        return rift_now()
    if action == "list":
        return {"raids": [raid_view(r) for r in raids.values() if r["phase"] in ("lobby", "battle")]}
    if not pid:
        return {"error": "no id"}
    mine = next((r for r in raids.values() if pid in r["players"]), None)
    if action == "join":
        raid, tier = str(body.get("raid") or "")[:40], int(body.get("tier") or 1)
        if tier not in RAID_HP or not raid.startswith("raid-"):
            return {"error": "No such raid."}
        # Rift bosses only while they're out, and only at the Rift's tier.
        if raid.startswith("raid-rift-") != (tier == RIFT_TIER) or (tier == RIFT_TIER and rift_now()["boss"] != raid):
            return {"error": "The Rift is calm right now."}
        if mine:
            del mine["players"][pid]
        room = next((r for r in raids.values() if r["raid"] == raid and r["tier"] == tier and r["phase"] in ("lobby", "battle")), None)
        if not room:
            rid = uuid.uuid4().hex[:8]
            room = raids[rid] = {"id": rid, "raid": raid, "tier": tier, "phase": "lobby", "players": {}, "start_at": now() + RAID_LOBBY_S,
                                 "ends_at": 0, "hp": RAID_HP[tier], "max_hp": RAID_HP[tier], "log": [], "hits": [], "seq": 0, "tags": 0}
        room["tags"] += 1
        room["players"][pid] = {"name": str(body.get("name") or "Hero")[:16], "look": body.get("look") if isinstance(body.get("look"), dict) else {},
                                "dmg": 0, "seen": now(), "tag": room["tags"]}
        room["log"].append(f"{room['players'][pid]['name']} joined the raid!")
        return raid_view(room, pid)
    if not mine:
        return {"error": "Not in a raid."}
    mine["players"][pid]["seen"] = now()
    if action == "state":
        return raid_view(mine, pid)
    if action == "start":
        if mine["phase"] == "lobby":
            mine["start_at"] = now()
            raid_tick()
        return raid_view(mine, pid)
    if action == "hit":
        if mine["phase"] == "battle":
            dmg = max(0, min(RAID_HIT_MAX, int(body.get("dmg") or 0)))
            before = mine["hp"] / mine["max_hp"]
            mine["hp"] -= dmg
            mine["players"][pid]["dmg"] += dmg
            mine["seq"] += 1
            mine["hits"].append({"seq": mine["seq"], "tag": mine["players"][pid]["tag"], "dmg": dmg})
            del mine["hits"][:-30]
            after = mine["hp"] / mine["max_hp"]
            for mark in (0.75, 0.5, 0.25):
                if before > mark >= after:
                    mine["log"].append(f"{int(mark * 100)}% HP left! {mine['players'][pid]['name']} landed the big hit!")
            raid_tick()
        return raid_view(mine, pid)
    if action == "leave":
        del mine["players"][pid]
        raid_tick()
        return {"ok": True}
    return {"error": "unknown"}


# ---------- Skyhaven, and walking around the zones together ----------
# Everyone sends where they are (and which "room": "hub" for Skyhaven, or
# "zone:<id>" for a zone) and gets back everyone else in the same room.

HUB_GONE_S = 8  # someone not heard from this long has left
HUB_EMOTES = ["👋", "😄", "🎉", "❤️", "😮", "⚔️"]
hub = {}  # id -> {room, name, look, hat, pos, emote, emote_at, seen, tag}
hub_tags = [0]


def hub_api(path, body):
    pid = str(body.get("id") or "")[:40]
    if not pid:
        return {"error": "no id"}
    t = now()
    for p, h in list(hub.items()):
        if t - h["seen"] > HUB_GONE_S:
            del hub[p]
    action = path.rsplit("/", 1)[-1]
    if action == "leave":
        hub.pop(pid, None)
        return {"ok": True}
    if action != "state":
        return {"error": "unknown"}
    me = hub.get(pid)
    if not me:
        hub_tags[0] += 1
        me = hub[pid] = {"tag": hub_tags[0], "emote": None, "emote_at": 0}
    pos = body.get("pos") if isinstance(body.get("pos"), dict) else {}
    me.update({
        "room": str(body.get("room") or "hub")[:40],
        "name": str(body.get("name") or "Hero")[:16],
        "look": body.get("look") if isinstance(body.get("look"), dict) else {},
        "hat": str(body.get("hat") or "")[:30] or None,
        "pos": {"x": float(pos.get("x") or 0), "y": float(pos.get("y") or 0), "flip": bool(pos.get("flip"))},
        "seen": t,
    })
    if body.get("emote") in HUB_EMOTES:
        me["emote"], me["emote_at"] = body["emote"], t
    # (Everyone else, told apart by a short tag, never their private ids.)
    return {
        "others": [{"tag": h["tag"], "name": h["name"], "look": h["look"], "hat": h["hat"], "pos": h["pos"],
                    "emote": h["emote"] if t - h["emote_at"] < 3 else None} for p, h in hub.items() if p != pid and h["room"] == me["room"]],
        "rift": rift_now(t),
    }


def now():
    return time.time()


def online(p):
    return now() - p["seen"] < ONLINE_S


def side_of(pid):
    """Everyone who'd fight with this player: their party, or just them."""
    party = parties.get(players[pid]["party"])
    return list(party["members"]) if party else [pid]


def public(pid):
    p = players[pid]
    party = parties.get(p["party"])
    return {
        "id": pid, "name": p["name"], "look": p["look"], "rating": round(p["rating"]),
        "status": p["status"], "party": len(party["members"]) if party else 1,
        "pos": p.get("pos"),
    }


def leave_party(pid):
    p = players[pid]
    party = parties.get(p["party"])
    p["party"] = None
    if not party:
        return
    party["members"] = [m for m in party["members"] if m != pid]
    queue.pop(party["id"], None)
    if len(party["members"]) <= 1:
        for m in party["members"]:
            players[m]["party"] = None
        parties.pop(party["id"], None)
    elif party["leader"] == pid:
        party["leader"] = party["members"][0]


# ---------- Matches ----------

def clean_move(mv):
    if not isinstance(mv, dict):
        return None
    kind = mv.get("type") if mv.get("type") in MOVE_TYPES else "attack"
    try:
        cost = max(0, min(9, int(mv.get("cost") or 0)))
        power = max(0.5, min(6.0, float(mv.get("power") or 1)))
    except (TypeError, ValueError):
        return None
    return {"id": str(mv.get("id") or mv.get("name") or "")[:24], "name": str(mv.get("name") or "Move")[:24],
            "icon": str(mv.get("icon") or "")[:8], "type": kind, "cost": cost, "power": power,
            "element": str(mv.get("element") or "")[:12], "all": bool(mv.get("all"))}


def clean_loadout(raw):
    """A player's hero spells and buddies, checked so nobody can send a 100x move."""
    raw = raw if isinstance(raw, dict) else {}
    spells = [m for m in (clean_move(mv) for mv in (raw.get("spells") or [])[:12]) if m]
    if not spells:
        spells = [clean_move({"id": "spark", "name": "Spark", "icon": "✨", "power": 1})]
    buddies = []
    for b in (raw.get("buddies") or [])[:2]:
        if not isinstance(b, dict):
            continue
        moves = [m for m in (clean_move(mv) for mv in (b.get("moves") or [])[:8]) if m]
        try:
            level = max(1, min(50, int(b.get("level") or 1)))
            stage = max(1, min(3, int(b.get("stage") or 1)))
        except (TypeError, ValueError):
            level, stage = 1, 1
        buddies.append({"id": str(b.get("id") or "")[:24], "name": str(b.get("name") or "Buddy")[:20],
                        "element": str(b.get("element") or "")[:12], "level": level, "stage": stage, "moves": moves})
    return {"spells": spells, "buddies": buddies}


def effectiveness(attack, defend):
    """How well an element hits another: 1.6 super effective, 0.6 weak, else 1."""
    if attack not in BEATS or defend not in BEATS:
        return 1.0
    if defend in BEATS[attack]:
        return 1.6
    if attack == defend or attack in BEATS[defend]:
        return 0.6
    return 1.0


def start_match(side_a, side_b, mode="duel"):
    mid = uuid.uuid4().hex[:8]
    for pid in side_a + side_b:
        players[pid]["status"] = "battle"
        players[pid]["match"] = mid
        queue.pop(pid, None)
        if players[pid]["party"]:
            queue.pop(players[pid]["party"], None)
        for c in [c for c in challenges.values() if pid in (c["frm"], c["to"])]:
            challenges.pop(c["id"], None)
    m = {
        "id": mid, "sides": [side_a, side_b],
        "hp": [SIDE_HP * len(side_a), SIDE_HP * len(side_b)],
        "max": [SIDE_HP * len(side_a), SIDE_HP * len(side_b)],
        "names": {pid: players[pid]["name"] for pid in side_a + side_b},
        "looks": {pid: players[pid]["look"] for pid in side_a + side_b},
        "round": 0, "results": {}, "log": [], "winner": None, "ended": None, "changes": {},
        "mode": mode if mode in MODES else "duel",
        "loadouts": {pid: players[pid].get("loadout") or clean_loadout({}) for pid in side_a + side_b},
        "energy": {pid: ENERGY_START for pid in side_a + side_b},
        "shield": [0, 0], "skip": [False, False], "wrong": {}, "answer": None,
        # Creature Clash: players take turns, alternating sides.
        "order": [pid for pair in zip(side_a, side_b) for pid in pair], "turn": -1, "active": None, "resolved": None,
    }
    matches[mid] = m
    if m["mode"] == "clash":
        m["fighters"] = clash_fighters(m)
        sync_hp(m)
        next_turn(m, now())
    else:
        next_round(m, now())
    return m


def next_round(m, t):
    m["round"] += 1
    if m["round"] > 1:
        m["answer"] = m["target"]  # what last round's letter was (Riddle Rush shows it)
    word = m["mode"] != "riddle" and m["round"] % 3 == 0
    m["kind"] = "word" if word else "letter"
    m["target"] = random.choice(WORDS) if word else random.choice(LETTERS)
    m["starts"] = t + COUNTDOWN_S
    m["ends"] = m["starts"] + (RIDDLE_S if m["mode"] == "riddle" else WORD_S if word else LETTER_S)
    m["results"] = {}
    m["wrong"] = {}

def everyone(m):
    return m["sides"][0] + m["sides"][1]


def tick_match(m):
    t = now()
    if m["winner"] is not None:
        return
    # A side that's all gone loses.
    for s in (0, 1):
        if all(t - players[pid]["seen"] > GONE_S or players[pid]["match"] != m["id"] for pid in m["sides"][s]):
            return end_match(m, 1 - s, left=True)
    if m["mode"] == "clash":
        return tick_clash(m, t)
    present = [pid for pid in everyone(m) if t - players[pid]["seen"] < GONE_S]
    if t < m["ends"] and not all(pid in m["results"] for pid in present):
        return
    # The round is over: everyone who signed it acts.
    signed = sorted(m["results"].items(), key=lambda kv: kv[1])
    span = (m["ends"] - m["starts"]) or 1
    for n, (pid, at) in enumerate(signed):
        s = 0 if pid in m["sides"][0] else 1
        quick = max(0.0, 1 - (at - m["starts"]) / span)
        entry = {"round": m["round"], "pid": pid, "side": s, "secs": round(at - m["starts"], 1), "dmg": 0, "first": n == 0}
        if True:
            dmg = round((HIT + SPEED_HIT * quick + (FIRST_HIT if n == 0 else 0)) * (WORD_TIMES if m["kind"] == "word" else 1))
            m["hp"][1 - s] = max(0, m["hp"][1 - s] - dmg)
            entry["dmg"] = dmg
        m["log"].append(entry)
    # Riddle Rush: wrong guesses hurt your own side a little.
    for pid, count in m["wrong"].items():
        s = 0 if pid in m["sides"][0] else 1
        hurt = WRONG_HURT * count
        m["hp"][s] = max(0, m["hp"][s] - hurt)
        m["log"].append({"round": m["round"], "pid": pid, "side": s, "wrong": count, "hurt": hurt, "dmg": 0, "first": False})
    m["log"] = m["log"][-12:]
    if m["hp"][0] <= 0 or m["hp"][1] <= 0:
        if m["hp"][0] == m["hp"][1]:
            return end_match(m, random.choice([0, 1]))
        return end_match(m, 0 if m["hp"][0] > m["hp"][1] else 1)
    next_round(m, t + BETWEEN_S)  # a pause to see who hit whom, then the countdown


def clash_fighters(m):
    """Everyone on the field, each with their own HP: a lone player's hero and
    buddies, or a party's heroes. Knock out the heroes to win."""
    fighters = []
    for s, side in enumerate(m["sides"]):
        for pid in side:
            fighters.append({"key": f"{pid}:hero", "side": s, "pid": pid, "who": "hero", "name": m["names"][pid],
                             "element": "", "hp": SIDE_HP, "max": SIDE_HP})
            if len(side) == 1:
                for n, b in enumerate(m["loadouts"][pid]["buddies"]):
                    hp = min(100, CLASH_BUDDY_HP + 2 * b["level"])
                    fighters.append({"key": f"{pid}:{n}", "side": s, "pid": pid, "who": str(n), "name": b["name"],
                                     "element": b["element"], "hp": hp, "max": hp})
    return fighters


def fighter(m, key):
    return next((f for f in m["fighters"] if f["key"] == key), None)


def sync_hp(m):
    """A side's HP bar is its heroes' HP: when they're all down, the side loses."""
    for s in (0, 1):
        heroes = [f for f in m["fighters"] if f["side"] == s and f["who"] == "hero"]
        m["hp"][s] = sum(f["hp"] for f in heroes)
        m["max"][s] = sum(f["max"] for f in heroes)


def next_turn(m, t):
    """Creature Clash: the next player's turn (a stunned side skips one, and a
    knocked-out hero's player sits out)."""
    for _ in range(len(m["order"]) * 2):
        m["turn"] += 1
        pid = m["order"][m["turn"] % len(m["order"])]
        s = 0 if pid in m["sides"][0] else 1
        if fighter(m, f"{pid}:hero")["hp"] <= 0:
            continue
        if m["skip"][s]:
            m["skip"][s] = False
            m["log"].append({"round": m["round"], "turn": m["turn"], "pid": pid, "side": s, "skipped": True, "dmg": 0, "first": False})
            continue
        break
    m["round"] += 1
    m["active"] = pid
    word = m["round"] % 4 == 0  # every 4th turn is a word
    m["kind"] = "word" if word else "letter"
    m["target"] = random.choice(WORDS) if word else random.choice(LETTERS)
    m["starts"] = t + CLASH_COUNTDOWN_S
    m["ends"] = m["starts"] + (CLASH_WORD_S if word else CLASH_TURN_S)
    m["results"] = {}
    m["resolved"] = None


def find_move(m, pid, who, move_id):
    """The move `move_id` of `who` ("hero", or a buddy's number) in pid's loadout."""
    lo = m["loadouts"][pid]
    if who == "hero":
        moves, user = lo["spells"], None
    else:
        try:
            user = lo["buddies"][int(who)]
        except (ValueError, IndexError, TypeError):
            return None, None
        moves = user["moves"]
    return next((mv for mv in moves if mv["id"] == move_id), None), user


def clash_use(m, pid, who, move_id, aim, t):
    """Creature Clash: pid signed it on their turn, so their move happens now,
    at the foe they aimed at (`aim`, a fighter's key), or at all of them."""
    s = 0 if pid in m["sides"][0] else 1
    move, user = find_move(m, pid, who, move_id)
    knocked_out = (fighter(m, f"{pid}:{who}") or {"hp": 1})["hp"] <= 0
    if not move or move["cost"] > m["energy"][pid] or knocked_out:
        move, user = m["loadouts"][pid]["spells"][0], None  # can't: the free spell instead
        who = "hero"
    secs = t - m["starts"]
    letters = len(m["target"])
    quick = max(0.0, 1 - secs / ((m["ends"] - m["starts"]) or 1))
    fast = secs / letters < FAST_LETTER_S
    # Signing earns energy (one per letter, one more for being fast); the move spends it.
    m["energy"][pid] = min(ENERGY_MAX, m["energy"][pid] - move["cost"] + letters + (1 if fast else 0))
    entry = {"round": m["round"], "turn": m["turn"], "pid": pid, "side": s, "secs": round(secs, 1), "dmg": 0, "first": False,
             "who": who, "user": user["name"] if user else None, "move": move["name"], "icon": move["icon"], "type": move["type"]}
    if move["type"] == "shield":
        m["shield"][s] = min(SHIELD_MAX, m["shield"][s] + 1)
    elif move["type"] == "heal":
        # Heals whoever on your side is hurt the most.
        mine = [f for f in m["fighters"] if f["side"] == s and f["hp"] > 0]
        hurt = min(mine, key=lambda f: f["hp"] / f["max"])
        gain = min(hurt["max"] - hurt["hp"], round(hurt["max"] * HEAL_PART))
        hurt["hp"] += gain
        entry["heal"] = gain
        entry["healed"] = hurt["key"]
    elif move["type"] == "stun":
        m["skip"][1 - s] = True
    else:
        foes = [f for f in m["fighters"] if f["side"] == 1 - s and f["hp"] > 0]
        # Your aim, if it's still standing; else their first buddy, like in the zones.
        aimed = next((f for f in foes if f["key"] == aim), None) or next((f for f in foes if f["who"] != "hero"), foes[0])
        targets = foes if move.get("all") else [aimed]
        spread = CLASH_GROUP if len(targets) > 1 else 1.0
        boost = 1 + (user["level"] - 1) * 0.05 if user else 1.0
        blocked = m["shield"][1 - s] > 0  # a shield blocks the whole move
        if blocked:
            m["shield"][1 - s] -= 1
            entry["blocked"] = True
        entry["hits"] = []
        for f in targets:
            eff = effectiveness(move["element"], f["element"]) if move["element"] else 1.0
            dmg = 0 if blocked else round(CLASH_HIT * move["power"] * spread * eff * boost * (1 + CLASH_SPEED * quick))
            f["hp"] = max(0, f["hp"] - dmg)
            entry["hits"].append({"key": f["key"], "dmg": dmg, "eff": eff, "out": f["hp"] <= 0})
        entry["dmg"] = sum(h["dmg"] for h in entry["hits"])
        entry["eff"] = entry["hits"][0]["eff"] if len(targets) == 1 else 1.0
        entry["all"] = len(targets) > 1
        entry["crit"] = fast and quick > 0.75
    sync_hp(m)
    m["log"].append(entry)
    m["log"] = m["log"][-12:]
    m["results"][pid] = t
    m["resolved"] = t


def tick_clash(m, t):
    if m["hp"][0] <= 0 or m["hp"][1] <= 0:
        return end_match(m, 0 if m["hp"][0] > 0 else 1)
    if m["resolved"] is not None:
        if t >= m["resolved"] + CLASH_AFTER_S:
            next_turn(m, t)
        return
    if t >= m["ends"]:  # ran out of time: the turn passes
        s = 0 if m["active"] in m["sides"][0] else 1
        m["log"].append({"round": m["round"], "turn": m["turn"], "pid": m["active"], "side": s, "timeout": True, "dmg": 0, "first": False})
        m["log"] = m["log"][-12:]
        m["resolved"] = t - CLASH_AFTER_S + 1


def end_match(m, winner, left=False):
    m["winner"] = winner
    m["left"] = left  # the losing side left, or gave up
    m["ended"] = now()
    avg = [sum(players[p]["rating"] for p in side) / len(side) for side in m["sides"]]
    for s in (0, 1):
        expected = 1 / (1 + 10 ** ((avg[1 - s] - avg[s]) / 400))
        score = 1 if s == winner else 0
        for pid in m["sides"][s]:
            change = round(ELO_K * (score - expected))
            players[pid]["rating"] = max(100, players[pid]["rating"] + change)
            players[pid]["status"] = "idle"
            m["changes"][pid] = change


def match_view(m, pid):
    s = 0 if pid in m["sides"][0] else 1
    t = now()
    view = {
        "id": m["id"], "you": s, "round": m["round"], "kind": m["kind"], "hp": m["hp"], "max": m["max"],
        "sides": [[{"id": p, "name": m["names"][p], "look": m["looks"][p], "signed": p in m["results"]} for p in side] for side in m["sides"]],
        "startsIn": round(m["starts"] - t, 2), "endsIn": round(m["ends"] - t, 2),
        "log": [dict(e, name=m["names"][e["pid"]]) for e in m["log"]],
        "winner": m["winner"], "left": m.get("left", False), "change": m["changes"].get(pid),
        "mode": m["mode"], "modeName": MODES[m["mode"]],
    }
    # The target only once the round starts, so nobody gets a head start.
    started = t >= m["starts"]
    view["target"] = m["target"] if started else None
    if m["mode"] == "clash":
        view["energy"] = m["energy"][pid]
        view["energies"] = [[m["energy"][p] for p in side] for side in m["sides"]]
        view["shield"] = m["shield"]
        view["skip"] = m["skip"]
        view["active"] = m["active"]
        view["yourTurn"] = m["active"] == pid and m["resolved"] is None
        view["resolved"] = m["resolved"] is not None
        view["loadouts"] = [[m["loadouts"][p] for p in side] for side in m["sides"]]
        view["fighters"] = m["fighters"]
        view["log"] = [dict(e, name=m["names"][e["pid"]]) for e in m["log"]]
    if m["mode"] == "riddle":
        # The letter stays secret: you get the clue, and last round's answer.
        view["target"] = None
        view["clue"] = TIPS.get(m["target"], "") if started else None
        view["answer"] = m["answer"]
        view["solved"] = pid in m["results"]
        view["wrong"] = m["wrong"].get(pid, 0)
    return view


# ---------- Matchmaking ----------

def matchmake():
    t = now()
    entries = [e for e in queue.values() if all(pid in players and online(players[pid]) for pid in e["members"])]
    for e in list(queue.values()):
        if e not in entries:
            queue.pop(e["id"], None)
    used = set()
    entries.sort(key=lambda e: e["since"])
    for a in entries:
        if a["id"] in used:
            continue
        ra = sum(players[p]["rating"] for p in a["members"]) / len(a["members"])
        best = None
        for b in entries:
            if b is a or b["id"] in used or len(b["members"]) != len(a["members"]) or b.get("mode") != a.get("mode"):
                continue
            rb = sum(players[p]["rating"] for p in b["members"]) / len(b["members"])
            # The longer they've waited, the wider the rating gap allowed.
            window = 100 + 25 * (t - max(a["since"], b["since"]))
            if abs(ra - rb) <= window and (best is None or abs(ra - rb) < best[0]):
                best = (abs(ra - rb), b)
        if best:
            used.update([a["id"], best[1]["id"]])
            queue.pop(a["id"], None)
            queue.pop(best[1]["id"], None)
            start_match(list(a["members"]), list(best[1]["members"]), a.get("mode", "duel"))


# ---------- API ----------

def api(path, body):
    pid = body.get("id")
    if path == "/api/hello":
        if not pid or pid not in players:
            pid = pid if pid and len(pid) <= 40 else uuid.uuid4().hex
            players[pid] = {"id": pid, "party": None, "status": "idle", "match": None, "invites": [], "rating": START_RATING}
        p = players[pid]
        p["name"] = str(body.get("name") or "Hero")[:16]
        p["look"] = body.get("look") if isinstance(body.get("look"), dict) else {}
        if body.get("loadout") is not None and p["status"] != "battle":
            p["loadout"] = clean_loadout(body.get("loadout"))
        if isinstance(body.get("rating"), (int, float)) and p["status"] != "battle":
            p["rating"] = max(100, min(4000, float(body["rating"])))
        p["seen"] = now()
        return {"id": pid}
    if pid not in players:
        return {"error": "hello first"}
    me = players[pid]
    me["seen"] = now()

    if path == "/api/state":
        # Where you are in the Arena plaza (arena.js), for everyone else to see.
        pos = body.get("pos")
        if isinstance(pos, dict):
            me["pos"] = {k: round(float(pos.get(k) or 0), 1) for k in ("x", "y")}
            me["pos"]["flip"] = bool(pos.get("flip"))
            me["pos"]["moving"] = bool(pos.get("moving"))
        matchmake()
        for m in list(matches.values()):
            tick_match(m)
            if m["ended"] and now() - m["ended"] > 120:
                matches.pop(m["id"], None)
        party = parties.get(me["party"])
        m = matches.get(me["match"])
        return {
            "me": public(pid),
            "players": [public(q) for q in players if q != pid and online(players[q])],
            "party": party and {"id": party["id"], "leader": party["leader"], "members": [public(q) for q in party["members"]]},
            "invites": [{"party": i, "from": players[parties[i]["leader"]]["name"]} for i in me["invites"] if i in parties],
            "challengesIn": [{"id": c["id"], "from": public(c["frm"]), "mode": c.get("mode", "duel")} for c in challenges.values() if c["to"] == pid],
            "challengesOut": [{"id": c["id"], "to": public(c["to"]), "mode": c.get("mode", "duel")} for c in challenges.values() if c["frm"] == pid],
            "queued": any(pid in e["members"] for e in queue.values()),
            "match": m and match_view(m, pid),
        }

    if path == "/api/challenge":
        to = body.get("to")
        if to not in players or to == pid or players[to]["status"] == "battle" or me["status"] == "battle":
            return {"error": "They can't battle right now."}
        if set(side_of(pid)) & set(side_of(to)):
            return {"error": "You're in the same party!"}
        cid = uuid.uuid4().hex[:8]
        mode = body.get("mode") if body.get("mode") in MODES else "duel"
        challenges[cid] = {"id": cid, "frm": pid, "to": to, "made": now(), "mode": mode}
        return {"ok": True}

    if path == "/api/challenge/respond":
        c = challenges.pop(body.get("challenge"), None)
        if not c or c["to"] != pid:
            return {"error": "That challenge is gone."}
        if not body.get("accept"):
            return {"ok": True}
        if players[c["frm"]]["status"] == "battle" or not online(players[c["frm"]]):
            return {"error": "They're not around anymore."}
        start_match(side_of(c["frm"]), side_of(pid), c.get("mode", "duel"))
        return {"ok": True}

    if path == "/api/challenge/cancel":
        for c in [c for c in challenges.values() if c["frm"] == pid]:
            challenges.pop(c["id"], None)
        return {"ok": True}

    if path == "/api/party/invite":
        to = body.get("to")
        if to not in players or to == pid:
            return {"error": "They're not here."}
        if not me["party"]:
            party_id = uuid.uuid4().hex[:8]
            parties[party_id] = {"id": party_id, "leader": pid, "members": [pid]}
            me["party"] = party_id
        party = parties[me["party"]]
        if len(party["members"]) >= PARTY_MAX:
            return {"error": f"A party can have {PARTY_MAX} players."}
        if party["id"] not in players[to]["invites"]:
            players[to]["invites"].append(party["id"])
        return {"ok": True}

    if path == "/api/party/join":
        party = parties.get(body.get("party"))
        me["invites"] = [i for i in me["invites"] if i != body.get("party")]
        if not party:
            return {"error": "That party is gone."}
        if len(party["members"]) >= PARTY_MAX:
            return {"error": "That party is full."}
        if me["status"] == "battle":
            return {"error": "Finish your battle first."}
        leave_party(pid)
        party["members"].append(pid)
        me["party"] = party["id"]
        queue.pop(party["id"], None)
        return {"ok": True}

    if path == "/api/party/decline":
        me["invites"] = [i for i in me["invites"] if i != body.get("party")]
        return {"ok": True}

    if path == "/api/party/leave":
        leave_party(pid)
        return {"ok": True}

    if path == "/api/queue":
        party = parties.get(me["party"])
        key = party["id"] if party else pid
        if not body.get("join"):
            queue.pop(key, None)
            return {"ok": True}
        if party and party["leader"] != pid:
            return {"error": "Your party leader starts the search."}
        members = side_of(pid)
        if any(players[m]["status"] == "battle" for m in members):
            return {"error": "Someone's still in a battle."}
        mode = body.get("mode") if body.get("mode") in MODES else "duel"
        queue[key] = {"id": key, "members": members, "since": now(), "mode": mode}
        return {"ok": True}

    if path == "/api/match/sign":
        m = matches.get(me["match"])
        if not (m and m["winner"] is None and body.get("round") == m["round"] and now() >= m["starts"] and pid not in m["results"]):
            return {"ok": True}
        if m["mode"] == "riddle":
            guess = str(body.get("guess") or "").upper()
            if guess != m["target"]:
                m["wrong"][pid] = min(3, m["wrong"].get(pid, 0) + 1)
                return {"ok": True, "correct": False}
            m["results"][pid] = now()
            return {"ok": True, "correct": True}
        if m["mode"] == "clash":
            if m["active"] != pid or m["resolved"] is not None:
                return {"ok": True}
            move = body.get("move") if isinstance(body.get("move"), dict) else {}
            clash_use(m, pid, move.get("who", "hero"), move.get("id"), move.get("target"), now())
            return {"ok": True}
        m["results"][pid] = now()
        return {"ok": True}

    if path == "/api/match/leave":
        m = matches.get(me["match"])
        if m and m["winner"] is None:
            end_match(m, 1 if pid in m["sides"][0] else 0, left=True)
        me["match"] = None
        me["status"] = "idle"
        return {"ok": True}

    return {"error": "unknown"}


class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def send_head(self):
        # Never serve hidden folders and files: .accounts (everyone's
        # accounts), .cert (the https private key), .git, ...
        parts = unquote(urlsplit(self.path).path).replace("\\", "/").split("/")
        if any(part.startswith(".") for part in parts if part):
            self.send_error(404)
            return None
        return super().send_head()

    def do_POST(self):
        if not self.path.startswith("/api/"):
            self.send_error(404)
            return
        try:
            length = min(int(self.headers.get("Content-Length") or 0), 20000)
            body = json.loads(self.rfile.read(length) or b"{}")
            body = body if isinstance(body, dict) else {}
            if self.path.startswith("/api/account/"):
                out = accounts.handle(self.path, body)  # (it has its own lock)
            elif self.path.startswith("/api/raid/"):
                with lock:
                    out = raid_api(self.path, body)
            elif self.path.startswith("/api/hub/"):
                with lock:
                    out = hub_api(self.path, body)
            else:
                with lock:
                    out = api(self.path, body)
        except Exception as e:  # never let one bad request take the arena down
            out = {"error": str(e)}
        data = json.dumps(out).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, fmt, *args):
        if not self.path.startswith("/api/"):  # the arena polls a lot
            super().log_message(fmt, *args)


def lan_address():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]
    except OSError:
        return None


def certificate(folder):
    """A self-signed certificate for https, made once with openssl (Git comes with it)."""
    cert, key = folder / "cert.pem", folder / "key.pem"
    if cert.exists() and key.exists():
        return cert, key
    openssl = shutil.which("openssl") or next((str(p) for p in [Path("C:/Program Files/Git/usr/bin/openssl.exe")] if p.exists()), None)
    if not openssl:
        return None
    folder.mkdir(exist_ok=True)
    try:
        subprocess.run([openssl, "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "825", "-subj", "/CN=SignQuest",
                        "-keyout", str(key), "-out", str(cert)], check=True, capture_output=True)
        return cert, key
    except (OSError, subprocess.CalledProcessError):
        return None


if __name__ == "__main__":
    root = Path(__file__).parent
    handler = partial(Handler, directory=str(root))
    # On a hosting service (Render, Railway, a VPS behind Caddy...), it sets PORT
    # and handles https itself, so there's no certificate to make here.
    if os.environ.get("PORT"):
        port = int(os.environ["PORT"])
        # flush: a host's log isn't a screen, so Python would otherwise hold these lines back.
        print(accounts.storage_status(), flush=True)
        print(f"SignQuest running on port {port}", flush=True)
        ThreadingHTTPServer(("", port), handler).serve_forever()
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    print(f"SignQuest running at http://localhost:{port}  (Ctrl+C to stop)")
    lan = lan_address()
    made = certificate(root / ".cert")
    if made:
        secure = ThreadingHTTPServer(("", port + 443), handler)
        context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        context.load_cert_chain(*map(str, made))
        secure.socket = context.wrap_socket(secure.socket, server_side=True)
        threading.Thread(target=secure.serve_forever, daemon=True).start()
        if lan:
            print(f"Friends on the same Wi-Fi can join the Arena at https://{lan}:{port + 443}")
            print("  (their browser warns once about the certificate: Advanced -> Continue)")
    elif lan:
        print(f"Friends on the same Wi-Fi: http://{lan}:{port} (no openssl found, so no https - their camera may be blocked)")
    ThreadingHTTPServer(("", port), handler).serve_forever()
