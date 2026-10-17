'use strict';
/* Progression de l'élève, recalculée depuis les séances terminées : Gardien, rotation, série, bons. */
const clock = require('./clock');
const { ROT, ORDER, VOUCH, STAGES } = require('./config');
const { HttpError, addGems, settingsOf } = require('./users');
const { tx } = require('./db');

const dayOfMs = (ms) => clock.dayIdx(new Date(ms));

function finishedSessions(db, userId) {
  return db.prepare('SELECT id, game, lang, win, ended_at, active_sec FROM sessions WHERE user_id = ? AND done = 1 ORDER BY id').all(userId);
}

/* ---------- Gardien hebdomadaire ---------- */
function bossWins(db, userId) {
  return db.prepare("SELECT lang, ended_at FROM sessions WHERE user_id = ? AND done = 1 AND game = 'boss' AND win = 1 ORDER BY ended_at").all(userId)
    .map((r) => ({ lang: r.lang, day: dayOfMs(r.ended_at) }));
}
const winIn = (wins, ws) => wins.find((w) => w.day >= ws && w.day <= ws + 6) || null;
function bossBan(wins, ws) {
  const a = winIn(wins, ws - 7), b = winIn(wins, ws - 14);
  return a && b && a.lang === b.lang ? a.lang : null;
}
function bossStatus(db, userId, wins) {
  wins = wins || bossWins(db, userId);
  const t = clock.dayIdx(), ws = clock.weekStart(t), w = winIn(wins, ws);
  return { ws, won: !!w, wonLang: w ? w.lang : null, ban: bossBan(wins, ws), left: ws + 6 - t };
}
const wonWeeks = (wins) => new Set(wins.map((w) => clock.weekStart(w.day)));

/* ---------- rotation des jeux ---------- */
function replayRotation(sessions, rules = ROT) {
  const rot = {};
  for (const g of ORDER) { if (g !== 'boss') { rot[g] = { n: 0, locked: false, seen: [] }; } }
  for (const s of sessions) {
    const g = s.game;
    if (g !== 'boss' && rot[g]) { const r = rot[g]; r.n++; if (r.n >= rules.max) { r.locked = true; r.seen = []; } }
    for (const h of Object.keys(rot)) {
      const r = rot[h];
      if (h !== g && r.locked && !r.seen.includes(g)) {
        r.seen.push(g);
        if (r.seen.length >= rules.need) { r.locked = false; r.n = 0; r.seen = []; }
      }
    }
  }
  return rot;
}
const rotationOf = (db, userId) => { const s = settingsOf(db, userId); return replayRotation(finishedSessions(db, userId), { max: s.rotMax, need: s.rotNeed }); };

/* ---------- jours joués, série, bons ---------- */
function playedDays(db, userId) {
  return new Set(finishedSessions(db, userId).map((s) => dayOfMs(s.ended_at)));
}
function streakOf(days) {
  const t = clock.dayIdx();
  let i = days.has(t) ? t : t - 1, c = 0;
  while (days.has(i) && c < 3650) { c++; i--; }
  return { count: c, start: c ? i + 1 : null };
}
function vouchersOf(db, userId, days) {
  days = days || playedDays(db, userId);
  const st = streakOf(days);
  const got = new Set(db.prepare('SELECT tier, streak_start FROM vouchers WHERE user_id = ?').all(userId).map((v) => v.tier + ':' + v.streak_start));
  return VOUCH.map((v) => {
    const claimed = st.count >= v.d && got.has(v.d + ':' + st.start);
    return { d: v.d, p: v.p, claimed, can: st.count >= v.d && !claimed };
  });
}
function claimVoucher(db, userId, tier) {
  const v = VOUCH.find((x) => x.d === tier);
  if (!v) { throw new HttpError(400, 'Palier inconnu.'); }
  return tx(db, () => {
    const st = streakOf(playedDays(db, userId));
    if (st.count < tier) { throw new HttpError(409, 'Série trop courte pour ce bon.'); }
    const r = db.prepare('INSERT OR IGNORE INTO vouchers (user_id, tier, streak_start, claimed_at) VALUES (?,?,?,?)').run(userId, tier, st.start, clock.nowMs());
    if (!r.changes) { throw new HttpError(409, 'Bon déjà encaissé.'); }
    addGems(db, userId, v.p, 'voucher:' + tier);
    return v.p;
  });
}
/** le bon du jour a-t-il déjà été versé pour ce jour (index de jour local) ? */
const dailyOn = (db, userId, dayIdx) => !!db.prepare("SELECT 1 FROM gem_events WHERE user_id = ? AND reason = 'daily' AND at >= ? AND at < ? LIMIT 1").get(userId, clock.dayStartMs(dayIdx), clock.dayStartMs(dayIdx + 1));

/** stade de croissance (0 bébé … 3 adulte) selon le nombre de jours de présence du compagnon */
function stageOf(n) { let st = 0; STAGES.forEach((s, i) => { if (n >= s.min) { st = i; } }); return st; }
const petDays = (db, userId, species) => db.prepare('SELECT COUNT(*) n FROM pet_days WHERE user_id = ? AND species = ?').get(userId, species).n;

module.exports = {
  dayOfMs, finishedSessions, bossWins, bossStatus, bossBan, winIn, wonWeeks,
  replayRotation, rotationOf, playedDays, streakOf, vouchersOf, claimVoucher, dailyOn, stageOf, petDays,
};
