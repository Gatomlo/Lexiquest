'use strict';
// Connexion centralisee de node-gateway : req.gateway (pose par la passerelle) ouvre une session locale pour
// le compte PARENT de meme identifiant (jamais un eleve, aucun compte cree) ; cette session tombe des que la
// passerelle ne se porte plus garante. Une connexion locale normale n'est jamais touchee.
const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const express = require('express');
const { setup } = require('./helpers');
const { createApp } = require('../app');

const gw = (login, role = 'member') => ({ 'x-test-gateway': JSON.stringify({ app: 'lexiquest', role, user: { login, name: login, email: null, isSuper: false } }) });

async function boot(t) {
  const E = await setup(); t.after(E.close);
  const outer = express();
  outer.use((req, res, next) => { const h = req.get('x-test-gateway'); if (h) req.gateway = JSON.parse(h); next(); });
  outer.use('/lex', createApp(E.db));
  const srv = http.createServer(outer);
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  t.after(() => srv.close());
  const base = `http://127.0.0.1:${srv.address().port}/lex`;
  return { E, me: (headers = {}) => fetch(base + '/api/me', { headers }) };
}

test('identifiant de la passerelle -> compte parent de meme identifiant (cookie limite au chemin)', async (t) => {
  const { me } = await boot(t);
  const r = await me(gw('PAPA'));
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.equal(j.me.role, 'parent');
  const cookie = r.headers.get('set-cookie');
  assert.match(cookie, /Path=\/lex/);
  assert.match(cookie, /Max-Age=7200\b/);
  assert.match(cookie, /HttpOnly/);
  // tant que la passerelle se porte garante, la session suit
  const again = await me({ ...gw('papa'), cookie: cookie.split(';')[0] });
  assert.equal(again.status, 200);
});

test('la session passerelle tombe des que la passerelle ne se porte plus garante', async (t) => {
  const { me } = await boot(t);
  const cookie = (await me(gw('papa'))).headers.get('set-cookie').split(';')[0];
  assert.equal((await me({ cookie })).status, 401, 'sans passerelle (deconnexion / droit retire)');
  const c2 = (await me(gw('papa'))).headers.get('set-cookie').split(';')[0];
  assert.equal((await me({ ...gw('autre'), cookie: c2 })).status, 401, 'autre compte');
});

test('jamais un eleve, aucun compte cree, anonyme ou sans droit => pas connecte', async (t) => {
  const { E, me } = await boot(t);
  const before = E.db.prepare('SELECT COUNT(*) n FROM users').get().n;
  for (const h of [gw('lea'), gw('inconnu'), {}, { 'x-test-gateway': JSON.stringify({ app: 'lexiquest', role: null, user: { login: 'papa' } }) }]) {
    assert.equal((await me(h)).status, 401);
  }
  assert.equal(E.db.prepare('SELECT COUNT(*) n FROM users').get().n, before);
});

test('connexion locale normale inchangee (mot de passe), meme avec une identite de passerelle differente', async (t) => {
  const { E } = await boot(t);
  await E.loginAll();
  const me = await E.parent.get('/api/me');
  assert.equal(me.status, 200);
  assert.equal(me.json.me.role, 'parent');
});

test('crochet gatewayAccounts : parents seulement, sans aucun secret', async (t) => {
  const { E } = await boot(t);
  const list = createApp(E.db).gatewayAccounts();
  assert.deepStrictEqual(list.map((a) => a.key), ['papa'], 'le parent, jamais un eleve');
  assert.doesNotMatch(JSON.stringify(list), /hash|passw|token|secret|scrypt|bcrypt/i);
});
