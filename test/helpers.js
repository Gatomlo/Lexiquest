'use strict';
process.env.LEXIQUEST_DB = ':memory:';
process.env.SESSION_SECRET = 'test-secret';
const http = require('node:http');
const appModule = require('../app');
const { open } = require('../lib/db');
const { createUser } = require('../lib/users');
const clock = require('../lib/clock');

const NL = 'de trui = le pull\nhet hemd = la chemise\nde broek = le pantalon\nde rok = la jupe\nde jas = le manteau\nde schoenen = les chaussures\nde sokken = les chaussettes\nde muts = le bonnet\n';
const EN = 'shy = timide\nstubborn = têtu\nreliable = fiable\nmoody = lunatique\nconfident = sûr de soi\ncurious = curieux\nlazy = paresseux\nanxious = anxieux\n';

class Client {
  constructor(base) { this.base = base; this.cookie = ''; }
  async req(method, path, body) {
    const res = await fetch(this.base + path, {
      method, headers: { 'Content-Type': 'application/json', ...(this.cookie ? { Cookie: this.cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const sc = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
    if (sc.length) { this.cookie = sc.map((c) => c.split(';')[0]).join('; '); }
    const text = await res.text();
    let json = null; try { json = JSON.parse(text); } catch (_) { /* pas du JSON */ }
    return { status: res.status, json, text, headers: res.headers };
  }
  get(p) { return this.req('GET', p); }
  post(p, b) { return this.req('POST', p, b || {}); }
}

async function setup() {
  const db = open(':memory:');
  const app = appModule.createApp(db);
  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const parentId = createUser(db, { username: 'papa', display: 'Parent', role: 'parent', password: 'motdepasse1' });
  const studentId = createUser(db, { username: 'lea', display: 'Léa', role: 'student', password: 'motdepasse2', parentId });
  const student = new Client(base), parent = new Client(base);
  clock.reset();
  return {
    db, base, student, parent, parentId, studentId, Client,
    async loginAll() {
      let r = await student.post('/api/auth/login', { username: 'lea', password: 'motdepasse2', portal: 'student' }); if (r.status !== 200) { throw new Error('login élève ' + r.text); }
      r = await parent.post('/api/auth/login', { username: 'papa', password: 'motdepasse1', portal: 'parent' }); if (r.status !== 200) { throw new Error('login parent ' + r.text); }
    },
    async addLists() {
      await student.post('/api/lists', { lang: 'nl', name: 'Les vêtements', text: NL });
      await student.post('/api/lists', { lang: 'en', name: 'Feelings', text: EN });
    },
    close: () => new Promise((r) => server.close(r)),
  };
}

/** joue une séance entière sans faute (ou avec une faute sur le premier mot si `miss`) */
async function play(client, opts, { miss = false, finish = true } = {}) {
  const s = await client.post('/api/sessions', opts);
  if (s.status !== 200) { return { start: s }; }
  const g = s.json.game, qtype = g === 'boss' ? 'duel' : g;
  const exp = (w) => (s.json.dir === 'toFr' ? w.fr : w.term);
  let first = true;
  for (const w of s.json.words) {
    if (miss && first) {
      await client.post(`/api/sessions/${s.json.id}/events`, { events: [{ type: 'answer', wordId: w.id, qtype, given: 'zzz', ok: false, ms: 1000 }] });
    }
    first = false;
    await client.post(`/api/sessions/${s.json.id}/events`, { events: [{ type: 'answer', wordId: w.id, qtype, given: exp(w), ok: true, ms: 1500 }] });
    if (g === 'boss') { break; }
  }
  return { start: s, session: s.json, end: finish ? await client.post(`/api/sessions/${s.json.id}/end`, { activeSec: 120 }) : null };
}

/** bat le Gardien : 8 bonnes réponses d'affilée */
async function beatBoss(client, lang) {
  const s = await client.post('/api/sessions', { lang, scope: 'all', listIds: [], game: 'boss' });
  if (s.status !== 200) { return { start: s }; }
  for (let i = 0; i < 8; i++) {
    const w = s.json.words[i];
    await client.post(`/api/sessions/${s.json.id}/events`, { events: [{ type: 'answer', wordId: w.id, qtype: 'duel', given: w.term, ok: true, ms: 800 }] });
  }
  return { start: s, end: await client.post(`/api/sessions/${s.json.id}/end`, { activeSec: 90 }) };
}

module.exports = { setup, play, beatBoss, clock, NL, EN };
