'use strict';
/* Sessions de connexion : cookie signé (HMAC) + table http_sessions. Remplace express-session (moins de dépendances). */
const crypto = require('node:crypto');

const NAME = 'lexiquest.sid';
const LIFETIME = 30 * 864e5;
const SHORT = 12 * 36e5; // sans « Garder la connexion » : cookie de session, valable 12 h au plus
const RENEW_AFTER = 36e5; // la durée est prolongée au plus une fois par heure : pas d'écriture à chaque requête

const sign = (secret, sid) => crypto.createHmac('sha256', secret).update(sid).digest('base64url');
function parseCookies(header) {
  const out = {};
  for (const part of String(header || '').split(';')) { const i = part.indexOf('='); if (i > 0) { out[part.slice(0, i).trim()] = part.slice(i + 1).trim(); } }
  return out;
}
function equal(a, b) { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && crypto.timingSafeEqual(x, y); }

function sessions(db, secret) {
  const get = (sid) => db.prepare('SELECT sess, expires FROM http_sessions WHERE sid = ?').get(sid);
  const life = (data) => (data.remember === false ? SHORT : LIFETIME);
  const put = (sid, data) => db.prepare('INSERT INTO http_sessions (sid, sess, expires) VALUES (?,?,?) ON CONFLICT(sid) DO UPDATE SET sess = excluded.sess, expires = excluded.expires').run(sid, JSON.stringify(data), Date.now() + life(data));
  let lastPurge = 0;

  return function sessionMiddleware(req, res, next) {
    const path = req.baseUrl || '/';
    const cookie = (value, maxAge) => `${NAME}=${value}; Path=${path}; HttpOnly; SameSite=Lax${maxAge === null ? '' : '; Max-Age=' + maxAge}${req.secure ? '; Secure' : ''}`;
    let sid = null, data = {}, renewedAt = 0;
    const raw = parseCookies(req.headers.cookie)[NAME];
    if (raw && raw.includes('.')) {
      const [id, sig] = [raw.slice(0, raw.lastIndexOf('.')), raw.slice(raw.lastIndexOf('.') + 1)];
      if (equal(sig, sign(secret, id))) {
        const row = get(id);
        if (row && row.expires > Date.now()) { sid = id; try { data = JSON.parse(row.sess); } catch (e) { data = {}; } renewedAt = row.expires - life(data); }
      }
    }
    const give = (id) => res.append('Set-Cookie', cookie(id + '.' + sign(secret, id), data.remember === false ? null : Math.floor(LIFETIME / 1000)));
    const s = { };
    Object.defineProperty(s, 'userId', { enumerable: true, get: () => data.userId, set: (v) => { data.userId = v; } });
    /** aperçu « comme l'élève » : identifiant du parent à retrouver au retour (absent en usage normal) */
    Object.defineProperty(s, 'viewAs', { enumerable: true, get: () => data.viewAs, set: (v) => { if (v === undefined || v === null) { delete data.viewAs; } else { data.viewAs = v; } } });
    /** « Garder la connexion » : false = cookie de session, expire à la fermeture du navigateur (ou après 12 h) */
    Object.defineProperty(s, 'remember', { enumerable: true, get: () => data.remember !== false, set: (v) => { if (v === false) { data.remember = false; } else { delete data.remember; } if (sid && !res.headersSent) { give(sid); } } });
    /** nouvelle session (après connexion : évite la fixation de session) */
    s.regenerate = (cb) => {
      try {
        if (sid) { db.prepare('DELETE FROM http_sessions WHERE sid = ?').run(sid); }
        sid = crypto.randomBytes(24).toString('base64url'); data = {}; renewedAt = Date.now();
        put(sid, data); give(sid);
        cb();
      } catch (e) { cb(e); }
    };
    s.destroy = (cb) => {
      try { if (sid) { db.prepare('DELETE FROM http_sessions WHERE sid = ?').run(sid); } sid = null; data = {}; cb(); } catch (e) { cb(e); }
    };
    s.save = () => { if (sid) { put(sid, data); } };
    req.session = s;

    // enregistre les changements (ex. userId posé après regenerate) et prolonge la durée de temps en temps
    const end = res.end;
    res.end = function (...args) {
      try {
        if (sid) {
          put(sid, data);
          if (Date.now() - renewedAt > RENEW_AFTER && !res.headersSent) { give(sid); }
        }
      } catch (e) { console.error('session :', e.message); }
      if (Date.now() - lastPurge > 36e5) { lastPurge = Date.now(); try { db.prepare('DELETE FROM http_sessions WHERE expires < ?').run(Date.now()); } catch (e) { /* tant pis */ } }
      return end.apply(this, args);
    };
    res.clearCookie = (name, opts) => res.append('Set-Cookie', `${name}=; Path=${(opts && opts.path) || path}; HttpOnly; SameSite=Lax; Max-Age=0`);
    next();
  };
}
module.exports = { sessions, NAME };
