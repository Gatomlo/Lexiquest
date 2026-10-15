'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { setup, play, beatBoss, clock } = require('./helpers');

test('connexion : portails séparés, accès cloisonnés', async (t) => {
  const E = await setup(); t.after(E.close);
  let r = await E.student.post('/api/auth/login', { username: 'lea', password: 'faux', portal: 'student' });
  assert.equal(r.status, 401);
  r = await E.student.post('/api/auth/login', { username: 'papa', password: 'motdepasse1', portal: 'student' });
  assert.equal(r.status, 401, 'un parent ne se connecte pas par le portail élève');
  assert.equal((await E.student.get('/api/state')).status, 401);
  await E.loginAll();
  assert.equal((await E.student.get('/api/state')).status, 200);
  assert.equal((await E.student.get('/api/admin/students')).status, 403, 'élève sans accès /admin');
  assert.equal((await E.parent.get('/api/state')).status, 403, 'parent sans accès élève');
  const ov = await E.parent.get(`/api/admin/students/${E.studentId}/overview`);
  assert.equal(ov.status, 200);
  assert.equal(ov.json.student.name, 'Léa');
  // un autre parent ne voit pas cet élève
  const { createUser } = require('../lib/users');
  createUser(E.db, { username: 'autre', display: 'Autre', role: 'parent', password: 'motdepasse3' });
  const o = new E.Client(E.base); await o.post('/api/auth/login', { username: 'autre', password: 'motdepasse3', portal: 'parent' });
  assert.equal((await o.get(`/api/admin/students/${E.studentId}/overview`)).status, 404);
  assert.equal((await E.student.req('POST', '/api/lists', undefined)).status, 400);
});

test('JSON obligatoire pour modifier (anti-CSRF)', async (t) => {
  const E = await setup(); t.after(E.close);
  await E.loginAll();
  const res = await fetch(E.base + '/api/lists', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: E.student.cookie }, body: 'lang=nl' });
  assert.equal(res.status, 415);
});

test('listes : une langue par liste, au moins 2 mots', async (t) => {
  const E = await setup(); t.after(E.close);
  await E.loginAll();
  assert.equal((await E.student.post('/api/lists', { lang: 'de', name: 'x', text: 'a = b\nc = d' })).status, 400);
  assert.equal((await E.student.post('/api/lists', { lang: 'nl', name: 'x', text: 'seul = un' })).status, 400);
  await E.addLists();
  const st = (await E.student.get('/api/state')).json;
  assert.equal(st.lists.length, 2);
  assert.deepEqual(st.lists.map((l) => l.lang).sort(), ['en', 'nl']);
});

test('séance : une seule langue, gemmes calculées par le serveur', async (t) => {
  const E = await setup(); t.after(E.close);
  await E.loginAll(); await E.addLists();
  const r = await play(E.student, { lang: 'nl', scope: 'all', listIds: [], game: 'forge', dir: 'toFr' });
  assert.equal(r.end.status, 200, r.end.text);
  assert.ok(r.session.words.length === 8 && r.session.words.every((w) => /^(de|het) /.test(w.term)), 'mots néerlandais seulement');
  assert.equal(r.session.dir, 'toTarget', 'La Forge impose français → langue étudiée');
  const e = r.end.json;
  // 8 mots × 4 gemmes (1er coup) + combo +1 dès la 4e bonne réponse (4e à 8e = 5 mots) + fin 5 + sans faute 10 + bon du jour 10
  assert.equal(e.points, 8 * 4 + 5);
  assert.equal(e.bonus.fin, 5); assert.equal(e.bonus.perfect, 10); assert.equal(e.bonus.daily, 10);
  assert.equal(e.gems, 37 + 5 + 10 + 10);
  assert.equal((await E.student.get('/api/wallet')).json.gems, e.gems);
  // 2e séance du jour : pas de nouveau bon du jour
  const r2 = await play(E.student, { lang: 'en', scope: 'all', listIds: [], game: 'duel' });
  assert.equal(r2.end.json.bonus.daily, 0);
  assert.ok(r2.session.words.every((w) => !/^(de|het) /.test(w.term)));
});

test('séance : faute au premier essai = pas de « sans faute », demi-gemmes au second', async (t) => {
  const E = await setup(); t.after(E.close);
  await E.loginAll(); await E.addLists();
  const r = await play(E.student, { lang: 'en', scope: 'all', listIds: [], game: 'scramble', dir: 'toFr' }, { miss: true });
  const e = r.end.json;
  assert.equal(e.bonus.perfect, 0);
  assert.equal(e.first, 7);
  assert.ok(e.missed.length === 1);
  // la faute n'est pas comptée au même titre : 7 premiers coups (3 gemmes + combo) + 1 second essai (⌈3/2⌉ = 2)
  // (la faute remet le combo à 0 ; le retry le relance à 1 ; bonus +1 dès que le combo atteint 3 : 5 derniers mots)
  assert.equal(e.points, 2 + 7 * 3 + 5);
});

test('séance incomplète ou vide refusée ; mot hors séance refusé', async (t) => {
  const E = await setup(); t.after(E.close);
  await E.loginAll(); await E.addLists();
  const s = (await E.student.post('/api/sessions', { lang: 'nl', scope: 'all', listIds: [], game: 'cards' })).json;
  assert.equal((await E.student.post(`/api/sessions/${s.id}/end`, {})).status, 400, 'aucune réponse');
  const en = (await E.student.get('/api/state')).json.lists.find((l) => l.lang === 'en').words[0];
  assert.equal((await E.student.post(`/api/sessions/${s.id}/events`, { events: [{ type: 'answer', wordId: en.id, qtype: 'cards', ok: true }] })).status, 400, 'mot anglais dans une séance néerlandaise');
  await E.student.post(`/api/sessions/${s.id}/events`, { events: [{ type: 'answer', wordId: s.words[0].id, qtype: 'cards', ok: true }] });
  assert.equal((await E.student.post(`/api/sessions/${s.id}/end`, {})).status, 400, 'il reste des mots');
  assert.equal((await E.student.post(`/api/sessions/${s.id}/events`, { events: [{ type: 'answer', wordId: s.words[1].id, qtype: 'forge', given: 'x' }] })).status, 400, 'type de question invalide');
});

test('correction côté serveur : accents et articles selon les réglages du parent', async (t) => {
  const E = await setup(); t.after(E.close);
  await E.loginAll();
  await E.student.post('/api/lists', { lang: 'en', name: 'Café', text: 'café = coffee\nto wake up = se réveiller' });
  const s = (await E.student.post('/api/sessions', { lang: 'en', scope: 'all', listIds: [], game: 'forge' })).json;
  const w = s.words.find((x) => x.fr === 'café' || x.term === 'to wake up');
  const ev = (given) => E.student.post(`/api/sessions/${s.id}/events`, { events: [{ type: 'answer', wordId: w.id, qtype: 'forge', given, ok: true }] });
  const exp = w.term; // forge : français → langue étudiée
  assert.equal((await ev(exp.normalize('NFD').replace(/[̀-ͯ]/g, ''))).json.results[0].ok, true, 'accents tolérés par défaut');
  await E.parent.post('/api/auth/login', { username: 'papa', password: 'motdepasse1', portal: 'parent' });
  await E.parent.req('PATCH', `/api/admin/students/${E.studentId}`, { accents: false });
  const strict = await ev(exp.normalize('NFD').replace(/[̀-ͯ]/g, '') + '!');
  assert.equal(strict.json.results[0].ok, false);
  assert.ok(['presque', 'oubli'].includes(strict.json.results[0].kind));
});

test('rotation : verrouillage après 3 séances, retour après 2 autres jeux différents', async (t) => {
  const E = await setup(); t.after(E.close);
  await E.loginAll(); await E.addLists();
  const o = (game) => ({ lang: 'nl', scope: 'all', listIds: [], game });
  await play(E.student, o('cards')); await play(E.student, o('cards'));
  const third = await play(E.student, o('cards'));
  assert.equal(third.end.json.rotation.locked, true);
  assert.equal((await E.student.post('/api/sessions', o('cards'))).status, 409);
  assert.equal((await E.student.get('/api/games')).json.cards.locked, true);
  await play(E.student, o('duel'));
  assert.equal((await E.student.post('/api/sessions', o('cards'))).status, 409, 'un seul autre jeu ne suffit pas');
  await play(E.student, o('duel'));
  assert.equal((await E.student.post('/api/sessions', o('cards'))).status, 409, 'deux séances du même jeu ne comptent qu’une fois');
  const r = await play(E.student, o('scramble'));
  assert.deepEqual(r.end.json.rotation.unlocked, ['cards']);
  assert.equal((await E.student.post('/api/sessions', o('cards'))).status, 200);
});

test('Gardien : bonus de 20 une fois par semaine, bonus sans effet, jamais 3 semaines de suite dans la même langue', async (t) => {
  const E = await setup(); t.after(E.close); t.after(() => clock.reset());
  await E.loginAll(); await E.addLists();
  const first = await beatBoss(E.student, 'nl');
  assert.equal(first.end.json.win, true);
  assert.equal(first.end.json.bonus.boss, 20);
  assert.equal(first.end.json.bonusBoss, false);
  const bonus = await beatBoss(E.student, 'en');
  assert.equal(bonus.end.json.bonusBoss, true);
  assert.equal(bonus.end.json.bonus.boss, 0, 'Gardien bonus : pas de +20');
  const B = (await E.student.get('/api/weekly-boss')).json;
  assert.equal(B.wonLang, 'nl', 'le Gardien bonus ne change pas la langue de la semaine');
  clock.advance(7 * 864e5);
  assert.equal((await beatBoss(E.student, 'nl')).end.status, 200, 'deuxième semaine de suite en néerlandais : permis');
  clock.advance(7 * 864e5);
  assert.equal((await E.student.get('/api/weekly-boss')).json.ban, 'nl');
  const refused = await E.student.post('/api/sessions', { lang: 'nl', scope: 'all', listIds: [], game: 'boss' });
  assert.equal(refused.status, 409);
  assert.equal((await beatBoss(E.student, 'en')).end.json.win, true);
});

test('Gardien perdu : 3 cœurs, séance de 2 gemmes de fin', async (t) => {
  const E = await setup(); t.after(E.close);
  await E.loginAll(); await E.addLists();
  const s = (await E.student.post('/api/sessions', { lang: 'nl', scope: 'all', listIds: [], game: 'boss' })).json;
  for (let i = 0; i < 3; i++) { await E.student.post(`/api/sessions/${s.id}/events`, { events: [{ type: 'answer', wordId: s.words[i].id, qtype: 'forge', given: 'faux' }] }); }
  const e = (await E.student.post(`/api/sessions/${s.id}/end`, {})).json;
  assert.equal(e.win, false); assert.equal(e.bonus.fin, 2); assert.equal(e.bonus.boss, 0);
});

test('compagnon : baisse horaire, nuit à mi-vitesse, à terre, résurrection', async (t) => {
  const E = await setup(); t.after(E.close); t.after(() => clock.reset());
  await E.loginAll();
  const day = async () => (await E.student.get('/api/state')).json.pet;
  const p0 = await day();
  assert.equal(p0.care, 80); assert.equal(p0.ko, false);
  clock.advance(6 * 36e5);
  const p6 = await day();
  assert.ok(p6.joy < p0.joy && p6.food < p0.food);
  clock.advance(7 * 864e5);
  const p7 = await day();
  assert.equal(p7.ko, true); assert.equal(p7.lvl, 4);
  // à terre : seule la résurrection fonctionne
  await E.db.prepare('INSERT INTO gem_events (user_id, delta, reason, at) VALUES (?,?,?,?)').run(E.studentId, 500, 'test', Date.now());
  assert.equal((await E.student.post('/api/shop/buy', { item: 'pomme' })).status, 409);
  assert.equal((await E.student.post('/api/shop/buy', { item: 'couronne' })).status, 200, 'les achats durables restent possibles');
  const r = await E.student.post('/api/shop/buy', { item: 'resur' });
  assert.equal(r.status, 200, r.text);
  const after = await day();
  assert.equal(after.ko, false);
  assert.equal(Math.round(after.care), 50);
  assert.equal((await E.student.get('/api/wallet')).json.gems, 500 - 300 - 150);
});

test('compagnon : la nuit, les jauges baissent deux fois moins vite', () => {
  const Pets = require('../lib/pets'), C = require('../lib/config');
  const mid = new Date(2026, 5, 10, 12, 0, 0), night = new Date(2026, 5, 10, 22, 0, 0);
  const sim = (from) => Pets.simulate({ food: 100, care: 100, joy: 100, anchor_hour: Math.floor(from.getTime() / 36e5) },
    { seed: 1, createdHour: 0, wins: [], createdWeek: 0, nowHour: Math.floor(from.getTime() / 36e5) + 4 });
  const d = sim(mid), n = sim(night);
  assert.equal(Math.round((100 - d.joy) * 10) / 10, 4 * C.RATE.joy);
  assert.equal(Math.round((100 - n.joy) * 10) / 10, 4 * C.RATE.joy * 0.5);
});

test('événements aléatoires : un tous les 1 à 3 jours, déterministes', () => {
  const Pets = require('../lib/pets');
  const a = Pets.eventSchedule(42, 1000, 1000 + 24 * 60), b = Pets.eventSchedule(42, 1000, 1000 + 24 * 60);
  assert.deepEqual([...a], [...b]);
  const hours = [1000, ...a.keys()];
  for (let i = 1; i < hours.length; i++) { const gap = hours[i] - hours[i - 1]; assert.ok(gap >= 24 && gap <= 72, 'écart ' + gap); }
  assert.ok(a.size >= 20 && a.size <= 60);
});

test('Gardien manqué : −40 de vie au lundi', () => {
  const Pets = require('../lib/pets'), C = require('../lib/config');
  const clockM = require('../lib/clock');
  // un lundi à 0 h local, compagnon créé la semaine d'avant
  const monday = new Date(2026, 5, 8, 0, 0, 0), h = Math.floor(monday.getTime() / 36e5);
  const week = clockM.weekStart(clockM.dayIdx(monday));
  const base = { food: 100, care: 100, joy: 100, anchor_hour: h - 1 };
  const miss = Pets.simulate(base, { seed: 1, createdHour: 0, wins: [], createdWeek: week - 7, nowHour: h });
  assert.equal(miss.hits.length, 1);
  assert.equal(Math.round(miss.care), 100 - C.BOSS.penCare);
  const won = Pets.simulate(base, { seed: 1, createdHour: 0, wins: [{ day: week - 3, lang: 'nl' }], createdWeek: week - 7, nowHour: h });
  assert.equal(won.hits.length, 0);
  const fresh = Pets.simulate(base, { seed: 1, createdHour: 0, wins: [], createdWeek: week, nowHour: h });
  assert.equal(fresh.hits.length, 0, 'pas de pénalité pour une semaine antérieure à l’inscription');
});

test('série et bons de régularité', async (t) => {
  const E = await setup(); t.after(E.close); t.after(() => clock.reset());
  await E.loginAll(); await E.addLists();
  const o = { lang: 'nl', scope: 'all', listIds: [], game: 'duel' };
  for (let i = 0; i < 3; i++) { const games = ['duel', 'forge', 'scramble']; await play(E.student, { ...o, game: games[i] }); clock.advance(864e5); }
  clock.advance(-864e5);
  const s = (await E.student.get('/api/streak')).json;
  assert.equal(s.streak, 3);
  assert.equal(s.vouchers[0].can, true);
  const before = (await E.student.get('/api/wallet')).json.gems;
  assert.equal((await E.student.post('/api/vouchers/3/claim')).json.gems, 15);
  assert.equal((await E.student.get('/api/wallet')).json.gems, before + 15);
  assert.equal((await E.student.post('/api/vouchers/3/claim')).status, 409, 'une seule fois par série');
  assert.equal((await E.student.post('/api/vouchers/7/claim')).status, 409, 'série trop courte');
});

test('boutique : gemmes insuffisantes, achats durables portés puis retirés', async (t) => {
  const E = await setup(); t.after(E.close);
  await E.loginAll();
  assert.equal((await E.student.post('/api/shop/buy', { item: 'pomme' })).status, 402);
  E.db.prepare('INSERT INTO gem_events (user_id, delta, reason, at) VALUES (?,?,?,?)').run(E.studentId, 1000, 'test', Date.now());
  assert.equal((await E.student.post('/api/shop/buy', { item: 'balle' })).status, 200);
  assert.equal((await E.student.post('/api/shop/buy', { item: 'resur' })).status, 409, 'pas à terre');
  assert.equal((await E.student.post('/api/shop/buy', { item: 'chapeau' })).status, 200);
  assert.equal((await E.student.post('/api/shop/buy', { item: 'chapeau' })).status, 409);
  assert.equal((await E.student.get('/api/state')).json.inv.equip.acc, 'chapeau');
  await E.student.post('/api/shop/equip', { item: 'chapeau' });
  assert.equal((await E.student.get('/api/state')).json.inv.equip.acc, null);
  assert.equal((await E.student.post('/api/pets/dragon/adopt')).status, 200);
  assert.equal((await E.student.post('/api/pets/dragon/adopt')).status, 409);
  assert.equal((await E.student.post('/api/pets/dragon/activate')).status, 200);
  assert.equal((await E.student.get('/api/state')).json.pet.id, 'dragon');
});

test('parent : séances, détail, difficultés, export CSV, réglages', async (t) => {
  const E = await setup(); t.after(E.close);
  await E.loginAll(); await E.addLists();
  await play(E.student, { lang: 'nl', scope: 'all', listIds: [], game: 'duel' }, { miss: true });
  const base = `/api/admin/students/${E.studentId}`;
  const ses = (await E.parent.get(base + '/sessions')).json.sessions;
  assert.equal(ses.length, 1);
  const det = (await E.parent.get(`${base}/sessions/${ses[0].id}`)).json;
  assert.ok(det.answers.length >= 9 && det.answers.some((a) => !a.ok));
  const csv = await E.parent.get(base + '/export.csv');
  assert.equal(csv.status, 200);
  assert.match(csv.text, /seance;debut;langue/);
  const patched = (await E.parent.req('PATCH', base, { goalDays: 3, articles: false })).json.settings;
  assert.equal(patched.goalDays, 3); assert.equal(patched.articles, false);
  assert.equal((await E.student.get('/api/state')).json.settings.goalDays, 3);
  const made = await E.parent.post(base + '/lists', { lang: 'nl', name: 'Donnée', text: 'a = b\nc = d' });
  assert.equal(made.status, 200);
  assert.equal((await E.student.get('/api/state')).json.lists.find((l) => l.name === 'Donnée').by, 'parent');
});

test('statistiques élève et parent', async (t) => {
  const E = await setup(); t.after(E.close);
  await E.loginAll(); await E.addLists();
  await play(E.student, { lang: 'nl', scope: 'all', listIds: [], game: 'duel' });
  const st = (await E.student.get('/api/stats')).json;
  assert.equal(st.days7, 1); assert.equal(st.streak, 1); assert.equal(st.acc7, 1);
  assert.equal(st.games30.duel, 1);
  assert.ok(st.minutes7 > 0);
  const ov = (await E.parent.get(`/api/admin/students/${E.studentId}/overview`)).json;
  assert.equal(ov.goneDays, 0);
  assert.equal(ov.stats.days7, 1);
});

test('rejouer les mots ratés : portée « words », jamais d’autre langue', async (t) => {
  const E = await setup(); t.after(E.close);
  await E.loginAll(); await E.addLists();
  const st = (await E.student.get('/api/state')).json;
  const nl = st.lists.find((l) => l.lang === 'nl'), en = st.lists.find((l) => l.lang === 'en');
  const ids = [nl.words[0].id, nl.words[1].id, nl.words[2].id, en.words[0].id];
  const r = await E.student.post('/api/sessions', { lang: 'nl', scope: 'words', wordIds: ids, game: 'cards' });
  assert.equal(r.status, 200, r.text);
  assert.deepEqual(r.json.words.map((w) => w.id).sort((a, b) => a - b), ids.slice(0, 3).sort((a, b) => a - b), 'le mot anglais est écarté');
  assert.equal((await E.student.post('/api/sessions', { lang: 'nl', scope: 'words', wordIds: [en.words[0].id], game: 'cards' })).status, 400);
});

test('fichiers statiques : pages, polices et en-têtes de sécurité', async (t) => {
  const E = await setup(); t.after(E.close);
  for (const p of ['/', '/parent', '/js/student.js', '/css/app.css', '/fonts/nunito-latin-700-normal.woff2']) {
    const res = await fetch(E.base + p);
    assert.equal(res.status, 200, p);
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.match(res.headers.get('content-security-policy'), /default-src 'self'/);
  }
  assert.equal((await fetch(E.base + '/api/inconnu')).status, 404);
  assert.equal((await fetch(E.base + '/data/lexiquest.db')).status, 404, 'la base n’est pas servie');
});

test('montage sous /lexiquest : cookie limité à ce chemin, tout fonctionne en chemins relatifs', async (t) => {
  const express = require('express'), http = require('node:http');
  const { open } = require('../lib/db');
  const { createUser } = require('../lib/users');
  const db = open(':memory:');
  createUser(db, { username: 'lea', display: 'Léa', role: 'student', password: 'motdepasse2' });
  const outer = express();
  outer.use('/lexiquest', require('../app').createApp(db));
  const server = http.createServer(outer); await new Promise((r) => server.listen(0, '127.0.0.1', r));
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}/lexiquest`;
  const res = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'lea', password: 'motdepasse2', portal: 'student' }) });
  assert.equal(res.status, 200);
  const cookie = res.headers.get('set-cookie');
  assert.match(cookie, /Path=\/lexiquest/); assert.match(cookie, /HttpOnly/); assert.match(cookie, /SameSite=Lax/);
  const st = await fetch(base + '/api/state', { headers: { Cookie: cookie.split(';')[0] } });
  assert.equal(st.status, 200);
  assert.equal((await fetch(base + '/')).status, 200);
  assert.match(cookie, /Max-Age=/);
  const brief = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'lea', password: 'motdepasse2', remember: false }) });
  const cookies = brief.headers.getSetCookie(); const last = cookies[cookies.length - 1];
  assert.doesNotMatch(last, /Max-Age=/);
  assert.equal((await fetch(base + '/api/state', { headers: { Cookie: last.split(';')[0] } })).status, 200);
});

test('un mot raté deux fois ne bloque pas la fin de séance (re-présenté une seule fois)', async (t) => {
  const E = await setup(); t.after(E.close);
  await E.loginAll(); await E.addLists();
  const s = (await E.student.post('/api/sessions', { lang: 'nl', scope: 'all', listIds: [], game: 'forge' })).json;
  const [first, ...rest] = s.words;
  const ev = (w, given) => E.student.post(`/api/sessions/${s.id}/events`, { events: [{ type: 'answer', wordId: w.id, qtype: 'forge', given }] });
  await ev(first, 'faux'); await ev(first, 'encore faux');
  for (const w of rest) { await ev(w, w.term); }
  const r = await E.student.post(`/api/sessions/${s.id}/end`, {});
  assert.equal(r.status, 200, r.text);
  assert.equal(r.json.bonus.perfect, 0);
  assert.equal(r.json.missed.length, 1);
});

test('première installation : le premier compte créé est le parent, une seule fois', async (t) => {
  const http = require('node:http');
  const { open } = require('../lib/db');
  const db = open(':memory:');
  const server = http.createServer(require('../app').createApp(db)); await new Promise((r) => server.listen(0, '127.0.0.1', r)); t.after(() => server.close());
  const { Client } = await setup().then((E) => { E.close(); return E; });
  const c = new Client(`http://127.0.0.1:${server.address().port}`);
  assert.equal((await c.get('/api/setup')).json.needed, true);
  assert.equal((await c.post('/api/setup', { name: 'Maman', username: 'a', password: 'court' })).status, 400);
  const r = await c.post('/api/setup', { name: 'Maman', username: 'maman', password: 'motdepasse1' });
  assert.equal(r.status, 200, r.text);
  assert.equal(r.json.me.role, 'parent');
  assert.equal((await c.get('/api/admin/students')).status, 200, 'connectée dès la création');
  assert.equal((await c.get('/api/setup')).json.needed, false);
  const again = new Client(c.base);
  assert.equal((await again.post('/api/setup', { name: 'Intrus', username: 'intrus', password: 'motdepasse1' })).status, 409);
  // le parent crée ensuite le compte élève
  const s = await c.post('/api/admin/students', { name: 'Léa', username: 'lea', password: 'motdepasse2' });
  assert.equal(s.status, 200, s.text);
});

test('aucune variable d’environnement : secret de session et clés VAPID gardés dans la base', async () => {
  const { open } = require('../lib/db'), Kv = require('../lib/kv'), Push = require('../lib/push');
  const db = open(':memory:');
  const a = Kv.secret(db, 'sessionSecret'), b = Kv.secret(db, 'sessionSecret');
  assert.equal(a, b); assert.match(a, /^[0-9a-f]{64}$/);
  const k1 = Push.publicKey(db), k2 = Push.publicKey(db);
  assert.equal(k1, k2); assert.ok(k1.length > 40);
});

test('auto-réparation : un package.json illisible dans node_modules est supprimé puis réinstallé', () => {
  const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
  const { repairIfNeeded } = require('../lib/repair-modules');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lq-repair-'));
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ dependencies: { express: '*', bcryptjs: '*' } }));
  fs.mkdirSync(path.join(dir, 'node_modules/express'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'node_modules/express/package.json'), '{"name": "expr');   // écriture interrompue
  fs.mkdirSync(path.join(dir, 'node_modules/bcryptjs'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'node_modules/bcryptjs/package.json'), '{"name":"bcryptjs"}');
  let installed = 0;
  const log = { warn() {}, log() {} };
  const fixed = repairIfNeeded(dir, { log, install: () => { installed++; fs.mkdirSync(path.join(dir, 'node_modules/express'), { recursive: true }); fs.writeFileSync(path.join(dir, 'node_modules/express/package.json'), '{"name":"express"}'); } });
  assert.deepEqual(fixed, ['express']); assert.equal(installed, 1);
  assert.deepEqual(repairIfNeeded(dir, { log, install: () => assert.fail('rien à réparer') }), []);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('chargement avec nouveaux essais si Node refuse un package.json (volume réseau)', () => {
  const { loadWithRetry } = require('../lib/retry-load');
  const waits = []; let n = 0;
  const flaky = () => { if (++n < 3) { const e = new Error('Invalid package config /x/package.json.'); e.code = 'ERR_INVALID_PACKAGE_CONFIG'; throw e; } return 'ok'; };
  assert.equal(loadWithRetry(flaky, { sleep: (ms) => waits.push(ms), log: { warn() {} } }), 'ok');
  assert.deepEqual(waits, [500, 1000]);
  const other = () => { throw new Error('autre erreur'); };
  assert.throws(() => loadWithRetry(other, { sleep() { assert.fail('pas de nouvel essai'); }, log: { warn() {} } }), /autre erreur/);
  const always = () => { const e = new Error('toujours'); e.code = 'ERR_INVALID_PACKAGE_CONFIG'; throw e; };
  assert.throws(() => loadWithRetry(always, { tries: 3, sleep() {}, log: { warn() {} } }), /toujours/);
});

test('notifications sans dépendance : chiffrement aes128gcm déchiffrable par le navigateur, signature VAPID valide', () => {
  const crypto = require('node:crypto'), W = require('../lib/webpush');
  const b64u = (b) => Buffer.from(b).toString('base64url');
  // l'appareil (navigateur) : paire de clés + secret d'authentification
  const ua = crypto.createECDH('prime256v1'); ua.generateKeys();
  const auth = crypto.randomBytes(16);
  const message = JSON.stringify({ title: 'Lexiquest', body: 'Une séance de 5 minutes ? é à ç' });
  const body = W.encrypt(message, b64u(ua.getPublicKey()), b64u(auth));
  // déchiffrement côté appareil (RFC 8291)
  const salt = body.subarray(0, 16), rs = body.readUInt32BE(16), idlen = body[20];
  assert.equal(rs, 4096); assert.equal(idlen, 65);
  const asPublic = body.subarray(21, 21 + idlen), cipher = body.subarray(21 + idlen);
  const shared = ua.computeSecret(asPublic);
  const ikm = Buffer.from(crypto.hkdfSync('sha256', shared, auth, Buffer.concat([Buffer.from('WebPush: info\0'), ua.getPublicKey(), asPublic]), 32));
  const cek = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16));
  const nonce = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12));
  const d = crypto.createDecipheriv('aes-128-gcm', cek, nonce);
  d.setAuthTag(cipher.subarray(cipher.length - 16));
  const plain = Buffer.concat([d.update(cipher.subarray(0, cipher.length - 16)), d.final()]);
  assert.equal(plain[plain.length - 1], 2, 'délimiteur de fin de message');
  assert.equal(plain.subarray(0, plain.length - 1).toString('utf8'), message);
  // signature VAPID : vérifiable avec la clé publique publiée
  const keys = W.generateKeys();
  const h = W.vapidHeader('https://fcm.googleapis.com/fcm/send/abc', keys, 'https://exemple.be');
  const m = /^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/.exec(h);
  assert.equal(m[4], keys.publicKey);
  const pub = Buffer.from(keys.publicKey, 'base64url');
  const vk = crypto.createPublicKey({ key: { kty: 'EC', crv: 'P-256', x: b64u(pub.subarray(1, 33)), y: b64u(pub.subarray(33, 65)) }, format: 'jwk' });
  assert.ok(crypto.verify('sha256', Buffer.from(m[1] + '.' + m[2]), { key: vk, dsaEncoding: 'ieee-p1363' }, Buffer.from(m[3], 'base64url')));
  const claims = JSON.parse(Buffer.from(m[2], 'base64url'));
  assert.equal(claims.aud, 'https://fcm.googleapis.com'); assert.equal(claims.sub, 'https://exemple.be');
  assert.ok(claims.exp > Date.now() / 1000);
});

test('mots de passe scrypt et sessions signées : cookie falsifié ou expiré refusé', async (t) => {
  const P = require('../lib/password');
  const h = P.hash('motdepasse1');
  assert.ok(P.verify('motdepasse1', h)); assert.ok(!P.verify('motdepasse2', h)); assert.ok(!P.verify('x', '')); assert.ok(!P.verify('x', 'bcrypt$a$b'));
  const E = await setup(); t.after(E.close);
  await E.loginAll();
  assert.equal((await E.student.get('/api/state')).status, 200);
  const forged = new E.Client(E.base); forged.cookie = E.student.cookie.replace(/\.[^;.]+$/, '.AAAA');
  assert.equal((await forged.get('/api/state')).status, 401, 'signature fausse');
  const old = E.student.cookie; await E.student.post('/api/auth/logout');
  const replay = new E.Client(E.base); replay.cookie = old;
  assert.equal((await replay.get('/api/state')).status, 401, 'session détruite à la déconnexion');
});

test('chiffrement des notifications conforme au vecteur de test du RFC 8291', () => {
  const W = require('../lib/webpush');
  const out = W.encrypt('When I grow up, I want to be a watermelon', 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4', 'BTBZMqHH6r4Tts7J_aSIgg',
    { privateKey: 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw', salt: 'DGv6ra1nlYgDCS1FRnbzlw' });
  assert.equal(out.toString('base64url'), 'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN');
});

test('invitation par lien : à usage unique, expire, rattache l’élève au parent', async (t) => {
  const E = await setup(); t.after(E.close); t.after(() => clock.reset());
  await E.loginAll();
  assert.equal((await E.student.post('/api/admin/invites', { name: 'Zoé' })).status, 403, 'réservé au parent');
  assert.equal((await E.parent.post('/api/admin/invites', { name: ' ' })).status, 400);
  const inv = (await E.parent.post('/api/admin/invites', { name: 'Zoé' })).json;
  assert.match(inv.token, /^[A-Za-z0-9_-]{30,}$/);
  assert.equal((await E.parent.get('/api/admin/invites')).json.invites.length, 1);
  assert.ok(!JSON.stringify(E.db.prepare('SELECT * FROM invites').all()).includes(inv.token), 'seule l’empreinte du jeton est gardée');
  const anon = new E.Client(E.base);
  assert.equal((await anon.get('/api/invite/jeton-bidon-0123456789abcdef')).status, 410);
  assert.equal((await anon.get('/api/invite/' + inv.token)).json.name, 'Zoé');
  assert.equal((await anon.post(`/api/invite/${inv.token}/accept`, { username: 'z', password: 'motdepasse9' })).status, 400, 'identifiant invalide : le lien reste utilisable');
  assert.equal((await anon.post(`/api/invite/${inv.token}/accept`, { username: 'lea', password: 'motdepasse9' })).status, 409, 'identifiant déjà pris');
  const ok = await anon.post(`/api/invite/${inv.token}/accept`, { username: 'zoe', password: 'motdepasse9' });
  assert.equal(ok.status, 200, ok.text);
  assert.equal(ok.json.me.role, 'student');
  assert.equal((await anon.get('/api/state')).status, 200, 'connectée dès la création');
  assert.equal((await new E.Client(E.base).get('/api/invite/' + inv.token)).status, 410, 'usage unique');
  const mine = (await E.parent.get('/api/admin/students')).json.students.map((s) => s.username);
  assert.ok(mine.includes('zoe'), 'rattachée au parent qui a invité');
  // expiration et annulation
  const old = (await E.parent.post('/api/admin/invites', { name: 'Max' })).json;
  clock.advance(8 * 864e5);
  assert.equal((await new E.Client(E.base).get('/api/invite/' + old.token)).status, 410, 'expirée après 7 jours');
  clock.reset();
  const cancel = (await E.parent.post('/api/admin/invites', { name: 'Ana' })).json;
  const list = (await E.parent.get('/api/admin/invites')).json.invites;
  assert.equal((await E.parent.req('DELETE', '/api/admin/invites/' + list[0].id, {})).status, 200);
  assert.equal((await new E.Client(E.base).get('/api/invite/' + cancel.token)).status, 410, 'annulée');
});

test('règles réglables par le parent : rotation, gemmes par jeu, pertes du Gardien (bornées)', async (t) => {
  const E = await setup(); t.after(E.close);
  await E.loginAll(); await E.addLists();
  const base = `/api/admin/students/${E.studentId}`;
  // valeurs hors bornes ramenées dans les limites
  const clamped = (await E.parent.req('PATCH', base, { rotMax: 99, rotNeed: 0, penCare: -5, gemDuel: 50 })).json.settings;
  assert.deepEqual([clamped.rotMax, clamped.rotNeed, clamped.penCare, clamped.gemDuel], [10, 1, 0, 9]);
  assert.equal((await E.parent.req('PATCH', base, { rotMax: 'abc' })).status, 400);
  assert.equal((await E.student.req('PATCH', base, { rotMax: 2 })).status, 403, 'réservé au parent');
  await E.parent.req('PATCH', base, { rotMax: 2, rotNeed: 1, gemDuel: 3, penCare: 10, penJoy: 0 });
  const st = (await E.student.get('/api/state')).json;
  assert.deepEqual(st.rules, { rot: { max: 2, need: 1 }, pen: { care: 10, joy: 0 }, gems: { cards: 1, duel: 3, scramble: 3, forge: 4, dir: 1 } });
  // gemmes : un Duel à 3 par bon mot (8 mots nl → 14 questions ? la liste en compte 8) ; combo +1 dès la 4e bonne réponse
  const r = await play(E.student, { lang: 'nl', scope: 'all', listIds: [], game: 'duel', dir: 'toFr' });
  assert.equal(r.end.json.points, 8 * 3 + 5);
  // rotation à 2 séances : verrouillé après la deuxième
  const second = await play(E.student, { lang: 'nl', scope: 'all', listIds: [], game: 'duel' });
  assert.equal(second.end.json.rotation.locked, true);
  assert.equal((await E.student.post('/api/sessions', { lang: 'nl', scope: 'all', listIds: [], game: 'duel' })).status, 409);
  // un seul autre jeu suffit désormais à le rouvrir
  const other = await play(E.student, { lang: 'nl', scope: 'all', listIds: [], game: 'cards' });
  assert.deepEqual(other.end.json.rotation.unlocked, ['duel']);
  // pertes du Gardien réglées
  const Pets = require('../lib/pets'), clockM = require('../lib/clock');
  const monday = new Date(2026, 5, 8, 0, 0, 0), h = Math.floor(monday.getTime() / 36e5), week = clockM.weekStart(clockM.dayIdx(monday));
  const sim = (pen) => Pets.simulate({ food: 100, care: 100, joy: 100, anchor_hour: h - 1 }, { seed: 1, createdHour: 0, wins: [], createdWeek: week - 7, nowHour: h, pen });
  const a = sim({ care: 10, joy: 0 });
  assert.equal(Math.round(a.care), 90); assert.equal(Math.round(a.joy), 99, 'seulement la baisse horaire, pas de perte du Gardien');
  // retour aux valeurs d'origine
  const d = (await E.student.get('/api/config')).json.rulesDefault;
  assert.deepEqual(d, { rot: { max: 3, need: 2 }, pen: { care: 40, joy: 20 }, gems: { cards: 1, duel: 2, scramble: 3, forge: 4, dir: 1 } });
});

test('modifier une liste : mots conservés gardent leur historique, ajouts et retraits, droits', async (t) => {
  const E = await setup(); t.after(E.close);
  await E.loginAll(); await E.addLists();
  const base = `/api/admin/students/${E.studentId}`;
  await play(E.student, { lang: 'nl', scope: 'all', listIds: [], game: 'cards' });
  let st = (await E.student.get('/api/state')).json;
  const list = st.lists.find((l) => l.lang === 'nl'), keepWord = list.words.find((w) => w.term === 'de trui');
  assert.ok(keepWord.streak >= 1, 'historique présent');
  const text = 'de trui = le pull (corrigé)\nhet nieuwe = le nouveau\nde broek = le pantalon\n';
  const r = await E.student.req('PUT', `/api/lists/${list.id}`, { name: 'Renommée', text });
  assert.equal(r.status, 200, r.text); assert.equal(r.json.words, 3);
  st = (await E.student.get('/api/state')).json;
  const after = st.lists.find((l) => l.id === list.id);
  assert.equal(after.name, 'Renommée');
  assert.deepEqual(after.words.map((w) => w.term), ['de trui', 'het nieuwe', 'de broek']);
  const same = after.words.find((w) => w.term === 'de trui');
  assert.equal(same.id, keepWord.id, 'même mot, même identifiant'); assert.equal(same.streak, keepWord.streak); assert.equal(same.fr, 'le pull (corrigé)');
  assert.equal(E.db.prepare('SELECT COUNT(*) AS n FROM word_stats WHERE word_id = ?').get(list.words.find((w) => w.term === 'het hemd').id).n, 0, 'mot retiré : historique retiré');
  assert.equal((await E.student.req('PUT', `/api/lists/${list.id}`, { name: 'x', text: 'un seul = mot' })).status, 400);
  // liste donnée par le parent : l'élève ne peut pas la modifier, le parent oui
  await E.parent.post(base + '/lists', { lang: 'en', name: 'Donnée', text: 'a = b\nc = d' });
  const given = (await E.student.get('/api/state')).json.lists.find((l) => l.name === 'Donnée');
  assert.equal((await E.student.req('PUT', `/api/lists/${given.id}`, { name: 'x', text: 'a = b\nc = d' })).status, 404);
  assert.equal((await E.parent.req('PUT', `${base}/lists/${given.id}`, { name: 'Donnée v2', text: 'a = b\nc = d\ne = f' })).status, 200);
  assert.equal((await E.student.get('/api/state')).json.lists.find((l) => l.id === given.id).words.length, 3);
  // un autre élève n'est pas touché
  const o = new E.Client(E.base); require('../lib/users').createUser(E.db, { username: 'max', display: 'Max', role: 'student', password: 'motdepasse5', parentId: E.parentId });
  await o.post('/api/auth/login', { username: 'max', password: 'motdepasse5', portal: 'student' });
  assert.equal((await o.req('PUT', `/api/lists/${list.id}`, { name: 'pirate', text: 'a = b\nc = d' })).status, 404);
});

test('listes à plusieurs colonnes : formes, en-têtes, correction par forme', async (t) => {
  const E = await setup(); t.after(E.close);
  await E.loginAll();
  const txt = '# Infinitif = Prétérit = Participe passé = Traduction\ngo = went = gone = aller\nbe = was = been = être\nsee = saw = seen = voir';
  const c = await E.student.post('/api/lists', { lang: 'en', name: 'Irréguliers', text: txt });
  assert.equal(c.status, 200);
  const lists = (await E.student.get('/api/state')).json.lists || (await E.student.get('/api/lists')).json.lists;
  const L = lists.find((l) => l.name === 'Irréguliers');
  assert.deepEqual(L.headers, ['Infinitif', 'Prétérit', 'Participe passé', 'Traduction']);
  assert.deepEqual(L.words.find((w) => w.term === 'go').forms, ['went', 'gone']);
  const s = (await E.student.post('/api/sessions', { lang: 'en', scope: 'all', listIds: [], game: 'forge' })).json;
  const w = s.words.find((x) => x.term === 'go');
  const ev = (e) => E.student.post(`/api/sessions/${s.id}/events`, { events: [{ type: 'answer', wordId: w.id, qtype: 'forge', ...e }] });
  assert.equal((await ev({ given: 'went | gone', form: -1 })).json.results[0].ok, true, 'ligne entière');
  assert.equal((await ev({ given: 'went | goed', form: -1 })).json.results[0].ok, false);
  assert.equal((await ev({ given: 'went' })).status, 400, 'forme demandée obligatoire');
  assert.equal((await ev({ given: 'gone', form: 5 })).status, 400, 'forme hors liste');
  const d = await E.student.post('/api/sessions', { lang: 'en', scope: 'all', listIds: [], game: 'duel' });
  const dw = d.json.words.find((x) => x.term === 'be');
  const r = await E.student.post(`/api/sessions/${d.json.id}/events`, { events: [{ type: 'answer', wordId: dw.id, qtype: 'duel', given: 'been', form: 1 }] });
  assert.equal(r.json.results[0].ok, true, 'QCM : participe passé');
  const bad = await E.student.post(`/api/sessions/${d.json.id}/events`, { events: [{ type: 'answer', wordId: dw.id, qtype: 'duel', given: 'x', form: -1 }] });
  assert.equal(bad.status, 400, 'toute la ligne seulement à l’écriture');
  // une liste à 2 colonnes reste inchangée, et un tableau de 3 colonnes donne 3 colonnes
  await E.student.post('/api/lists', { lang: 'nl', name: 'Simple', text: 'a = b\nc = d' });
  const t3 = await E.student.post('/api/lists', { lang: 'nl', name: 'Trois', text: 'gaan;ging;aller\nzijn;was;être' });
  assert.equal(t3.status, 200);
});

test('copie de listes entre élèves du même parent ; aperçu « comme l’élève » et retour', async (t) => {
  const E = await setup(); t.after(E.close);
  await E.loginAll();
  const { createUser } = require('../lib/users');
  const sid2 = createUser(E.db, { username: 'max', display: 'Max', role: 'student', password: 'motdepasse3', parentId: E.parentId });
  const other = createUser(E.db, { username: 'zoe', display: 'Zoé', role: 'student', password: 'motdepasse4', parentId: null });
  const c = await E.student.post('/api/lists', { lang: 'nl', name: 'Verbes', text: '# Infinitif = Participe = Traduction\ngaan = gegaan = aller\nkomen = gekomen = venir' });
  assert.equal(c.status, 200);
  // copie : listes, formes, en-têtes ; refus vers un élève d'un autre parent
  const ok = await E.parent.post(`/api/admin/students/${E.studentId}/lists/copy`, { listIds: [c.json.id], to: [sid2] });
  assert.equal(ok.status, 200); assert.equal(ok.json.copied, 1);
  const bad = await E.parent.post(`/api/admin/students/${E.studentId}/lists/copy`, { listIds: [c.json.id], to: [other] });
  assert.equal(bad.status, 404);
  const max = new E.Client(E.base);
  assert.equal((await max.post('/api/auth/login', { username: 'max', password: 'motdepasse3', portal: 'student' })).status, 200);
  const L = (await max.get('/api/state')).json.lists.find((l) => l.name === 'Verbes');
  assert.deepEqual(L.headers, ['Infinitif', 'Participe', 'Traduction']);
  assert.deepEqual(L.words[0].forms, ['gegaan']);
  assert.equal(L.by, 'parent');
  // aperçu : la session parent voit l'application de l'élève, puis revient
  assert.equal((await E.parent.get('/api/state')).status, 403, 'parent : pas d’état élève');
  assert.equal((await E.parent.post(`/api/admin/students/${sid2}/view-as`, {})).status, 200);
  const st = await E.parent.get('/api/state');
  assert.equal(st.status, 200); assert.equal(st.json.me.name, 'Max'); assert.equal(st.json.me.preview, true);
  assert.equal((await E.parent.get('/api/admin/students')).status, 403, 'en aperçu : plus d’accès parent');
  assert.equal((await E.parent.post('/api/auth/unview', {})).status, 200);
  assert.equal((await E.parent.get('/api/admin/students')).status, 200);
  assert.equal((await E.student.post('/api/auth/unview', {})).status, 400, 'pas d’aperçu en cours');
});

test('gestion des élèves : renommer, suppression confirmée par l’identifiant, données liées effacées', async (t) => {
  const E = await setup(); t.after(E.close);
  await E.loginAll(); await E.addLists();
  const list = await E.parent.get('/api/admin/students');
  assert.equal(list.json.students[0].lists, 2);
  assert.equal(list.json.students[0].lastAt, null);
  const base = `/api/admin/students/${E.studentId}`;
  assert.equal((await E.parent.req('PATCH', base, { name: '  ' })).status, 400, 'nom vide refusé');
  assert.equal((await E.parent.req('PATCH', base, { name: 'Léa-Rose' })).status, 200);
  assert.equal((await E.parent.get('/api/admin/students')).json.students[0].name, 'Léa-Rose');
  assert.equal((await E.parent.req('DELETE', base, {})).status, 400, 'confirmation obligatoire');
  assert.equal((await E.parent.req('DELETE', base, { confirm: 'autre' })).status, 400);
  assert.equal((await E.parent.req('DELETE', base, { confirm: 'LEA' })).status, 200, 'identifiant, sans tenir compte de la casse');
  assert.equal((await E.parent.get('/api/admin/students')).json.students.length, 0);
  assert.equal(E.db.prepare('SELECT COUNT(*) AS n FROM lists WHERE owner_id = ?').get(E.studentId).n, 0);
  assert.equal(E.db.prepare('SELECT COUNT(*) AS n FROM words').get().n, 0, 'mots effacés avec les listes');
  assert.equal((await E.student.get('/api/state')).status, 401, 'la session de l’élève supprimé n’ouvre plus rien');
});

test('réveil affamé : l’énergie est divisée par deux à 8 h, sans baisse heure par heure la nuit', () => {
  const Pets = require('../lib/pets');
  const eve = new Date(2026, 5, 10, 19, 0, 0), h0 = Math.floor(eve.getTime() / 36e5);
  const run = (hours) => Pets.simulate({ food: 100, care: 100, joy: 100, anchor_hour: h0 }, { seed: 1, createdHour: h0 + 24 * 50, wins: [{ day: 0, lang: 'nl' }], createdWeek: 1e9, nowHour: h0 + hours });
  assert.equal(Math.round(run(1).food), 99, '19 h → 20 h : −0,6 (le jour)');
  assert.equal(Math.round(run(12).food), 99, 'à 7 h : rien n’a baissé pendant le sommeil');
  assert.equal(Math.round(run(13).food), 50, 'à 8 h : moitié');
});
