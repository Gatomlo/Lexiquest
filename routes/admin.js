'use strict';
const express = require('express');
const U = require('../lib/users');
const Lists = require('../lib/lists');
const Invites = require('../lib/invites');
const Stats = require('../lib/stats');
const { HttpError } = U;

const wrap = (fn) => (req, res, next) => { try { const r = fn(req, res, next); if (r !== undefined && !res.headersSent) { res.json(r); } } catch (e) { next(e); } };

module.exports = function adminRoutes(db) {
  const r = express.Router();

  r.use((req, res, next) => {
    const user = req.session && req.session.userId && U.getUser(db, req.session.userId);
    if (!user) { return next(new HttpError(401, 'Connexion requise.')); }
    if (user.role !== 'parent') { return next(new HttpError(403, 'Accès refusé.')); }
    req.parent = user;
    next();
  });
  /* un parent ne voit que ses élèves */
  r.param('id', (req, res, next, id) => {
    const s = db.prepare("SELECT * FROM users WHERE id = ? AND role = 'student' AND parent_id = ? AND active = 1").get(Number(id), req.parent.id);
    if (!s) { return next(new HttpError(404, 'Élève introuvable.')); }
    req.student = s;
    next();
  });

  r.get('/students', wrap((req) => ({
    students: db.prepare("SELECT id, display, username FROM users WHERE role = 'student' AND parent_id = ? AND active = 1 ORDER BY id").all(req.parent.id)
      .map((s) => ({ id: s.id, name: s.display, username: s.username })),
  })));
  r.post('/students', wrap((req) => {
    const b = req.body || {};
    return { id: U.createUser(db, { username: b.username, display: b.name, role: 'student', password: b.password, parentId: req.parent.id }) };
  }));
  r.get('/invites', wrap((req) => ({ invites: Invites.pending(db, req.parent.id) })));
  r.post('/invites', wrap((req) => { const i = Invites.create(db, req.parent.id, (req.body || {}).name); return { id: i.id, token: i.token, expiresAt: i.expiresAt }; }));
  r.delete('/invites/:iid', wrap((req) => { Invites.revoke(db, req.parent.id, req.params.iid); return { ok: true }; }));
  r.get('/students/:id/overview', wrap((req) => Stats.adminOverview(db, req.student)));
  r.get('/students/:id/sessions', wrap((req) => ({ sessions: Stats.sessionList(db, req.student.id, Number(req.query.range) || 0) })));
  r.get('/students/:id/sessions/:sid', wrap((req) => {
    const d = Stats.sessionDetail(db, req.student.id, req.params.sid);
    if (!d) { throw new HttpError(404, 'Séance introuvable.'); }
    return d;
  }));
  r.get('/students/:id/difficulties', wrap((req) => ({ words: Stats.studentStats(db, req.student, { detail: true }).weak })));
  r.get('/students/:id/settings', wrap((req) => ({ settings: U.settingsOf(db, req.student.id) })));
  r.patch('/students/:id', wrap((req) => {
    const b = req.body || {};
    if (typeof b.password === 'string' && b.password) { U.setPassword(db, req.student.id, b.password); }
    return { settings: U.setSettings(db, req.student.id, b) };
  }));
  r.get('/students/:id/lists', wrap((req) => ({ lists: require('../lib/lists').listsOf(db, req.student.id) })));
  r.post('/students/:id/lists', wrap((req) => ({ id: Lists.createList(db, req.student.id, { ...(req.body || {}), assignedBy: req.parent.id }) })));
  r.put('/students/:id/lists/:lid', wrap((req) => {
    const own = db.prepare('SELECT id FROM lists WHERE id = ? AND owner_id = ?').get(Number(req.params.lid), req.student.id);
    if (!own) { throw new HttpError(404, 'Liste introuvable.'); }
    const b = req.body || {};
    return { words: Lists.updateList(db, own.id, { name: b.name, text: b.text }) };
  }));
  r.delete('/students/:id/lists/:lid', wrap((req) => {
    const x = db.prepare('DELETE FROM lists WHERE id = ? AND owner_id = ?').run(Number(req.params.lid), req.student.id);
    if (!x.changes) { throw new HttpError(404, 'Liste introuvable.'); }
    return { ok: true };
  }));
  r.get('/students/:id/export.csv', (req, res) => {
    res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="lexiquest-${req.student.username}.csv"` });
    res.send(Stats.exportCsv(db, req.student.id));
  });
  r.delete('/students/:id', wrap((req) => { db.prepare('DELETE FROM users WHERE id = ?').run(req.student.id); return { ok: true }; }));

  return r;
};
