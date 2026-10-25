"""SignQuest accounts: sign up, log in, log out, and delete an account.

serve.py hands every request under /api/account/ to `handle()`.

An account is an email address, a password, and a username, plus the
version of the user agreement (js/agreement.js) the player agreed to.
Accounts are saved in .accounts/users.json next to this file (or in the
folder SIGNQUEST_DATA names, on a host with a disk that survives restarts).
serve.py never serves that folder, and .gitignore keeps it out of git.

On a host whose files are wiped on every restart (Render's free plan), set
DATABASE_URL to a Postgres database's connection link (Neon, Supabase...)
instead: the same accounts are then kept there, in one row of a small table
(signquest_store). That needs the psycopg package (requirements.txt);
without DATABASE_URL, nothing outside Python itself is used.

Passwords are never stored: only a salted PBKDF2-SHA256 hash of each one.
Logging in gives the browser a random session token; only a SHA-256 hash of
it is stored, so the file alone can't be used to log in. Too many wrong
passwords for one email locks it for a few minutes.

The same rules for emails, passwords, and usernames are checked in the
browser too (js/account.js), so players see what's wrong as they type.
"""

import hashlib
import hmac
import json
import os
import re
import secrets
import threading
import time
from pathlib import Path

STORE = Path(os.environ.get("SIGNQUEST_DATA") or Path(__file__).parent / ".accounts") / "users.json"
HASH_ROUNDS = 200_000
SESSION_DAYS = 30
MAX_FAILS = 5  # wrong passwords in a row...
LOCK_S = 5 * 60  # ...lock that email for this long
AGREEMENT_VERSION = 1  # must match js/agreement.js

EMAIL = re.compile(r"^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$")
USERNAME = re.compile(r"^[A-Za-z0-9_]{3,16}$")

lock = threading.Lock()
fails = {}  # email -> (how many wrong in a row, locked until)


DATABASE_URL = os.environ.get("DATABASE_URL")
table_ready = False


def connect():
    """A connection to the DATABASE_URL database, with its table made the first time."""
    global table_ready
    import psycopg  # only needed with DATABASE_URL

    conn = psycopg.connect(DATABASE_URL, autocommit=True)
    if not table_ready:
        conn.execute("CREATE TABLE IF NOT EXISTS signquest_store (key text PRIMARY KEY, value jsonb NOT NULL)")
        table_ready = True
    return conn


def storage_status():
    """One line for the server log: where accounts are being kept, and whether that works."""
    if not DATABASE_URL:
        return f"Accounts: saved in a file ({STORE}). On Render's free plan this is wiped on every restart - set DATABASE_URL."
    try:
        with connect() as conn:
            row = conn.execute("SELECT value FROM signquest_store WHERE key = 'accounts'").fetchone()
        return f"Accounts: saved in the database (connected; {len(row[0]['users']) if row else 0} accounts so far)."
    except ImportError:
        return "Accounts: DATABASE_URL is set, but psycopg isn't installed - set the Build Command to: pip install -r requirements.txt"
    except Exception as e:  # a wrong link, a reset password...
        return f"Accounts: DATABASE_URL is set, but the database didn't connect: {type(e).__name__}: {str(e).splitlines()[0][:160]}"


def load():
    if DATABASE_URL:
        with connect() as conn:
            row = conn.execute("SELECT value FROM signquest_store WHERE key = 'accounts'").fetchone()
        return row[0] if row else {"users": {}, "sessions": {}}
    try:
        return json.loads(STORE.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {"users": {}, "sessions": {}}


def save(db):
    if DATABASE_URL:
        from psycopg.types.json import Jsonb

        with connect() as conn:
            conn.execute(
                "INSERT INTO signquest_store (key, value) VALUES ('accounts', %s) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
                (Jsonb(db),),
            )
        return
    STORE.parent.mkdir(parents=True, exist_ok=True)
    tmp = STORE.with_suffix(".tmp")
    tmp.write_text(json.dumps(db, indent=1), encoding="utf-8")
    tmp.replace(STORE)  # all at once, so a crash can't leave half a file


def hash_password(password, salt):
    return hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), HASH_ROUNDS).hex()


def token_hash(token):
    return hashlib.sha256(token.encode()).hexdigest()


def email_problem(email):
    if not email or len(email) > 254 or not EMAIL.match(email) or ".." in email:
        return "Please enter a real email address, like name@example.com."
    return None


def password_problem(password):
    if len(password) < 8:
        return "Your password needs at least 8 characters."
    if len(password) > 64:
        return "Your password can be 64 characters at most."
    if not re.search(r"[A-Za-z]", password) or not re.search(r"[0-9]", password):
        return "Your password needs at least one letter and one number."
    return None


def username_problem(username):
    if not USERNAME.match(username):
        return "Usernames are 3 to 16 letters, numbers, or underscores (_)."
    return None


def public(user):
    return {"id": user["id"], "username": user["username"], "email": user["email"]}


def new_session(db, user):
    token = secrets.token_urlsafe(32)
    db["sessions"][token_hash(token)] = {"user": user["id"], "expires": time.time() + SESSION_DAYS * 86400}
    # Forget expired sessions while we're here.
    db["sessions"] = {k: s for k, s in db["sessions"].items() if s["expires"] > time.time()}
    return token


def user_for(db, token):
    s = db["sessions"].get(token_hash(str(token or "")))
    if not s or s["expires"] < time.time():
        return None
    return db["users"].get(s["user"])


def find_by_email(db, email):
    return next((u for u in db["users"].values() if u["email"] == email), None)


def handle(path, body):
    with lock:
        db = load()
        action = path.rsplit("/", 1)[-1]

        if action == "signup":
            email = str(body.get("email") or "").strip().lower()
            password = str(body.get("password") or "")
            username = str(body.get("username") or "").strip()
            problem = email_problem(email) or password_problem(password) or username_problem(username)
            if problem:
                return {"error": problem}
            if body.get("agree") is not True or body.get("agreement") != AGREEMENT_VERSION:
                return {"error": "Please read and agree to the user agreement."}
            if find_by_email(db, email):
                return {"error": "There's already an account with that email. Try logging in!"}
            if any(u["username"].lower() == username.lower() for u in db["users"].values()):
                return {"error": "That username is taken. Try another one!"}
            salt = secrets.token_hex(16)
            user = {
                "id": secrets.token_hex(8), "email": email, "username": username,
                "salt": salt, "hash": hash_password(password, salt),
                "agreement": AGREEMENT_VERSION, "agreed": time.time(), "created": time.time(),
            }
            db["users"][user["id"]] = user
            token = new_session(db, user)
            save(db)
            return {"token": token, "user": public(user)}

        if action == "login":
            email = str(body.get("email") or "").strip().lower()
            password = str(body.get("password") or "")
            count, until = fails.get(email, (0, 0))
            if until > time.time():
                return {"error": f"Too many tries. Please wait {int(until - time.time()) // 60 + 1} minutes and try again."}
            user = find_by_email(db, email)
            # Same answer (and about the same time) whether the email or the password was wrong.
            given = hash_password(password, user["salt"] if user else "00" * 16)
            if not user or not hmac.compare_digest(user["hash"], given):
                count += 1
                fails[email] = (0, time.time() + LOCK_S) if count >= MAX_FAILS else (count, 0)
                return {"error": "That email and password don't match."}
            fails.pop(email, None)
            token = new_session(db, user)
            save(db)
            return {"token": token, "user": public(user)}

        if action == "me":
            user = user_for(db, body.get("token"))
            return {"user": public(user)} if user else {"error": "Please log in again."}

        if action == "logout":
            db["sessions"].pop(token_hash(str(body.get("token") or "")), None)
            save(db)
            return {"ok": True}

        if action == "delete":
            user = user_for(db, body.get("token"))
            if not user:
                return {"error": "Please log in again."}
            if not hmac.compare_digest(user["hash"], hash_password(str(body.get("password") or ""), user["salt"])):
                return {"error": "That password isn't right."}
            del db["users"][user["id"]]
            db["sessions"] = {k: s for k, s in db["sessions"].items() if s["user"] != user["id"]}
            save(db)
            return {"ok": True}

        return {"error": "unknown"}
