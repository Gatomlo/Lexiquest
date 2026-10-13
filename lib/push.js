'use strict';
/* Notifications push (Web Push, clés VAPID). Fonctionne sur Android et sur iPhone une fois l'application installée (iOS 16.4 ou plus). */
const webpush = require('./webpush');
const Kv = require('./kv');

let sender = null;

/** pour les tests : remplace l'envoi réel */
function setSender(fn) { sender = fn; }

function vapidKeys(db) {
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) { return { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY }; }
  const row = db.prepare("SELECT value FROM kv WHERE key = 'vapid'").get();
  if (row) { return JSON.parse(row.value); }
  const keys = webpush.generateKeys();
  db.prepare("INSERT INTO kv (key, value) VALUES ('vapid', ?)").run(JSON.stringify(keys));
  return keys;
}
function publicKey(db) { return vapidKeys(db).publicKey; }

function validSubscription(sub) {
  return !!sub && typeof sub.endpoint === 'string' && /^https:\/\/[^\s]{10,1000}$/.test(sub.endpoint)
    && sub.keys && typeof sub.keys.p256dh === 'string' && typeof sub.keys.auth === 'string' && sub.keys.p256dh.length < 200 && sub.keys.auth.length < 100;
}

function subscribe(db, userId, sub) {
  if (!validSubscription(sub)) { return false; }
  db.prepare(`INSERT INTO push_subs (endpoint, user_id, p256dh, auth, created_at) VALUES (?,?,?,?,?)
    ON CONFLICT(endpoint) DO UPDATE SET user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth`)
    .run(sub.endpoint, userId, sub.keys.p256dh, sub.keys.auth, Date.now());
  return true;
}
function unsubscribe(db, userId, endpoint) { db.prepare('DELETE FROM push_subs WHERE endpoint = ? AND user_id = ?').run(String(endpoint || ''), userId); }
const countSubs = (db, userId) => Number(db.prepare('SELECT COUNT(*) AS n FROM push_subs WHERE user_id = ?').get(userId).n);

async function realSend(db, row, payload) {
  // contact exigé par les services de notification : l'adresse du site, retenue à la première inscription
  const subject = process.env.VAPID_SUBJECT || Kv.get(db, 'origin') || 'https://localhost';
  return webpush.send({ endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } }, payload, { keys: vapidKeys(db), subject });
}

/** envoie à tous les appareils de l'utilisateur ; retire ceux qui n'existent plus (404 / 410) ; renvoie le nombre d'envois réussis */
async function notifyUser(db, userId, payload) {
  const rows = db.prepare('SELECT * FROM push_subs WHERE user_id = ?').all(userId);
  let ok = 0;
  for (const r of rows) {
    try { await (sender ? sender(r, payload) : realSend(db, r, payload)); ok++; }
    catch (e) {
      if (e && (e.statusCode === 404 || e.statusCode === 410)) { db.prepare('DELETE FROM push_subs WHERE endpoint = ?').run(r.endpoint); }
      else { console.error('push :', e && e.message ? e.message : e); }
    }
  }
  return ok;
}

module.exports = { setSender, publicKey, validSubscription, subscribe, unsubscribe, countSubs, notifyUser };
