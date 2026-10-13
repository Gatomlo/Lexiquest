'use strict';
const express = require('express');
const C = require('../lib/config');
const clock = require('../lib/clock');
const U = require('../lib/users');
const Lists = require('../lib/lists');
const P = require('../lib/progress');
const Pets = require('../lib/pets');
const S = require('../lib/sessions');
const Stats = require('../lib/stats');
const Push = require('../lib/push');
const Kv = require('../lib/kv');
const Reminders = require('../lib/reminders');
const { HttpError } = U;

/* anti force brute : 10 échecs par identifiant et par adresse sur 15 minutes */
const fails = new Map();
function tooMany(key) { const r = fails.get(key); return r && r.n >= 10 && Date.now() - r.t < 9e5; }
function noteFail(key) { const r = fails.get(key); fails.set(key, r && Date.now() - r.t < 9e5 ? { n: r.n + 1, t: r.t } : { n: 1, t: Date.now() }); }

const wrap = (fn) => (req, res, next) => {
  const send = (v) => { if (v !== undefined && !res.headersSent) { res.json(v); } };
  try { const r = fn(req, res, next); if (r && typeof r.then === 'function') { r.then(send, next); } else { send(r); } } catch (e) { next(e); }
};

function buildState(db, user) {
  const days = P.playedDays(db, user.id), st = P.streakOf(days), t = clock.dayIdx();
  const inv = Pets.inventory(db, user.id);
  const played7 = []; for (let i = 6; i >= 0; i--) { played7.push(days.has(t - i)); }
  const weak = {}; for (const l of C.LANGS) { weak[l] = S.weakWords(db, user.id, l).length; }
  return {
    me: { id: user.id, name: user.display, role: user.role },
    now: clock.nowMs(), gems: U.balance(db, user.id), streak: st.count, played7,
    dailyDone: P.dailyOn(db, user.id, t),
    vouchers: P.vouchersOf(db, user.id, days),
    pet: Pets.view(db, user, days), inv,
    boss: P.bossStatus(db, user.id), rotation: P.rotationOf(db, user.id),
    lists: Lists.listsOf(db, user.id), weak, settings: U.settingsOf(db, user.id),
  };
}

module.exports = function apiRoutes(db) {
  const r = express.Router();

  const auth = (role) => (req, res, next) => {
    const id = req.session && req.session.userId;
    const user = id && U.getUser(db, id);
    if (!user) { return next(new HttpError(401, 'Connexion requise.')); }
    if (role && user.role !== role) { return next(new HttpError(403, 'Accès refusé.')); }
    req.user = user;
    next();
  };

  r.get('/config', (req, res) => res.json({
    games: C.GAMES, gems: C.GEMS, order: C.ORDER, rot: C.ROT, boss: C.BOSS, vouch: C.VOUCH, resPrice: C.RES_PRICE, realm: C.REALM, stateN: C.STATE_N,
    gauges: C.GAUGES, low: C.LOW, pets: C.PETS, items: C.ITEMS, durable: C.DURABLE, rates: C.RATE, night: C.NIGHT,
  }));

  /* ---------- première installation : le premier compte est le compte parent ---------- */
  const noUsers = () => Number(db.prepare('SELECT COUNT(*) AS n FROM users').get().n) === 0;
  r.get('/setup', wrap(() => ({ needed: noUsers() })));
  r.post('/setup', (req, res, next) => {
    try {
      const b = req.body || {};
      let id;
      require('../lib/db').tx(db, () => {
        if (!noUsers()) { throw new HttpError(409, 'L’installation est déjà faite.'); }
        id = U.createUser(db, { username: b.username, display: b.name, role: 'parent', password: b.password });
      });
      req.session.regenerate((err) => {
        if (err) { return next(err); }
        req.session.userId = id;
        res.json({ me: { id, name: String(b.name).trim(), role: 'parent' } });
      });
    } catch (e) { next(e); }
  });

  /* ---------- connexion ---------- */
  r.post('/auth/login', (req, res, next) => {
    const { username, password, portal } = req.body || {};
    const key = req.ip + '|' + String(username || '').toLowerCase();
    if (tooMany(key)) { return next(new HttpError(429, 'Trop d’essais. Réessaie dans quelques minutes.')); }
    let u;
    try { u = U.checkLogin(db, username, password); } catch (e) { return next(e); }
    if (!u || (portal && u.role !== portal)) { noteFail(key); return next(new HttpError(401, 'Identifiant ou mot de passe incorrect.')); }
    fails.delete(key);
    req.session.regenerate((err) => {
      if (err) { return next(err); }
      req.session.userId = u.id;
      res.json({ me: { id: u.id, name: u.display, role: u.role } });
    });
  });
  r.post('/auth/logout', (req, res, next) => {
    if (!req.session) { return res.json({ ok: true }); }
    req.session.destroy((err) => { if (err) { return next(err); } res.clearCookie('lexiquest.sid', { path: req.baseUrl || '/' }); res.json({ ok: true }); });
  });
  r.get('/me', auth(), wrap((req) => ({ me: { id: req.user.id, name: req.user.display, role: req.user.role } })));

  /* ---------- élève ---------- */
  const stu = auth('student');
  r.get('/state', stu, wrap((req) => buildState(db, req.user)));
  r.get('/games', stu, wrap((req) => P.rotationOf(db, req.user.id)));
  r.get('/weekly-boss', stu, wrap((req) => P.bossStatus(db, req.user.id)));
  r.get('/wallet', stu, wrap((req) => ({ gems: U.balance(db, req.user.id) })));
  r.get('/streak', stu, wrap((req) => { const d = P.playedDays(db, req.user.id); return { streak: P.streakOf(d).count, vouchers: P.vouchersOf(db, req.user.id, d) }; }));
  r.post('/vouchers/:tier/claim', stu, wrap((req) => ({ gems: P.claimVoucher(db, req.user.id, Number(req.params.tier)) })));

  r.get('/lists', stu, wrap((req) => ({ lists: Lists.listsOf(db, req.user.id) })));
  r.post('/lists', stu, wrap((req) => ({ id: Lists.createList(db, req.user.id, req.body || {}) })));
  r.delete('/lists/:id', stu, wrap((req) => { Lists.deleteList(db, req.user.id, Number(req.params.id)); return { ok: true }; }));

  r.get('/shop', stu, wrap(() => ({ items: C.ITEMS, durable: C.DURABLE, pets: C.PETS })));
  r.post('/shop/buy', stu, wrap((req) => {
    const id = String((req.body || {}).item || '');
    if (C.DURABLE.some((d) => d.id === id)) { Pets.buyDurable(db, req.user, id); return { ok: true }; }
    return Pets.buy(db, req.user, id);
  }));
  r.post('/shop/equip', stu, wrap((req) => { Pets.equipDurable(db, req.user, String((req.body || {}).item || '')); return { ok: true }; }));
  r.get('/pets', stu, wrap((req) => Pets.view(db, req.user)));
  r.post('/pets/:id/adopt', stu, wrap((req) => { Pets.adopt(db, req.user, req.params.id); return { ok: true }; }));
  r.post('/pets/:id/activate', stu, wrap((req) => { Pets.activate(db, req.user, req.params.id); return { ok: true }; }));

  r.post('/sessions/import', stu, wrap((req) => S.importOffline(db, req.user, req.body)));
  r.post('/sessions', stu, wrap((req) => S.start(db, req.user, req.body || {})));
  r.post('/sessions/:id/events', stu, wrap((req) => ({ results: S.recordEvents(db, req.user, req.params.id, (req.body || {}).events) })));
  r.post('/sessions/:id/end', stu, wrap((req) => S.end(db, req.user, req.params.id, req.body || {})));
  r.delete('/sessions/:id', stu, wrap((req) => { S.abandon(db, req.user, req.params.id); return { ok: true }; }));

  r.get('/stats', stu, wrap((req) => Stats.studentStats(db, req.user)));
  r.get('/review-queue', stu, wrap((req) => ({ words: S.weakWords(db, req.user.id, C.LANGS.includes(req.query.lang) ? req.query.lang : null) })));

  /* ---------- notifications (élève et parent) ---------- */
  const anyone = auth();
  r.get('/push/key', (req, res) => res.json({ key: Push.publicKey(db) }));
  r.post('/push/subscribe', anyone, wrap((req) => {
    if (!Push.subscribe(db, req.user.id, (req.body || {}).subscription)) { throw new HttpError(400, 'Abonnement invalide.'); }
    Kv.set(db, 'origin', req.protocol + '://' + req.get('host'));
    return { ok: true };
  }));
  r.post('/push/unsubscribe', anyone, wrap((req) => { Push.unsubscribe(db, req.user.id, (req.body || {}).endpoint); return { ok: true }; }));
  r.post('/push/test', anyone, wrap(async (req) => {
    const n = await Push.notifyUser(db, req.user.id, { title: 'Lexiquest', body: 'Les notifications fonctionnent.', url: req.user.role === 'parent' ? 'parent' : './', tag: 'lexiquest-test' });
    if (!n) { throw new HttpError(409, 'Aucun appareil abonné.'); }
    return { sent: n };
  }));
  r.get('/reminder', anyone, wrap((req) => { const s = U.settingsOf(db, req.user.id); return { remind: s.remind, remindAt: s.remindAt, devices: Push.countSubs(db, req.user.id) }; }));
  r.put('/reminder', anyone, wrap((req) => {
    const b = req.body || {}, patch = {};
    if ('remind' in b) { patch.remind = b.remind; }
    if ('remindAt' in b) { patch.remindAt = b.remindAt; }
    const s = U.setSettings(db, req.user.id, patch);
    return { remind: s.remind, remindAt: s.remindAt, devices: Push.countSubs(db, req.user.id) };
  }));
  /* déclenchement externe des rappels (cron) quand le processus Node n'est pas permanent */
  r.post('/cron/reminders', wrap(async (req) => {
    const key = process.env.CRON_KEY;
    if (!key || req.get('x-cron-key') !== key) { throw new HttpError(403, 'Clé invalide.'); }
    return { sent: await Reminders.run(db) };
  }));

  return r;
};
module.exports.buildState = buildState;
