'use strict';
const clock = require('./clock');
const { LANGS } = require('./config');
const { HttpError } = require('./users');
const { tx } = require('./db');

const MAX_WORDS = 500;

/** « mot = traduction », une paire par ligne */
function parseWords(text) {
  const out = [];
  const unquote = (x) => x.trim().replace(/^"(.*)"$/, '$1').trim();
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.replace(/^\ufeff/, '');
    // « mot = traduction », ou une ligne de tableur : tabulation ou point-virgule
    const sep = line.includes('=') ? '=' : line.includes('\t') ? '\t' : line.includes(';') ? ';' : null;
    if (!sep) { continue; }
    const parts = line.split(sep);
    const term = unquote(parts[0]), fr = unquote(sep === '=' ? parts.slice(1).join('=') : parts[1]);
    if (term && fr && term.length <= 120 && fr.length <= 200) { out.push({ term, fr }); }
  }
  return out;
}

function createList(db, ownerId, { lang, name, sub, text, assignedBy = null }) {
  if (!LANGS.includes(lang)) { throw new HttpError(400, 'Langue invalide.'); }
  const words = parseWords(text);
  if (words.length < 2) { throw new HttpError(400, 'Il faut au moins 2 mots (un par ligne : mot = traduction).'); }
  if (words.length > MAX_WORDS) { throw new HttpError(400, `Maximum ${MAX_WORDS} mots par liste.`); }
  name = String(name || '').trim().slice(0, 80) || 'Nouvelle liste';
  return tx(db, () => {
    const id = Number(db.prepare('INSERT INTO lists (owner_id, lang, name, sub, assigned_by, created_at) VALUES (?,?,?,?,?,?)')
      .run(ownerId, lang, name, String(sub || '').slice(0, 80), assignedBy, clock.nowMs()).lastInsertRowid);
    const ins = db.prepare('INSERT INTO words (list_id, term, fr, position) VALUES (?,?,?,?)');
    words.forEach((w, i) => ins.run(id, w.term, w.fr, i));
    return id;
  });
}

/** modifie nom et mots ; les mots dont le terme est conservé gardent leur historique, les autres sont ajoutés ou retirés */
function updateList(db, listId, { name, sub, text }) {
  const words = parseWords(text);
  if (words.length < 2) { throw new HttpError(400, 'Il faut au moins 2 mots (un par ligne : mot = traduction).'); }
  if (words.length > MAX_WORDS) { throw new HttpError(400, `Maximum ${MAX_WORDS} mots par liste.`); }
  return tx(db, () => {
    const pool = new Map(), before = db.prepare('SELECT id, term FROM words WHERE list_id = ? ORDER BY position').all(listId);
    for (const w of before) { const k = w.term.toLowerCase(); if (!pool.has(k)) { pool.set(k, []); } pool.get(k).push(w.id); }
    const keep = new Set(), upd = db.prepare('UPDATE words SET term = ?, fr = ?, position = ? WHERE id = ?'), ins = db.prepare('INSERT INTO words (list_id, term, fr, position) VALUES (?,?,?,?)');
    words.forEach((w, i) => {
      const q = pool.get(w.term.toLowerCase()), id = q && q.shift();
      if (id) { upd.run(w.term, w.fr, i, id); keep.add(id); } else { keep.add(Number(ins.run(listId, w.term, w.fr, i).lastInsertRowid)); }
    });
    for (const w of before) { if (!keep.has(w.id)) { db.prepare('DELETE FROM word_stats WHERE word_id = ?').run(w.id); db.prepare('DELETE FROM words WHERE id = ?').run(w.id); } }
    db.prepare('UPDATE lists SET name = COALESCE(?, name), sub = COALESCE(?, sub), version = version + 1 WHERE id = ?')
      .run(name === undefined ? null : (String(name).trim().slice(0, 80) || null), sub === undefined ? null : String(sub).slice(0, 80), listId);
    return words.length;
  });
}

function deleteList(db, ownerId, listId) {
  const r = db.prepare('DELETE FROM lists WHERE id = ? AND owner_id = ? AND assigned_by IS NULL').run(listId, ownerId);
  if (!r.changes) { throw new HttpError(404, 'Liste introuvable (ou donnée par le parent).'); }
}

/** listes de l'élève avec mots et série de bonnes réponses */
function listsOf(db, userId) {
  const lists = db.prepare('SELECT id, lang, name, sub, assigned_by FROM lists WHERE owner_id = ? ORDER BY id').all(userId);
  const words = db.prepare(`SELECT w.id, w.list_id, w.term, w.fr, COALESCE(s.streak, 0) AS streak
    FROM words w JOIN lists l ON l.id = w.list_id LEFT JOIN word_stats s ON s.word_id = w.id AND s.user_id = ?
    WHERE l.owner_id = ? ORDER BY w.list_id, w.position`).all(userId, userId);
  const by = new Map(lists.map((l) => [l.id, { id: l.id, lang: l.lang, name: l.name, sub: l.sub, by: l.assigned_by ? 'parent' : 'moi', words: [] }]));
  for (const w of words) { by.get(w.list_id).words.push({ id: w.id, term: w.term, fr: w.fr, streak: Number(w.streak) }); }
  return [...by.values()];
}

module.exports = { parseWords, createList, updateList, deleteList, listsOf };
