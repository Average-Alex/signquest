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

A match is between two sides (one player each, or two parties of the same
size), in one of three game modes. A side is out when its HP runs out.
Ratings go up and down like chess (Elo), whatever the mode.
  duel   - Sign Duel: everyone gets the same letter (every third round, a
           short word); whoever signs it hits the other side, harder the
           faster they are, and the first one to sign gets a bonus.
  clash  - Creature Clash, the RPG mode: each round you pick a move (Spark,
           Blast, Nova, Shield, Heal) and sign to use it. Bigger moves cost
           energy, which you earn by signing. Your lead buddy's element makes
           Blast and Nova super effective (or weak) against theirs.
  riddle - Riddle Rush: you get a clue about the handshape instead of the
           letter. Work out which letter it is and sign it; a wrong guess
           costs you a little HP.
"""

import json
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

# Creature Clash (the RPG mode).
CLASH_HIT = 7  # a Spark signed slowly
CLASH_SPEED = 0.5  # up to 50% more for signing fast
CLASH_MOVES = {
    "spark": {"cost": 0, "power": 1.0},
    "blast": {"cost": 3, "power": 2.0, "element": True},
    "nova": {"cost": 6, "power": 3.5, "element": True},
    "shield": {"cost": 2},  # blocks the other side's next hit
    "heal": {"cost": 4},  # heals a quarter of your side's HP
}
ENERGY_START = 2
ENERGY_MAX = 10
SHIELD_MAX = 2
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
        "buddies": {pid: players[pid].get("buddy") for pid in side_a + side_b},
        "energy": {pid: ENERGY_START for pid in side_a + side_b},
        "shield": [0, 0], "moves": {}, "wrong": {}, "answer": None,
    }
    matches[mid] = m
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
    m["moves"] = {}
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
        if m["mode"] == "clash":
            clash_act(m, pid, s, quick, n == 0, entry)
        else:
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


def clash_act(m, pid, s, quick, first, entry):
    """Creature Clash: one player's move for this round."""
    name = m["moves"].get(pid, "spark")
    move = CLASH_MOVES[name]
    energy = m["energy"][pid]
    if move["cost"] > energy:  # can't afford it (shouldn't happen): a Spark instead
        name, move = "spark", CLASH_MOVES["spark"]
    # Signing earns energy (more for the first one, and 2 more for a word),
    # and the move spends it.
    earned = 1 + (1 if first else 0) + (2 if m["kind"] == "word" else 0)
    m["energy"][pid] = min(ENERGY_MAX, energy - move["cost"] + earned)
    entry["move"] = name
    if name == "shield":
        m["shield"][s] = min(SHIELD_MAX, m["shield"][s] + 1)
        return
    if name == "heal":
        gain = min(m["max"][s] - m["hp"][s], round(m["max"][s] * 0.25))
        m["hp"][s] += gain
        entry["heal"] = gain
        return
    # An attack. Blast and Nova use your buddy's element against theirs.
    mine = (m["buddies"].get(pid) or {}).get("element")
    theirs = (m["buddies"].get(m["sides"][1 - s][0]) or {}).get("element")
    eff = effectiveness(mine, theirs) if move.get("element") else 1.0
    dmg = round(CLASH_HIT * move["power"] * eff * (1 + CLASH_SPEED * quick))
    if m["shield"][1 - s] > 0:
        m["shield"][1 - s] -= 1
        entry["blocked"] = True
        dmg = 0
    m["hp"][1 - s] = max(0, m["hp"][1 - s] - dmg)
    entry["dmg"] = dmg
    entry["eff"] = eff


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
        view["shield"] = m["shield"]
        view["moves"] = {name: mv["cost"] for name, mv in CLASH_MOVES.items()}
        view["buddies"] = [[m["buddies"].get(p) for p in side] for side in m["sides"]]
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
        buddy = body.get("buddy")
        if isinstance(buddy, dict):
            p["buddy"] = {"id": str(buddy.get("id", ""))[:24], "name": str(buddy.get("name", ""))[:20],
                          "element": str(buddy.get("element", ""))[:12], "stage": int(buddy.get("stage") or 1)}
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
            move = body.get("move") if body.get("move") in CLASH_MOVES else "spark"
            if CLASH_MOVES[move]["cost"] > m["energy"][pid]:
                move = "spark"
            m["moves"][pid] = move
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

    def do_POST(self):
        if not self.path.startswith("/api/"):
            self.send_error(404)
            return
        try:
            length = min(int(self.headers.get("Content-Length") or 0), 20000)
            body = json.loads(self.rfile.read(length) or b"{}")
            with lock:
                out = api(self.path, body if isinstance(body, dict) else {})
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
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    root = Path(__file__).parent
    handler = partial(Handler, directory=str(root))
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
