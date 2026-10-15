'use strict';
/* Équilibre des sens : langue → français (« toFr ») et français → langue (« toTarget »).
 * On compte les réponses du premier essai de séances terminées, sur 30 jours. Les jeux d'écriture
 * (Lettres folles, Forge, Gardien) sont toujours français → langue. Le sens le moins travaillé de la sélection
 * est proposé par défaut (« auto ») et rapporte un bonus de gemmes par bon mot (règle `gemDir`). */
const clock = require('./clock');

const DIRS = ['toFr', 'toTarget'];
const SPAN_DAYS = 30;
const other = (d) => (d === 'toFr' ? 'toTarget' : 'toFr');

/** réponses du premier essai par mot et par sens : Map(wordId → { toFr, toTarget }) */
function wordCounts(db, userId, wordIds) {
  const out = new Map();
  const ids = [...new Set(wordIds.map(Number))];
  if (!ids.length) { return out; }
  const cut = clock.nowMs() - SPAN_DAYS * 864e5;
  const rows = db.prepare(`SELECT a.word_id AS id, s.dir AS dir, COUNT(*) AS n FROM answers a JOIN sessions s ON s.id = a.session_id
    WHERE s.user_id = ? AND s.done = 1 AND a.attempt = 1 AND s.ended_at >= ? AND a.word_id IN (${ids.map(() => '?').join(',')})
    GROUP BY a.word_id, s.dir`).all(userId, cut, ...ids);
  for (const r of rows) {
    const o = out.get(r.id) || { toFr: 0, toTarget: 0 };
    o[r.dir] = Number(r.n); out.set(r.id, o);
  }
  return out;
}

/** sens le moins travaillé d'une sélection de mots ; `deficit` = vrai si l'autre sens est vraiment en avance */
function weaker(counts, words) {
  const t = { toFr: 0, toTarget: 0 };
  for (const w of words) { const c = counts.get(w.id); if (c) { t.toFr += c.toFr; t.toTarget += c.toTarget; } }
  const dir = t.toTarget < t.toFr ? 'toTarget' : 'toFr';
  return { dir, deficit: t.toFr !== t.toTarget, totals: t };
}

/** un sens donné est-il en retard sur l'autre pour cette sélection ? */
const isDeficit = (totals, dir) => totals[dir] < totals[other(dir)];

module.exports = { DIRS, wordCounts, weaker, isDeficit, other };
