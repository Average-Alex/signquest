// Accounts: log in with an email and password, or sign up with a username
// too (the server side is accounts.py). The browser keeps the session token
// in localStorage, and each account gets its own save on this device (see
// saveKey).
//
// The rules for emails, passwords, and usernames match accounts.py, so
// players see what's wrong as they type; the server checks them again.

const SESSION_KEY = "signquest.session";
const GUEST_SAVE = "signquest.v1"; // the save from before accounts, and offline guests'
const CLAIMED = "signquest.v1.claimed"; // which account took over the old save

export function session() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY));
  } catch {
    return null;
  }
}

function setSession(value) {
  try {
    if (value) localStorage.setItem(SESSION_KEY, JSON.stringify(value));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    // Private browsing with storage blocked: the session just won't last.
  }
}

export const currentUser = () => session()?.user || null;

// Where this player's progress is saved (progress.js). The first account
// made on this device keeps the save from before accounts existed.
export function saveKey() {
  const user = currentUser();
  if (!user?.id) return GUEST_SAVE;
  const key = `${GUEST_SAVE}.${user.id}`;
  try {
    if (!localStorage.getItem(key) && localStorage.getItem(GUEST_SAVE) && !localStorage.getItem(CLAIMED)) {
      localStorage.setItem(key, localStorage.getItem(GUEST_SAVE));
      localStorage.setItem(CLAIMED, user.id);
    }
  } catch {
    // Storage blocked: progress.js copes.
  }
  return key;
}

export function emailProblem(email) {
  if (!email) return "Please enter your email address.";
  const ok = email.length <= 254 && !email.includes("..") && /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/.test(email);
  return ok ? null : "Please enter a real email address, like name@example.com.";
}

export function passwordProblem(password) {
  if (password.length < 8) return "Your password needs at least 8 characters.";
  if (password.length > 64) return "Your password can be 64 characters at most.";
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) return "Your password needs at least one letter and one number.";
  return null;
}

export function usernameProblem(username) {
  return /^[A-Za-z0-9_]{3,16}$/.test(username) ? null : "Usernames are 3 to 16 letters, numbers, or underscores (_).";
}

// How strong a password looks, 0-3, for the meter under the box.
export function passwordStrength(password) {
  if (passwordProblem(password)) return 0;
  let score = 1;
  if (password.length >= 12) score++;
  if (/[^A-Za-z0-9]/.test(password) || (/[a-z]/.test(password) && /[A-Z]/.test(password))) score++;
  return score;
}

// POST to the account server. Throws { offline: true } if it can't be reached
// (the game was opened without serve.py, say).
async function call(action, body) {
  let res;
  try {
    res = await fetch(`/api/account/${action}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  } catch {
    throw { offline: true };
  }
  if (!res.ok) throw { offline: true };
  try {
    return await res.json();
  } catch {
    throw { offline: true };
  }
}

export async function signUp({ username, email, password, agree, agreement }) {
  const out = await call("signup", { username, email, password, agree, agreement });
  if (out.token) setSession({ token: out.token, user: out.user });
  return out;
}

export async function logIn({ email, password }) {
  const out = await call("login", { email, password });
  if (out.token) setSession({ token: out.token, user: out.user });
  return out;
}

// Is the saved session still good? Returns the user, or null. Offline, a
// saved session is trusted, so you can keep playing without the server.
export async function checkSession() {
  const s = session();
  if (!s?.token) return null;
  try {
    const out = await call("me", { token: s.token });
    if (!out.user) {
      setSession(null);
      return null;
    }
    setSession({ token: s.token, user: out.user });
    return out.user;
  } catch {
    return s.user || null;
  }
}

export async function logOut() {
  const s = session();
  setSession(null);
  if (s?.token) await call("logout", { token: s.token }).catch(() => {});
}

export async function deleteAccount(password) {
  const s = session();
  const out = await call("delete", { token: s?.token, password });
  if (out.ok) setSession(null);
  return out;
}
