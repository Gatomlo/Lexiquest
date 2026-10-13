'use strict';
/* Compagnon : simulation heure par heure à la lecture (pas de tâche planifiée). */
const clock = require('./clock');
const C = require('./config');
const { HttpError, balance, addGems } = require('./users');
const { tx } = require('./db');
const P = require('./progress');

function mulberry(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** événements aléatoires : un tous les 24 à 72 h, tirés d'une graine propre à l'élève (même heure = même événement) */
function eventSchedule(seed, originHour, toHour) {
  const r = mulberry(seed), out = new Map();
  let h = originHour;
  while (true) {
    h += 24 + Math.floor(r() * 49);
    const id = C.EVT_IDS[Math.floor(r() * C.EVT_IDS.length)];
    if (h > toHour) { break; }
    out.set(h, id);
  }
  return out;
}

const isNight = (hr) => hr >= C.NIGHT.from || hr < C.NIGHT.to;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const MAX_HOURS = 24 * 400;

/** rejoue les heures écoulées depuis l'ancre ; à 0 de vie tout se fige */
function simulate(row, ctx) {
  const { seed, createdHour, wins, createdWeek, nowHour } = ctx;
  const o = { food: row.food, care: row.care, joy: row.joy, hours: 0, hits: [], evts: [], ko: false };
  if (row.care > 0) {
    o.hours = Math.max(0, nowHour - row.anchor_hour);
    const from = Math.max(row.anchor_hour, nowHour - MAX_HOURS);
    const sched = eventSchedule(seed, createdHour, nowHour), won = P.wonWeeks(wins);
    for (let h = from + 1; h <= nowHour && o.care > 0; h++) {
      const d = new Date(h * 36e5), f = isNight(new Date((h - 1) * 36e5).getHours()) ? C.NIGHT.f : 1;
      o.food = Math.max(0, o.food - C.RATE.food * f);
      o.joy = Math.max(0, o.joy - C.RATE.joy * f);
      if (o.food < C.LOW) { o.care -= C.RATE.care * f; }
      if (o.joy < C.LOW) { o.care -= C.RATE.care * f; }
      if (d.getDay() === 1 && d.getHours() === 0) {
        const prev = clock.dayIdx(d) - 7;
        if (prev >= createdWeek && !won.has(prev)) { o.hits.push(h); o.care -= C.BOSS.penCare; o.joy -= C.BOSS.penJoy; }
      }
      const e = sched.get(h);
      if (e && o.care > 0) { const E = C.EVTS[e]; o[E.k] += E.v; o.evts.push({ hour: h, id: e }); }
      for (const k of C.GAUGES) { o[k] = clamp(o[k], 0, 100); }
    }
  }
  o.days = Math.floor(o.hours / 24);
  o.ko = o.care <= 0;
  o.avg = (o.food + o.care + o.joy) / 3;
  o.lvl = o.ko ? 4 : o.avg >= 65 ? 0 : o.avg >= 45 ? 1 : o.avg >= 25 ? 2 : 3;
  o.low = C.GAUGES.slice().sort((a, b) => o[a] - o[b])[0];
  return o;
}

function context(db, user) {
  const wins = P.bossWins(db, user.id);
  return {
    seed: user.pet_seed, createdHour: clock.hourOf(new Date(user.created_at)), wins,
    createdWeek: clock.weekStart(clock.dayIdx(new Date(user.created_at))), nowHour: clock.hourNow(),
  };
}
const activeRow = (db, userId) => db.prepare('SELECT * FROM user_pets WHERE user_id = ? AND active = 1').get(userId);

/** fige l'état courant du compagnon actif dans la base et consigne son journal */
function materialize(db, user) {
  const row = activeRow(db, user.id);
  const n = simulate(row, context(db, user));
  const ins = db.prepare('INSERT INTO pet_events (user_id, species, hour, type, ref, gauge, delta) VALUES (?,?,?,?,?,?,?)');
  for (const e of n.evts) { ins.run(user.id, row.species, e.hour, 'event', e.id, C.EVTS[e.id].k, C.EVTS[e.id].v); }
  for (const h of n.hits) { ins.run(user.id, row.species, h, 'boss', null, 'care', -C.BOSS.penCare); }
  if (n.ko && row.care > 0) { ins.run(user.id, row.species, clock.hourNow(), 'ko', null, 'care', null); }
  db.prepare('UPDATE user_pets SET food = ?, care = ?, joy = ?, anchor_hour = ? WHERE user_id = ? AND species = ?')
    .run(n.food, n.care, n.joy, clock.hourNow(), user.id, row.species);
  return n;
}

function lastEventOf(db, userId, n) {
  if (n.evts.length) { const e = n.evts[n.evts.length - 1]; return { hour: e.hour, id: e.id }; }
  const r = db.prepare("SELECT hour, ref FROM pet_events WHERE user_id = ? AND type = 'event' ORDER BY hour DESC LIMIT 1").get(userId);
  return r ? { hour: r.hour, id: r.ref } : null;
}

/** vue du compagnon actif et de la collection (lecture seule) */
function view(db, user, days) {
  const rows = db.prepare('SELECT * FROM user_pets WHERE user_id = ? ORDER BY adopted_at').all(user.id);
  const act = rows.find((r) => r.active), n = simulate(act, context(db, user));
  const ev = lastEventOf(db, user.id, n);
  days = days || P.playedDays(db, user.id);
  const sp = C.PETS[act.species];
  return {
    id: act.species, name: sp.n, kind: sp.k, stage: P.stageOf(days),
    food: n.food, care: n.care, joy: n.joy, lvl: n.lvl, ko: n.ko, low: n.low, hours: n.hours, days: n.days, hits: n.hits.length,
    lastEvent: ev ? { id: ev.id, hoursAgo: clock.hourNow() - ev.hour, text: C.EVTS[ev.id].t, gauge: C.EVTS[ev.id].k, delta: C.EVTS[ev.id].v } : null,
    owned: rows.map((r) => ({ id: r.species, active: !!r.active })),
  };
}

function buy(db, user, itemId) {
  const it = C.ITEMS.find((x) => x.id === itemId);
  if (!it) { throw new HttpError(404, 'Article inconnu.'); }
  return tx(db, () => {
    const n = materialize(db, user);
    if (it.ko && !n.ko) { throw new HttpError(409, 'Ton compagnon n’est pas à terre.'); }
    if (!it.ko && n.ko) { throw new HttpError(409, 'Ton compagnon est à terre : il lui faut une potion de résurrection.'); }
    if (balance(db, user.id) < it.price) { throw new HttpError(402, 'Pas assez de gemmes.'); }
    addGems(db, user.id, -it.price, 'shop:' + it.id);
    const row = activeRow(db, user.id), v = { food: row.food, care: row.care, joy: row.joy };
    if (it.set) { Object.assign(v, it.set); } else { for (const [k, g] of Object.entries(it.gain)) { v[k] = clamp(v[k] + g, 0, 100); } }
    db.prepare('UPDATE user_pets SET food = ?, care = ?, joy = ? WHERE user_id = ? AND species = ?').run(v.food, v.care, v.joy, user.id, row.species);
    if (it.ko) { db.prepare('INSERT INTO pet_events (user_id, species, hour, type) VALUES (?,?,?,?)').run(user.id, row.species, clock.hourNow(), 'resurrect'); }
    return { say: it.say, resurrected: !!it.ko };
  });
}

function adopt(db, user, species) {
  const sp = C.PETS[species];
  if (!sp) { throw new HttpError(404, 'Compagnon inconnu.'); }
  return tx(db, () => {
    if (db.prepare('SELECT 1 FROM user_pets WHERE user_id = ? AND species = ?').get(user.id, species)) { throw new HttpError(409, 'Déjà adopté.'); }
    if (balance(db, user.id) < sp.price) { throw new HttpError(402, 'Pas assez de gemmes.'); }
    addGems(db, user.id, -sp.price, 'adopt:' + species);
    db.prepare('INSERT INTO user_pets (user_id, species, food, care, joy, anchor_hour, active, adopted_at) VALUES (?,?,?,?,?,?,0,?)')
      .run(user.id, species, 70, 70, 70, clock.hourNow(), clock.nowMs());
  });
}

function activate(db, user, species) {
  return tx(db, () => {
    const row = db.prepare('SELECT * FROM user_pets WHERE user_id = ? AND species = ?').get(user.id, species);
    if (!row) { throw new HttpError(404, 'Compagnon non adopté.'); }
    if (row.active) { return; }
    if (materialize(db, user).ko) { throw new HttpError(409, 'Ton compagnon est à terre : relève-le d’abord.'); }
    db.prepare('UPDATE user_pets SET active = 0 WHERE user_id = ?').run(user.id);
    db.prepare('UPDATE user_pets SET active = 1, anchor_hour = ? WHERE user_id = ? AND species = ?').run(clock.hourNow(), user.id, species);
  });
}

/* ---------- achats durables ---------- */
function inventory(db, userId) {
  const rows = db.prepare('SELECT item_id, cat, equipped FROM user_items WHERE user_id = ?').all(userId);
  const equip = { acc: null, decor: null };
  for (const r of rows) { if (r.equipped) { equip[r.cat] = r.item_id; } }
  return { owned: rows.map((r) => r.item_id), equip };
}
function buyDurable(db, user, itemId) {
  const d = C.DURABLE.find((x) => x.id === itemId);
  if (!d) { throw new HttpError(404, 'Article inconnu.'); }
  return tx(db, () => {
    if (db.prepare('SELECT 1 FROM user_items WHERE user_id = ? AND item_id = ?').get(user.id, itemId)) { throw new HttpError(409, 'Déjà acheté.'); }
    if (balance(db, user.id) < d.price) { throw new HttpError(402, 'Pas assez de gemmes.'); }
    addGems(db, user.id, -d.price, 'durable:' + d.id);
    db.prepare('UPDATE user_items SET equipped = 0 WHERE user_id = ? AND cat = ?').run(user.id, d.cat);
    db.prepare('INSERT INTO user_items (user_id, item_id, cat, bought_at, equipped) VALUES (?,?,?,?,1)').run(user.id, d.id, d.cat, clock.nowMs());
  });
}
/** porte l'article, ou le retire s'il est déjà porté */
function equipDurable(db, user, itemId) {
  const row = db.prepare('SELECT * FROM user_items WHERE user_id = ? AND item_id = ?').get(user.id, itemId);
  if (!row) { throw new HttpError(404, 'Article non acheté.'); }
  tx(db, () => {
    db.prepare('UPDATE user_items SET equipped = 0 WHERE user_id = ? AND cat = ?').run(user.id, row.cat);
    if (!row.equipped) { db.prepare('UPDATE user_items SET equipped = 1 WHERE user_id = ? AND item_id = ?').run(user.id, itemId); }
  });
}

module.exports = { mulberry, eventSchedule, simulate, context, materialize, view, buy, adopt, activate, inventory, buyDurable, equipDurable, isNight };
