'use strict';
/* Petites valeurs de configuration gardées dans la base : l'application n'a besoin d'aucune variable d'environnement. */
const crypto = require('node:crypto');

const get = (db, key) => { const r = db.prepare('SELECT value FROM kv WHERE key = ?').get(key); return r ? r.value : null; };
const set = (db, key, value) => db.prepare('INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, String(value));
/** valeur secrète tirée au hasard la première fois, puis conservée */
function secret(db, key) {
  let v = get(db, key);
  if (!v) { v = crypto.randomBytes(32).toString('hex'); db.prepare('INSERT OR IGNORE INTO kv (key, value) VALUES (?, ?)').run(key, v); v = get(db, key); }
  return v;
}
module.exports = { get, set, secret };
