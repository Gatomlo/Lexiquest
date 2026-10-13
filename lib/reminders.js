'use strict';
/* Rappels : un par jour et par personne, à l'heure choisie, seulement si utile. */
const clock = require('./clock');
const C = require('./config');
const { settingsOf } = require('./users');
const P = require('./progress');
const Pets = require('./pets');
const Push = require('./push');

const WINDOW_MIN = 120; // un rappel manqué (serveur arrêté) part avec au plus 2 h de retard

function studentMessage(db, user) {
  const pet = Pets.view(db, user), B = P.bossStatus(db, user.id);
  if (pet.ko) { return { title: `${pet.name} est à terre`, body: `Une séance de 5 minutes te rapporte de quoi le relever (${C.RES_PRICE} gemmes).` }; }
  if (!B.won && B.left <= 1) { return { title: 'Dernier jour pour le Gardien', body: `Vaincs-le avant ce soir minuit pour éviter que ${pet.name} perde de la vie.` }; }
  if (pet.lvl >= 2) { return { title: `${pet.name} a besoin de toi`, body: 'Une séance de 5 minutes et quelques gemmes pour le soigner ?' }; }
  return { title: 'Une séance de 5 minutes ?', body: `${pet.name} t’attend.` };
}

function parentMessage(db, parent) {
  const out = [];
  for (const s of db.prepare("SELECT * FROM users WHERE parent_id = ? AND role = 'student' AND active = 1").all(parent.id)) {
    const last = db.prepare('SELECT ended_at FROM sessions WHERE user_id = ? AND done = 1 ORDER BY ended_at DESC LIMIT 1').get(s.id);
    const gone = clock.dayIdx() - (last ? P.dayOfMs(last.ended_at) : P.dayOfMs(s.created_at));
    if (gone >= 2) { out.push(`${s.display} n’a pas joué depuis ${gone} jours.`); }
  }
  return out.length ? { title: 'Lexiquest', body: out.join(' ') } : null;
}

/** envoie les rappels dus ; renvoie [{ userId, title }] */
async function run(db) {
  const now = clock.now(), minutes = now.getHours() * 60 + now.getMinutes(), today = clock.dayIdx(), sent = [];
  const users = db.prepare('SELECT * FROM users WHERE active = 1 AND id IN (SELECT user_id FROM push_subs)').all();
  for (const u of users) {
    const set = settingsOf(db, u.id);
    if (!set.remind) { continue; }
    const [h, m] = set.remindAt.split(':').map(Number), at = h * 60 + m;
    if (minutes < at || minutes > at + WINDOW_MIN) { continue; }
    const key = 'remind:' + u.id, last = db.prepare('SELECT value FROM kv WHERE key = ?').get(key);
    if (last && Number(last.value) === today) { continue; }
    let msg = null;
    if (u.role === 'student') { if (P.playedDays(db, u.id).has(today)) { continue; } msg = studentMessage(db, u); }
    else { msg = parentMessage(db, u); }
    if (!msg) { continue; }
    if (await Push.notifyUser(db, u.id, { ...msg, url: u.role === 'parent' ? 'parent' : './', tag: 'lexiquest-rappel' })) {
      db.prepare('INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, String(today));
      sent.push({ userId: u.id, title: msg.title });
    }
  }
  return sent;
}

/** vérifie chaque minute (désactivable : REMINDERS=off, par exemple si un cron externe appelle /api/cron/reminders) */
function start(db) {
  if (process.env.REMINDERS === 'off') { return null; }
  const t = setInterval(() => { run(db).catch((e) => console.error('rappels :', e)); }, 60000);
  t.unref();
  return t;
}

module.exports = { run, start, studentMessage, parentMessage };
