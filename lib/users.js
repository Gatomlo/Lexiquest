'use strict';
const Password = require('./password');
const clock = require('./clock');
const { DEFAULT_SETTINGS } = require('./config');
const { tx } = require('./db');

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function createUser(db, { username, display, role, password, parentId = null }) {
  username = String(username || '').trim();
  display = String(display || '').trim();
  if (!/^[a-z0-9._-]{2,32}$/i.test(username)) { throw new HttpError(400, 'Identifiant invalide (2 à 32 caractères : lettres, chiffres, . _ -).'); }
  if (!display) { throw new HttpError(400, 'Nom affiché requis.'); }
  if (!['student', 'parent'].includes(role)) { throw new HttpError(400, 'Rôle invalide.'); }
  if (String(password || '').length < 8) { throw new HttpError(400, 'Mot de passe : 8 caractères minimum.'); }
  if (db.prepare('SELECT 1 FROM users WHERE username = ?').get(username)) { throw new HttpError(409, 'Cet identifiant existe déjà.'); }
  const hash = Password.hash(password);
  const seed = Math.floor(Math.random() * 2 ** 31);
  const now = clock.nowMs();
  return tx(db, () => {
    const id = Number(db.prepare('INSERT INTO users (username, display, role, hash, parent_id, pet_seed, created_at) VALUES (?,?,?,?,?,?,?)')
      .run(username, display, role, hash, parentId, seed, now).lastInsertRowid);
    if (role === 'student') {
      db.prepare('INSERT INTO user_pets (user_id, species, food, care, joy, anchor_hour, active, adopted_at) VALUES (?,?,?,?,?,?,1,?)')
        .run(id, 'phenix', 80, 80, 80, clock.hourOf(new Date(now)), now);
    }
    return id;
  });
}

function getUser(db, id) { return db.prepare('SELECT * FROM users WHERE id = ? AND active = 1').get(id) || null; }

function checkLogin(db, username, password) {
  const u = db.prepare('SELECT * FROM users WHERE username = ? AND active = 1').get(String(username || '').trim());
  // comparaison faite même sans compte, pour ne pas révéler son existence par le temps de réponse
  return u && Password.verify(password, u.hash) ? u : (Password.verify(password, ''), null); // même travail si le compte n'existe pas
}

function setPassword(db, userId, password) {
  if (String(password || '').length < 8) { throw new HttpError(400, 'Mot de passe : 8 caractères minimum.'); }
  db.prepare('UPDATE users SET hash = ? WHERE id = ?').run(Password.hash(password), userId);
}

function settingsOf(db, userId) {
  const out = { ...DEFAULT_SETTINGS };
  for (const r of db.prepare('SELECT key, value FROM settings WHERE user_id = ?').all(userId)) {
    if (r.key in out) { try { out[r.key] = JSON.parse(r.value); } catch (_) { /* valeur ignorée */ } }
  }
  return out;
}

function setSettings(db, userId, patch) {
  const cur = settingsOf(db, userId), next = {};
  if ('accents' in patch) { next.accents = !!patch.accents; }
  if ('articles' in patch) { next.articles = !!patch.articles; }
  if ('goalDays' in patch) { next.goalDays = Math.max(1, Math.min(7, Math.round(+patch.goalDays) || cur.goalDays)); }
  if ('remind' in patch) { next.remind = !!patch.remind; }
  if ('remindAt' in patch) { const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(patch.remindAt)); if (!m) { throw new HttpError(400, 'Heure invalide (HH:MM).'); } next.remindAt = m[0]; }
  for (const [k, [lo, hi]] of Object.entries(require('./rules').LIMITS)) {
    if (k in patch) { const v = Math.round(+patch[k]); if (!Number.isFinite(v)) { throw new HttpError(400, 'Valeur invalide.'); } next[k] = Math.max(lo, Math.min(hi, v)); }
  }
  if ('goalMin' in patch) { next.goalMin = Math.max(1, Math.min(60, Math.round(+patch.goalMin) || cur.goalMin)); }
  const st = db.prepare('INSERT INTO settings (user_id, key, value) VALUES (?,?,?) ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value');
  for (const [k, v] of Object.entries(next)) { st.run(userId, k, JSON.stringify(v)); }
  return settingsOf(db, userId);
}

function balance(db, userId) {
  return Number(db.prepare('SELECT COALESCE(SUM(delta), 0) AS b FROM gem_events WHERE user_id = ?').get(userId).b);
}
function addGems(db, userId, delta, reason, sessionId = null, at = null) {
  if (!delta) { return; }
  db.prepare('INSERT INTO gem_events (user_id, delta, reason, session_id, at) VALUES (?,?,?,?,?)').run(userId, delta, reason, sessionId, at || clock.nowMs());
}

module.exports = { HttpError, createUser, getUser, checkLogin, setPassword, settingsOf, setSettings, balance, addGems };
