// The SignQuest user agreement, shown from the log-in page (login.js).
// Written so kids can read it. If it changes, bump AGREEMENT_VERSION here and
// in accounts.py, so everyone agrees to the new one.

export const AGREEMENT_VERSION = 1;
export const AGREEMENT_UPDATED = "October 2026";

export const AGREEMENT_HTML = `
<p><b>Welcome to SignQuest!</b> SignQuest is a game for learning American Sign Language (ASL). Please read this before you make an account. By making an account, you agree to it.</p>

<h3>1. Who can play</h3>
<p>Anyone can play. If you're under 13, please ask a parent or guardian to read this with you and say it's okay before you make an account.</p>

<h3>2. Your account</h3>
<ul>
  <li>You need an email address, a username, and a password.</li>
  <li>Use your own email, or a parent's with their permission.</li>
  <li>Pick a username that isn't your full real name, and isn't mean or rude.</li>
  <li>Keep your password secret. Don't share it, even with friends.</li>
  <li>You're responsible for what happens on your account.</li>
</ul>

<h3>3. What we keep, and what we don't</h3>
<ul>
  <li><b>We keep:</b> your email, your username, and when you made your account. Your password is scrambled (hashed) before it's saved, so nobody can read it, not even us.</li>
  <li><b>Your game progress</b> (levels, coins, creatures) is saved in your browser on your device.</li>
  <li><b>Your camera never leaves your device.</b> SignQuest reads your hand signs right on your computer. No video or pictures are ever saved or sent anywhere.</li>
  <li>We never sell your information or show you ads.</li>
</ul>

<h3>4. Playing with others</h3>
<ul>
  <li>In the Battle Arena, other players can see your username, your hero, and your rank.</li>
  <li>Be kind. No bullying, cheating, or pretending to be someone else.</li>
  <li>Signing is a real language used by Deaf people every day. Treat it, and everyone who signs, with respect.</li>
</ul>

<h3>5. SignQuest is a learning game</h3>
<p>SignQuest helps you practice ASL letters and words, but it isn't a full ASL class, and the camera can make mistakes. To really learn ASL, learn from Deaf teachers and the Deaf community too!</p>

<h3>6. Leaving</h3>
<p>You can log out anytime, and you can delete your account in ⚙️ Settings. Deleting it erases your email, username, and password from SignQuest for good.</p>

<h3>7. Changes</h3>
<p>If this agreement changes, we'll ask you to read and agree to the new one.</p>

<p class="small-text">SignQuest is a student project. Last updated ${AGREEMENT_UPDATED}.</p>
`;
