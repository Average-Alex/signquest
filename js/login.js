// The log-in page: log in with your email and password, or sign up with a
// username too (after agreeing to the user agreement). Also the account part
// of Settings: log out, or delete your account. See account.js.
//
// Logging in, signing up, and logging out reload the page, so the game
// starts fresh with the right account's save (progress.js).

import {
  currentUser, deleteAccount, emailProblem, logIn, logOut, passwordProblem, passwordStrength, saveKey, signUp, usernameProblem,
} from "./account.js";
import { AGREEMENT_HTML, AGREEMENT_VERSION } from "./agreement.js";
import { announce } from "./screens.js";

const $ = (id) => document.getElementById(id);
let mode = "login"; // or "signup"
let tried = false; // show what's wrong as you type only after the first try

function setMode(next) {
  mode = next;
  tried = false;
  const signup = mode === "signup";
  $("tab-login").classList.toggle("on", !signup);
  $("tab-signup").classList.toggle("on", signup);
  $("tab-login").setAttribute("aria-selected", String(!signup));
  $("tab-signup").setAttribute("aria-selected", String(signup));
  $("field-username").hidden = !signup;
  $("field-signup").hidden = !signup;
  $("strength").hidden = !signup;
  $("auth-password").autocomplete = signup ? "new-password" : "current-password";
  $("auth-submit").textContent = signup ? "Make my account ▶" : "Log in ▶";
  $("auth-switch-text").textContent = signup ? "Already have an account?" : "New here?";
  $("auth-switch").textContent = signup ? "Log in" : "Make an account";
  $("auth-error").hidden = true;
  for (const id of ["hint-username", "hint-email", "hint-password", "hint-confirm", "hint-agree"]) hint(id, null);
  (signup ? $("auth-username") : $("auth-email")).focus();
}

function hint(id, text, good = false) {
  const el = $(id);
  el.textContent = text || "";
  el.className = `field-hint${text ? (good ? " good" : " bad") : ""}`;
}

// What's wrong with the form, field by field (null when it's fine).
function problems() {
  const email = $("auth-email").value.trim();
  const password = $("auth-password").value;
  if (mode === "login") {
    return { email: emailProblem(email), password: password ? null : "Please enter your password." };
  }
  return {
    username: usernameProblem($("auth-username").value.trim()),
    email: emailProblem(email),
    password: passwordProblem(password),
    confirm: $("auth-confirm").value === password ? null : "The two passwords don't match.",
    agree: $("auth-agree").checked ? null : "Please read and agree to the User Agreement.",
  };
}

function showProblems() {
  const p = problems();
  const signup = mode === "signup";
  if (signup) hint("hint-username", p.username || (tried ? "Looks good!" : ""), !p.username);
  hint("hint-email", tried ? p.email : null);
  if (signup) {
    const password = $("auth-password").value;
    const strength = passwordStrength(password);
    $("strength-bar").style.width = `${(password ? Math.max(1, strength) : 0) * 33.4}%`;
    $("strength-bar").className = `s${strength}`;
    hint("hint-password", p.password || ["", "Okay password.", "Good password!", "Strong password!"][strength], !p.password);
    hint("hint-confirm", tried || $("auth-confirm").value ? p.confirm : null);
    hint("hint-agree", tried ? p.agree : null);
  } else hint("hint-password", tried ? p.password : null);
  return p;
}

async function submit(e) {
  e.preventDefault();
  tried = true;
  const p = showProblems();
  const firstBad = Object.entries(p).find(([, v]) => v);
  if (firstBad) {
    const field = { username: "auth-username", email: "auth-email", password: "auth-password", confirm: "auth-confirm", agree: "auth-agree" }[firstBad[0]];
    $(field).focus();
    announce(firstBad[1]);
    return;
  }
  const button = $("auth-submit");
  const label = button.textContent;
  button.disabled = true;
  button.textContent = mode === "signup" ? "Making your account…" : "Logging in…";
  $("auth-error").hidden = true;
  try {
    const email = $("auth-email").value.trim();
    const password = $("auth-password").value;
    const out = mode === "signup"
      ? await signUp({ username: $("auth-username").value.trim(), email, password, agree: true, agreement: AGREEMENT_VERSION })
      : await logIn({ email, password });
    if (out.error) throw new Error(out.error);
    button.textContent = "Welcome! ✨";
    location.reload(); // start fresh with this account's save
  } catch (err) {
    button.disabled = false;
    button.textContent = label;
    const offline = err?.offline;
    $("auth-error").textContent = offline ? "Can't reach the SignQuest server. Is serve.py running?" : err.message;
    $("auth-error").hidden = false;
    $("auth-guest").hidden = !offline;
    announce($("auth-error").textContent);
  }
}

// The user agreement, in a pop-up.
let returnFocus = null;
function openAgreement() {
  returnFocus = document.activeElement;
  $("agreement-text").innerHTML = AGREEMENT_HTML;
  $("agreement-accept").hidden = mode !== "signup" || $("screen-login").hidden;
  $("agreement").hidden = false;
  $("agreement-text").scrollTop = 0;
  $("agreement-text").focus();
}
function closeAgreement() {
  $("agreement").hidden = true;
  returnFocus?.focus();
}

export function initLogin({ onGuest }) {
  $("tab-login").onclick = () => setMode("login");
  $("tab-signup").onclick = () => setMode("signup");
  $("auth-switch").onclick = () => setMode(mode === "login" ? "signup" : "login");
  $("auth-form").onsubmit = submit;
  for (const id of ["auth-username", "auth-email", "auth-password", "auth-confirm", "auth-agree"]) $(id).addEventListener("input", showProblems);
  $("show-password").onclick = () => {
    const showing = $("auth-password").type === "text";
    for (const id of ["auth-password", "auth-confirm"]) $(id).type = showing ? "password" : "text";
    $("show-password").textContent = showing ? "👁️ Show" : "🙈 Hide";
    $("show-password").setAttribute("aria-pressed", String(!showing));
  };
  $("open-agreement").onclick = openAgreement;
  $("open-agreement-2").onclick = openAgreement;
  $("agreement-close").onclick = closeAgreement;
  $("agreement-accept").onclick = () => {
    $("auth-agree").checked = true;
    showProblems();
    closeAgreement();
  };
  $("agreement").addEventListener("keydown", (e) => e.key === "Escape" && closeAgreement());
  $("auth-guest").onclick = onGuest;
  initAccountSettings();
}

export function showLogin() {
  setMode("login");
}

// ⚙️ Settings: who's logged in, log out, delete the account.
function initAccountSettings() {
  const user = currentUser();
  $("account-box").hidden = !user;
  if (!user) return;
  $("account-who").innerHTML = `👤 Logged in as <b></b> <span class="small-text"></span>`;
  $("account-who").querySelector("b").textContent = user.username;
  $("account-who").querySelector("span").textContent = `(${user.email})`;
  $("logout-btn").onclick = async () => {
    await logOut();
    location.reload();
  };
  $("delete-account").onclick = () => {
    $("delete-box").hidden = false;
    $("delete-password").focus();
  };
  $("delete-confirm").onclick = async () => {
    $("delete-error").hidden = true;
    try {
      const key = saveKey();
      const out = await deleteAccount($("delete-password").value);
      if (out.error) throw new Error(out.error);
      try {
        localStorage.removeItem(key); // their save on this device too
      } catch {
        // nothing to erase
      }
      location.reload();
    } catch (err) {
      $("delete-error").textContent = err?.offline ? "Can't reach the SignQuest server right now." : err.message;
      $("delete-error").hidden = false;
    }
  };
}
