'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { setup, play, beatBoss, clock } = require('./helpers');

/** une séance « jouée hors-ligne » : le client a gardé mots et réponses, le serveur n'a rien vu */
function offlinePayload(lists, lang, game, { startedAt, clientId, miss = false, dir = 'toFr' } = {}) {
  const words = lists.find((l) => l.lang === lang).words;
  const qtype = game === 'boss' ? 'duel' : game;
  const exp = (w) => (dir === 'toFr' ? w.fr : w.term);
  const events = [];
  words.forEach((w, i) => {
    if (miss && i === 0) { events.push({ type: 'answer', wordId: w.id, qtype, given: 'zzz', ok: false, ms: 900 }); }
    events.push({ type: 'answer', wordId: w.id, qtype, given: exp(w), ok: true, ms: 1200 });
  });
  return { clientId: clientId || 'abcdef123456', lang, game, dir, label: 'Hors-ligne', wordIds: words.map((w) => w.id), startedAt: startedAt || Date.now() - 3 * 60000, activeSec: 150, events };
}

test('séance hors-ligne : mêmes gemmes qu’en ligne, envoi idempotent', async (t) => {
  const E = await setup(); t.after(E.close);
  await E.loginAll(); await E.addLists();
  const lists = (await E.student.get('/api/state')).json.lists;
  const p = offlinePayload(lists, 'nl', 'forge', { dir: 'toTarget' });
  const r = await E.student.post('/api/sessions/import', p);
  assert.equal(r.status, 200, r.text);
  // 8 mots × 4 gemmes + combo +1 (5 mots) + fin 5 + sans faute 10 + bon du jour 10
  assert.equal(r.json.points, 8 * 4 + 5); assert.equal(r.json.gems, 37 + 25);
  assert.equal(r.json.bonus.daily, 10);
  const again = await E.student.post('/api/sessions/import', p);
  assert.equal(again.json.duplicate, true);
  assert.equal((await E.student.get('/api/wallet')).json.gems, 62, 'pas de doublon');
  assert.equal((await E.student.get('/api/stats')).json.days7, 1);
});

test('séance hors-ligne : le serveur corrige et refuse les triches', async (t) => {
  const E = await setup(); t.after(E.close);
  await E.loginAll(); await E.addLists();
  const lists = (await E.student.get('/api/state')).json.lists;
  const base = offlinePayload(lists, 'nl', 'duel', { clientId: 'id-honnete-1', miss: true });
  const ok = (await E.student.post('/api/sessions/import', base)).json;
  assert.equal(ok.first, 7, 'la faute est comptée par le serveur');
  assert.equal(ok.bonus.perfect, 0);
  // réponses annoncées justes mais fausses : le serveur ne les croit pas
  const cheat = offlinePayload(lists, 'nl', 'duel', { clientId: 'id-tricheur-1' });
  cheat.events.forEach((e) => { e.given = 'n’importe quoi'; e.ok = true; });
  const bad = await E.student.post('/api/sessions/import', cheat);
  assert.equal(bad.status, 400, 'mots jamais trouvés : séance incomplète');
  // mot d'une autre langue
  const en = lists.find((l) => l.lang === 'en').words[0].id;
  const mixed = offlinePayload(lists, 'nl', 'duel', { clientId: 'id-melange-1' }); mixed.wordIds.push(en);
  assert.equal((await E.student.post('/api/sessions/import', mixed)).status, 400);
  // identifiant et événements invalides
  assert.equal((await E.student.post('/api/sessions/import', { ...base, clientId: 'x' })).status, 400);
  assert.equal((await E.student.post('/api/sessions/import', { ...base, clientId: 'id-vide-123', events: [] })).status, 400);
  assert.equal((await E.parent.post('/api/sessions/import', base)).status, 403);
});

test('séance hors-ligne d’hier : bon du jour, série et rotation suivent la date réelle', async (t) => {
  const E = await setup(); t.after(E.close);
  await E.loginAll(); await E.addLists();
  const lists = (await E.student.get('/api/state')).json.lists;
  const yesterday = Date.now() - 26 * 36e5;
  const a = (await E.student.post('/api/sessions/import', offlinePayload(lists, 'nl', 'cards', { clientId: 'hier-cartes-1', startedAt: yesterday, dir: 'toFr' }))).json;
  assert.equal(a.bonus.daily, 10);
  const b = (await E.student.post('/api/sessions/import', offlinePayload(lists, 'en', 'duel', { clientId: 'auj-duel-0001' }))).json;
  assert.equal(b.bonus.daily, 10, 'un nouveau jour : nouveau bon du jour');
  const c = (await E.student.post('/api/sessions/import', offlinePayload(lists, 'en', 'cards', { clientId: 'auj-cartes-02' }))).json;
  assert.equal(c.bonus.daily, 0, 'une fois par jour');
  assert.equal((await E.student.get('/api/streak')).json.streak, 2);
  const rot = (await E.student.get('/api/games')).json;
  assert.equal(rot.cards.n, 2);
  // trop ancienne : ramenée à 14 jours au plus, jamais dans le futur
  const future = (await E.student.post('/api/sessions/import', offlinePayload(lists, 'nl', 'scramble', { clientId: 'futur-000001', startedAt: Date.now() + 5 * 864e5, dir: 'toTarget' }))).json;
  assert.ok(future.id);
  const ses = (await E.parent.get(`/api/admin/students/${E.studentId}/sessions`)).json.sessions;
  assert.ok(ses.every((s) => s.endedAt <= Date.now() + 1000));
});

test('rappels : une fois par jour, à l’heure choisie, seulement si utile', async (t) => {
  const E = await setup(); t.after(E.close); t.after(() => clock.reset());
  const Push = require('../lib/push'), Reminders = require('../lib/reminders');
  const sent = []; Push.setSender(async (sub, payload) => { sent.push({ endpoint: sub.endpoint, payload }); });
  t.after(() => Push.setSender(null));
  await E.loginAll(); await E.addLists();
  const sub = { endpoint: 'https://push.example.org/abcdefgh123', keys: { p256dh: 'p'.repeat(20), auth: 'a'.repeat(10) } };
  assert.equal((await E.student.post('/api/push/subscribe', { subscription: { endpoint: 'http://non-https' } })).status, 400);
  assert.equal((await E.student.post('/api/push/subscribe', { subscription: sub })).status, 200);
  assert.equal((await E.student.req('PUT', '/api/reminder', { remind: true, remindAt: '25:99' })).status, 400);
  const cfg = (await E.student.req('PUT', '/api/reminder', { remind: true, remindAt: '17:30' })).json;
  assert.deepEqual([cfg.remind, cfg.remindAt, cfg.devices], [true, '17:30', 1]);
  const at = (h, m) => { const d = new Date(); d.setHours(h, m, 0, 0); return d.getTime() - Date.now(); };
  clock.advance(at(10, 0));
  assert.deepEqual(await Reminders.run(E.db), [], 'trop tôt');
  clock.reset(); clock.advance(at(17, 31));
  const r1 = await Reminders.run(E.db);
  assert.equal(r1.length, 1); assert.equal(sent.length, 1);
  assert.match(sent[0].payload.title + sent[0].payload.body, /séance|Lexi/i);
  assert.deepEqual(await Reminders.run(E.db), [], 'un seul rappel par jour');
  // le lendemain, mais l'élève a déjà joué : pas de rappel
  clock.advance(864e5);
  await play(E.student, { lang: 'nl', scope: 'all', listIds: [], game: 'duel' });
  assert.deepEqual(await Reminders.run(E.db), []);
  // après la fenêtre de 2 h : un rappel manqué ne part pas
  clock.advance(864e5); clock.reset(); clock.advance(at(21, 0) + 2 * 864e5);
  assert.deepEqual(await Reminders.run(E.db), []);
  // appareil disparu (410) : abonnement retiré
  Push.setSender(async () => { const e = new Error('gone'); e.statusCode = 410; throw e; });
  assert.equal(await Push.notifyUser(E.db, E.studentId, { title: 't' }), 0);
  assert.equal(Push.countSubs(E.db, E.studentId), 0);
});

test('rappel parent : prévenu si l’élève n’a pas joué depuis 2 jours', async (t) => {
  const E = await setup(); t.after(E.close); t.after(() => clock.reset());
  const Push = require('../lib/push'), Reminders = require('../lib/reminders');
  const sent = []; Push.setSender(async (sub, payload) => { sent.push(payload); }); t.after(() => Push.setSender(null));
  await E.loginAll(); await E.addLists();
  await play(E.student, { lang: 'nl', scope: 'all', listIds: [], game: 'duel' });
  await E.parent.post('/api/push/subscribe', { subscription: { endpoint: 'https://push.example.org/parent-device-1', keys: { p256dh: 'p'.repeat(20), auth: 'a'.repeat(10) } } });
  await E.parent.req('PUT', '/api/reminder', { remind: true, remindAt: '19:00' });
  const at = (h, m, days) => { const d = new Date(); d.setDate(d.getDate() + days); d.setHours(h, m, 0, 0); return d.getTime() - Date.now(); };
  clock.advance(at(19, 5, 1));
  assert.deepEqual(await Reminders.run(E.db), [], 'un jour sans jouer : pas encore');
  clock.reset(); clock.advance(at(19, 5, 2));
  const r = await Reminders.run(E.db);
  assert.equal(r.length, 1);
  assert.match(sent[0].body, /Léa n’a pas joué depuis 2 jours/);
  assert.equal((await E.student.post('/api/push/test')).status, 409, 'aucun appareil pour l’élève');
});

test('cron externe des rappels : clé obligatoire', async (t) => {
  const E = await setup(); t.after(E.close);
  delete process.env.CRON_KEY;
  assert.equal((await E.student.post('/api/cron/reminders')).status, 403);
  process.env.CRON_KEY = 'secret-cron'; t.after(() => { delete process.env.CRON_KEY; });
  const noKey = await E.student.post('/api/cron/reminders'); assert.equal(noKey.status, 403);
  const res = await fetch(E.base + '/api/cron/reminders', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-cron-key': 'secret-cron' }, body: '{}' });
  assert.equal(res.status, 200);
});

test('import CSV : points-virgules, tabulations, guillemets, BOM', async (t) => {
  const E = await setup(); t.after(E.close);
  await E.loginAll();
  const csv = '﻿de fiets;le vélo\r\n"het huis";"la maison"\r\nde hond\tle chien\r\nligne sans séparateur\r\nde kat = le chat\r\n';
  const r = await E.student.post('/api/lists', { lang: 'nl', name: 'CSV', text: csv });
  assert.equal(r.status, 200, r.text);
  const l = (await E.student.get('/api/state')).json.lists[0];
  assert.deepEqual(l.words.map((w) => [w.term, w.fr]), [['de fiets', 'le vélo'], ['het huis', 'la maison'], ['de hond', 'le chien'], ['de kat', 'le chat']]);
});

test('PWA : manifeste, service worker versionné, redirection de /lexiquest', async (t) => {
  const express = require('express'), http = require('node:http');
  const { open } = require('../lib/db');
  const outer = express();
  outer.use('/lexiquest', require('../app').createApp(open(':memory:')));
  const server = http.createServer(outer); await new Promise((r) => server.listen(0, '127.0.0.1', r)); t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  const red = await fetch(base + '/lexiquest', { redirect: 'manual' });
  assert.equal(red.status, 301); assert.equal(red.headers.get('location'), '/lexiquest/');
  const m = await fetch(base + '/lexiquest/manifest.json');
  assert.equal(m.status, 200);
  const man = await m.json();
  assert.equal(man.start_url, './'); assert.equal(man.display, 'standalone');
  for (const i of man.icons) { assert.equal((await fetch(base + '/lexiquest/' + i.src)).status, 200, i.src); }
  const sw = await fetch(base + '/lexiquest/sw.js');
  assert.equal(sw.status, 200); assert.match(sw.headers.get('content-type'), /javascript/); assert.equal(sw.headers.get('cache-control'), 'no-cache');
  const code = await sw.text();
  assert.doesNotMatch(code, /__VERSION__/); assert.match(code, /lexiquest-[0-9a-f]{12}/);
  // tout ce que le service worker met en cache existe réellement
  const list = JSON.parse(code.match(/const SHELL = (\[[\s\S]*?\]);/)[1].replace(/'/g, '"'));
  for (const f of list) { assert.equal((await fetch(base + '/lexiquest/' + f)).status, 200, f); }
});

test('nouveaux compagnons et articles disponibles à la boutique', async (t) => {
  const E = await setup(); t.after(E.close);
  await E.loginAll();
  E.db.prepare('INSERT INTO gem_events (user_id, delta, reason, at) VALUES (?,?,?,?)').run(E.studentId, 5000, 'test', Date.now());
  for (const id of ['renard', 'hibou']) { assert.equal((await E.student.post(`/api/pets/${id}/adopt`)).status, 200, id); }
  for (const id of ['casque', 'monocle', 'cape', 'neige', 'jungle', 'espace']) { assert.equal((await E.student.post('/api/shop/buy', { item: id })).status, 200, id); }
  assert.equal((await E.student.get('/api/state')).json.pet.owned.length, 3);
});
