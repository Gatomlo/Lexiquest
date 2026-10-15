'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { setup, play } = require('./helpers');

const base = { lang: 'nl', scope: 'all', listIds: [] };

test('sens « auto » : le moins travaillé d’abord, bonus de gemmes dans ce sens seulement', async (t) => {
  const E = await setup(); t.after(E.close);
  await E.loginAll(); await E.addLists();
  // sans historique : égalité → langue → français, sans bonus
  let r = await play(E.student, { ...base, game: 'cards', dir: 'auto' });
  assert.equal(r.session.dir, 'toFr');
  assert.equal(r.session.dirBonus, 0);
  assert.equal(r.end.json.points, 8 + 5, 'cartes : 1 gemme par bon mot, combo +1 dès la 4e bonne réponse');
  // l'élève n'a travaillé que langue → français : auto propose français → langue, avec bonus (+1 par bon mot du 1er coup)
  r = await play(E.student, { ...base, game: 'duel', dir: 'auto' });
  assert.equal(r.session.dir, 'toTarget');
  assert.equal(r.session.dirBonus, 1);
  const withBonus = r.end.json.points;
  // choisir à la main le sens déjà travaillé ne rapporte pas de bonus
  r = await play(E.student, { ...base, game: 'cards', dir: 'toFr' });
  assert.equal(r.session.dirBonus, 0);
  assert.equal(withBonus, 8 * 3 + 5, 'duel : (2 + 1 de bonus) par mot, combo +1 dès la 4e');
  const rules = (await E.parent.get(`/api/admin/students/${E.studentId}/settings`)).json.settings;
  assert.equal(rules.gemDir, 1);
});

test('bonus de sens : réglable par le parent (0 à 3), calculé par le serveur', async (t) => {
  const E = await setup(); t.after(E.close);
  await E.loginAll(); await E.addLists();
  await E.parent.req('PATCH', `/api/admin/students/${E.studentId}`, { rotMax: 10 });
  for (let i = 0; i < 3; i++) { await play(E.student, { ...base, game: 'cards', dir: 'toFr' }); }
  let r = await E.parent.req('PATCH', `/api/admin/students/${E.studentId}`, { gemDir: 9 });
  assert.equal(r.json.settings.gemDir, 3, 'borné à 3');
  await E.parent.req('PATCH', `/api/admin/students/${E.studentId}`, { gemDir: 0 });
  r = await play(E.student, { ...base, game: 'cards', dir: 'toTarget' });
  assert.equal(r.session.dirBonus, 1, 'le sens reste « délaissé »');
  const noBonus = r.end.json.points;
  await E.parent.req('PATCH', `/api/admin/students/${E.studentId}`, { gemDir: 2 });
  r = await play(E.student, { ...base, game: 'cards', dir: 'toTarget' });
  // 8 mots, tous réussis du premier coup : +2 par mot avec le bonus
  assert.equal(r.end.json.points - noBonus, 8 * 2);
});

test('statistiques : équilibre des sens par liste et par langue', async (t) => {
  const E = await setup(); t.after(E.close);
  await E.loginAll(); await E.addLists();
  await play(E.student, { ...base, game: 'cards', dir: 'toFr' });
  await play(E.student, { ...base, game: 'cards', dir: 'toFr' });
  await play(E.student, { ...base, game: 'forge' });
  const st = (await E.student.get('/api/stats')).json;
  assert.equal(st.dirs.langs.nl.toFr.n, 16);
  assert.equal(st.dirs.langs.nl.toTarget.n, 8);
  assert.equal(st.dirs.langs.en.toFr.n + st.dirs.langs.en.toTarget.n, 0);
  const l = st.dirs.lists.find((x) => x.lang === 'nl');
  assert.equal(l.toFr.n, 16); assert.equal(l.toFr.ok, 16);
  const ov = (await E.parent.get(`/api/admin/students/${E.studentId}/overview`)).json;
  assert.equal(ov.stats.dirs.lists.length, 2);
});

test('rejouer la sélection : les mots les moins travaillés dans le sens choisi passent en premier', async (t) => {
  const E = await setup(); t.after(E.close);
  await E.loginAll(); await E.addLists();
  // 8 mots, 5 par séance de duel : deux séances langue → français couvrent des mots, pas forcément tous
  const a = await play(E.student, { ...base, game: 'duel', dir: 'toFr' });
  const seen = new Set(a.session.words.map((w) => w.id));
  const b = await play(E.student, { ...base, game: 'duel', dir: 'toFr' });
  const fresh = b.session.words.filter((w) => !seen.has(w.id)).length;
  assert.equal(fresh, 8 - seen.size, 'tous les mots jamais vus dans ce sens sont repris d’abord');
});

test('sens imposé par le parent : le choix de l’élève est ignoré (jeux à choix de sens)', async (t) => {
  const E = await setup(); t.after(E.close);
  await E.loginAll(); await E.addLists();
  await play(E.student, { ...base, game: 'cards', dir: 'toFr' });
  let r = await play(E.student, { ...base, game: 'duel', dir: 'toFr' });
  assert.equal(r.session.dir, 'toFr', 'libre par défaut');
  await E.parent.req('PATCH', `/api/admin/students/${E.studentId}`, { dirForce: true });
  assert.equal((await E.student.get('/api/state')).json.rules.dirForce, true);
  r = await play(E.student, { ...base, game: 'cards', dir: 'toFr' });
  assert.equal(r.session.dir, 'toTarget', 'langue → français déjà en avance : imposé français → langue');
  assert.equal(r.session.dirBonus, 1);
  await E.parent.req('PATCH', `/api/admin/students/${E.studentId}`, { dirForce: false });
  r = await play(E.student, { ...base, game: 'duel', dir: 'toFr' });
  assert.equal(r.session.dir, 'toFr');
});
