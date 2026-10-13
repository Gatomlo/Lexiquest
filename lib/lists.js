'use strict';
const clock = require('./clock');
const { LANGS } = require('./config');
const { HttpError } = require('./users');
const { tx } = require('./db');

const MAX_WORDS = 500;

const MAX_COLS = 5;
/** en-têtes par défaut selon le nombre de colonnes (première = mot, dernière = traduction) */
const DEFAULT_HEADERS = {
  3: ['Infinitif', 'Forme 2', 'Traduction'],
  4: ['Infinitif', 'Prétérit', 'Participe passé', 'Traduction'],
  5: ['Infinitif', 'Prétérit sg.', 'Prétérit pl.', 'Participe passé', 'Traduction'],
};

/**
 * « mot = traduction », une paire par ligne ; 3 à 5 colonnes pour les verbes irréguliers :
 * « go = went = gone = aller » (premier = mot, dernier = traduction, les autres = formes à retenir).
 * Une ligne « # Infinitif = Prétérit = Participe = Traduction » nomme les colonnes.
 * Renvoie { cols, headers, words: [{ term, fr, forms? }], skipped } ; `headers` est null pour une liste à 2 colonnes.
 */
function parseTable(text) {
  const unquote = (x) => x.trim().replace(/^"(.*)"$/, '$1').trim();
  const sepOf = (line) => (line.includes('=') ? '=' : line.includes('\t') ? '\t' : line.includes(';') ? ';' : null);
  const rows = []; let head = null;
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.replace(/^\ufeff/, '').trim();
    const sep = sepOf(line);
    if (!sep) { continue; }
    if (line.startsWith('#')) { if (!head) { head = line.replace(/^#\s*/, '').split(sep).map(unquote); } continue; }
    const cells = line.split(sep).map(unquote);
    while (cells.length > 2 && !cells[cells.length - 1]) { cells.pop(); }
    if (cells.length >= 2) { rows.push({ sep, cells }); }
  }
  const count = new Map();
  for (const r of rows) { if (r.cells.length >= 3 && r.cells.length <= MAX_COLS) { count.set(r.cells.length, (count.get(r.cells.length) || 0) + 1); } }
  let cols = 2, best = 0, multiRows = 0;
  for (const [n, c] of count) { multiRows += c; if (c > best) { best = c; cols = n; } }
  if (multiRows < rows.length * 0.6) { cols = 2; }
  const words = []; let skipped = 0;
  for (const r of rows) {
    let w;
    if (cols === 2) {
      w = { term: r.cells[0], fr: r.sep === '=' ? r.cells.slice(1).join('=') : r.cells[1] };
    } else if (r.cells.length === cols) {
      w = { term: r.cells[0], fr: r.cells[cols - 1], forms: r.cells.slice(1, cols - 1) };
      if (w.forms.some((f) => !f || f.length > 120)) { w = null; }
    } else { w = null; }
    if (w && w.term && w.fr && w.term.length <= 120 && w.fr.length <= 200) { words.push(w); } else { skipped++; }
  }
  let headers = null;
  if (cols > 2) { headers = head && head.length === cols && head.every(Boolean) ? head.map((h) => h.slice(0, 40)) : DEFAULT_HEADERS[cols].slice(); }
  return { cols, headers, words, skipped };
}
function parseWords(text) { return parseTable(text).words; }

function createList(db, ownerId, { lang, name, sub, text, assignedBy = null }) {
  if (!LANGS.includes(lang)) { throw new HttpError(400, 'Langue invalide.'); }
  const { words, headers } = parseTable(text);
  if (words.length < 2) { throw new HttpError(400, 'Il faut au moins 2 mots (un par ligne : mot = traduction).'); }
  if (words.length > MAX_WORDS) { throw new HttpError(400, `Maximum ${MAX_WORDS} mots par liste.`); }
  name = String(name || '').trim().slice(0, 80) || 'Nouvelle liste';
  return tx(db, () => {
    const id = Number(db.prepare('INSERT INTO lists (owner_id, lang, name, sub, assigned_by, created_at, headers) VALUES (?,?,?,?,?,?,?)')
      .run(ownerId, lang, name, String(sub || '').slice(0, 80), assignedBy, clock.nowMs(), headers ? JSON.stringify(headers) : null).lastInsertRowid);
    const ins = db.prepare('INSERT INTO words (list_id, term, fr, position, forms) VALUES (?,?,?,?,?)');
    words.forEach((w, i) => ins.run(id, w.term, w.fr, i, w.forms ? JSON.stringify(w.forms) : null));
    return id;
  });
}

/** modifie nom et mots ; les mots dont le terme est conservé gardent leur historique, les autres sont ajoutés ou retirés */
function updateList(db, listId, { name, sub, text }) {
  const { words, headers } = parseTable(text);
  if (words.length < 2) { throw new HttpError(400, 'Il faut au moins 2 mots (un par ligne : mot = traduction).'); }
  if (words.length > MAX_WORDS) { throw new HttpError(400, `Maximum ${MAX_WORDS} mots par liste.`); }
  return tx(db, () => {
    const pool = new Map(), before = db.prepare('SELECT id, term FROM words WHERE list_id = ? ORDER BY position').all(listId);
    for (const w of before) { const k = w.term.toLowerCase(); if (!pool.has(k)) { pool.set(k, []); } pool.get(k).push(w.id); }
    const keep = new Set(), upd = db.prepare('UPDATE words SET term = ?, fr = ?, position = ?, forms = ? WHERE id = ?'), ins = db.prepare('INSERT INTO words (list_id, term, fr, position, forms) VALUES (?,?,?,?,?)');
    words.forEach((w, i) => {
      const q = pool.get(w.term.toLowerCase()), id = q && q.shift(), forms = w.forms ? JSON.stringify(w.forms) : null;
      if (id) { upd.run(w.term, w.fr, i, forms, id); keep.add(id); } else { keep.add(Number(ins.run(listId, w.term, w.fr, i, forms).lastInsertRowid)); }
    });
    db.prepare('UPDATE lists SET headers = ? WHERE id = ?').run(headers ? JSON.stringify(headers) : null, listId);
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
  const lists = db.prepare('SELECT id, lang, name, sub, assigned_by, headers FROM lists WHERE owner_id = ? ORDER BY id').all(userId);
  const words = db.prepare(`SELECT w.id, w.list_id, w.term, w.fr, w.forms, COALESCE(s.streak, 0) AS streak
    FROM words w JOIN lists l ON l.id = w.list_id LEFT JOIN word_stats s ON s.word_id = w.id AND s.user_id = ?
    WHERE l.owner_id = ? ORDER BY w.list_id, w.position`).all(userId, userId);
  const by = new Map(lists.map((l) => [l.id, { id: l.id, lang: l.lang, name: l.name, sub: l.sub, by: l.assigned_by ? 'parent' : 'moi', headers: l.headers ? JSON.parse(l.headers) : null, words: [] }]));
  for (const w of words) { by.get(w.list_id).words.push({ id: w.id, term: w.term, fr: w.fr, forms: w.forms ? JSON.parse(w.forms) : null, streak: Number(w.streak) }); }
  return [...by.values()];
}

module.exports = { parseTable, parseWords, createList, updateList, deleteList, listsOf };
