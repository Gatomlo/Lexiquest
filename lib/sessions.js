'use strict';
/* Séances : le serveur choisit les mots, corrige, calcule les gemmes et applique les règles (rotation, Gardien). */
const clock = require('./clock');
const C = require('./config');
const Judge = require('../public/js/judge');
const { HttpError, settingsOf, balance, addGems } = require('./users');
const { tx } = require('./db');
const P = require('./progress');
const D = require('./directions');
const Pets = require('./pets');

const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const FIXED_DIR = new Set(['scramble', 'forge', 'boss']);
const QTYPES = { cards: ['cards'], duel: ['duel'], scramble: ['scramble'], forge: ['forge'], boss: ['duel', 'forge'] };

/** mot de la base → { …, forms: [..] | undefined, hdr: noms des formes } */
function shapeWord(w) {
  const o = { ...w };
  if (w.forms) { o.forms = JSON.parse(w.forms); o.hdr = w.headers ? JSON.parse(w.headers).slice(1, -1) : []; } else { delete o.forms; }
  delete o.headers;
  return o;
}
const WORD_SQL = 'SELECT w.term, w.fr, w.forms, l.headers FROM words w JOIN lists l ON l.id = w.list_id WHERE w.id = ?';

/** corrige une réponse : forme demandée (mots à plusieurs formes), attendu, juste ou non */
function judgeEvent(w, e, dir, set) {
  const sw = shapeWord(w);
  let form = null;
  if (sw.forms && e.qtype !== 'cards') {
    form = Number(e.form);
    if (!Number.isInteger(form) || form < -1 || form >= sw.forms.length || (form === -1 && e.qtype !== 'forge')) { throw new HttpError(400, 'Forme demandée invalide.'); }
  }
  const exp = Judge.expected(sw, dir, form), given = String(e.given == null ? '' : e.given).slice(0, 300);
  const ok = e.qtype === 'cards' ? !!e.ok : Judge.isCorrect(e.qtype, given, exp, set);
  const label = form === null ? null : form < 0 ? sw.hdr.join(' | ') : (sw.hdr[form] || null);
  return { exp, given, ok, label, kind: ok ? null : Judge.errorKind(given, exp, set) };
}

function poolWords(db, user, lang, scope, listIds, wordIds) {
  const base = 'SELECT w.id, w.term, w.fr, w.forms, l.headers, w.list_id, COALESCE(s.streak,0) AS streak FROM words w JOIN lists l ON l.id = w.list_id LEFT JOIN word_stats s ON s.word_id = w.id AND s.user_id = ? WHERE l.owner_id = ? AND l.lang = ?';
  const all = () => db.prepare(base).all(user.id, user.id, lang).map(shapeWord);
  if (scope === 'all') { return all(); }
  if (scope === 'words') { const ids = new Set((Array.isArray(wordIds) ? wordIds : []).map(Number)); return all().filter((w) => ids.has(w.id)); }
  if (scope === 'weak') { const ids = new Set(weakWords(db, user.id, lang).map((w) => w.wordId)); return all().filter((w) => ids.has(w.id)); }
  const ids = new Set((Array.isArray(listIds) ? listIds : []).map(Number));
  if (scope === 'one') { while (ids.size > 1) { ids.delete([...ids][1]); } }
  return all().filter((w) => ids.has(w.list_id));
}

/** mots difficiles : au moins 3 essais sur 30 jours et 40 % d'échec ou plus */
function weakWords(db, userId, lang) {
  const cut = clock.nowMs() - 30 * 864e5;
  const rows = db.prepare(`SELECT a.word_id AS wordId, a.term, a.fr, a.lang, COUNT(*) AS attempts, SUM(1 - a.ok) AS fails, MAX(a.at) AS lastAt
    FROM answers a JOIN sessions s ON s.id = a.session_id
    WHERE s.user_id = ? AND s.done = 1 AND a.at >= ? AND a.word_id IS NOT NULL ${lang ? 'AND a.lang = ?' : ''} GROUP BY a.word_id`)
    .all(...(lang ? [userId, cut, lang] : [userId, cut]));
  return rows.filter((r) => r.attempts >= 3 && r.fails / r.attempts >= 0.4)
    .map((r) => ({ wordId: r.wordId, term: r.term, fr: r.fr, lang: r.lang, attempts: Number(r.attempts), fails: Number(r.fails) }))
    .sort((a, b) => b.fails / b.attempts - a.fails / a.attempts || b.attempts - a.attempts);
}

function scopeLabel(db, scope, listIds, lang, count) {
  const L = C.REALM[lang].s;
  if (scope === 'words') { return `Mots à retravailler · ${L}`; }
  if (scope === 'all') { return `Toutes mes listes · ${L}`; }
  if (scope === 'weak') { return `Mots à revoir · ${L}`; }
  if (scope === 'one' && count === 1) { return db.prepare('SELECT name FROM lists WHERE id = ?').get(Number(listIds[0])).name; }
  return `${count} liste${count > 1 ? 's' : ''} · ${L}`;
}

function start(db, user, { lang, scope, listIds, wordIds, game, dir }) {
  if (require('./rules').fromSettings(settingsOf(db, user.id)).dirForce) { dir = 'auto'; } // sens imposé par le parent
  if (!C.LANGS.includes(lang)) { throw new HttpError(400, 'Choisis d’abord une langue.'); }
  listIds = Array.isArray(listIds) ? listIds : [];
  if (!C.GAMES[game]) { throw new HttpError(400, 'Jeu inconnu.'); }
  if (!['all', 'one', 'pick', 'weak', 'words'].includes(scope)) { throw new HttpError(400, 'Portée invalide.'); }
  if (game === 'boss') {
    const B = P.bossStatus(db, user.id);
    if (!B.won && B.ban === lang) { throw new HttpError(409, 'Pas 3 semaines de suite dans la même langue : choisis l’autre langue pour le Gardien.'); }
  } else if (P.rotationOf(db, user.id)[game].locked) { throw new HttpError(409, 'Ce jeu est verrouillé : joue d’autres jeux pour le retrouver.'); }
  const pool = poolWords(db, user, lang, scope, listIds, wordIds);
  if (pool.length < 2) { throw new HttpError(400, 'Pas assez de mots dans cette sélection (2 minimum).'); }
  const counts = D.wordCounts(db, user.id, pool.map((w) => w.id)), wk = D.weaker(counts, pool);
  /* « auto » : le sens le moins travaillé de la sélection ; les jeux d'écriture sont toujours français → langue */
  dir = FIXED_DIR.has(game) ? 'toTarget' : dir === 'auto' ? wk.dir : (dir === 'toTarget' ? 'toTarget' : 'toFr');
  const dirBonus = D.isDeficit(wk.totals, dir) ? 1 : 0;
  const dirCount = (w) => (counts.get(w.id) || { toFr: 0, toTarget: 0 })[dir];
  const n = C.GAMES[game].q;
  let src = pool.slice();
  if (game === 'scramble') { const short = src.filter((w) => (w.forms ? w.forms.concat(w.term) : [w.term]).every((t) => t.replace(/\s/g, '').length <= 14)); if (short.length >= 4) { src = short; } }
  /* dans le sens choisi, d'abord les mots les moins travaillés dans ce sens, puis les moins sus */
  let q = shuffle(shuffle(src).sort((a, b) => dirCount(a) - dirCount(b) || a.streak - b.streak).slice(0, n)).slice(0, n);
  if (game === 'boss') { let b = q.slice(); while (b.length < C.BOSS.queue) { b = b.concat(shuffle(src)); } q = b.slice(0, C.BOSS.queue); }
  const nLists = ['all', 'weak', 'words'].includes(scope) ? 0 : new Set(listIds.map(Number)).size;
  const label = scopeLabel(db, scope, listIds, lang, nLists);
  const listId = scope === 'one' || (scope === 'pick' && listIds.length === 1) ? Number(listIds[0]) : null;
  db.prepare('DELETE FROM sessions WHERE user_id = ? AND done = 0 AND started_at < ?').run(user.id, clock.nowMs() - 864e5);
  const id = Number(db.prepare('INSERT INTO sessions (user_id, lang, scope, game, dir, label, list_id, queue, started_at, dir_bonus) VALUES (?,?,?,?,?,?,?,?,?,?)')
    .run(user.id, lang, scope, game, dir, label, listId, JSON.stringify(q.map((w) => w.id)), clock.nowMs(), dirBonus).lastInsertRowid);
  return { id, game, lang, dir, dirBonus, label, words: q.map((w) => ({ id: w.id, term: w.term, fr: w.fr, streak: w.streak, forms: w.forms, hdr: w.hdr })) };
}

function loadOpen(db, user, id) {
  const s = db.prepare('SELECT * FROM sessions WHERE id = ? AND user_id = ?').get(Number(id), user.id);
  if (!s) { throw new HttpError(404, 'Séance introuvable.'); }
  if (s.done) { throw new HttpError(409, 'Séance déjà terminée.'); }
  return s;
}

function recordEvents(db, user, id, events) {
  const s = loadOpen(db, user, id), set = settingsOf(db, user.id);
  if (!Array.isArray(events) || !events.length || events.length > 50) { throw new HttpError(400, 'Événements invalides.'); }
  const queue = new Set(JSON.parse(s.queue));
  return tx(db, () => {
    const out = [];
    for (const e of events) {
      if (e && e.type === 'hint') {
        if (balance(db, user.id) < C.GEMS.hint) { throw new HttpError(402, 'Pas assez de gemmes pour un indice.'); }
        addGems(db, user.id, -C.GEMS.hint, 'hint', s.id);
        out.push({ type: 'hint' });
        continue;
      }
      if (!e || e.type !== 'answer') { throw new HttpError(400, 'Type d’événement inconnu.'); }
      const wid = Number(e.wordId);
      if (!queue.has(wid)) { throw new HttpError(400, 'Ce mot ne fait pas partie de la séance.'); }
      if (!QTYPES[s.game].includes(e.qtype)) { throw new HttpError(400, 'Type de question invalide pour ce jeu.'); }
      const w = db.prepare(WORD_SQL).get(wid);
      if (!w) { throw new HttpError(400, 'Mot introuvable.'); }
      const j = judgeEvent(w, e, s.dir, set), { exp, given, ok, kind } = j;
      const attempt = Number(db.prepare('SELECT COUNT(*) AS n FROM answers WHERE session_id = ? AND word_id = ?').get(s.id, wid).n) + 1;
      db.prepare('INSERT INTO answers (session_id, word_id, term, fr, lang, qtype, attempt, given, ok, hinted, kind, ms, at, form_label, exp) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
        .run(s.id, wid, w.term, w.fr, s.lang, e.qtype, attempt, given, ok ? 1 : 0, e.hinted ? 1 : 0, kind, Math.max(0, Math.min(600000, Math.round(+e.ms || 0))), clock.nowMs(), j.label, j.label ? exp : null);
      out.push({ type: 'answer', ok, attempt, expected: exp, kind });
    }
    return out;
  });
}

/** rejoue les réponses : gemmes, victoire du Gardien, séance sans faute */
function scoreSession(session, answers, gems = require('./rules').DEFAULTS.gems) {
  const boss = session.game === 'boss';
  let combo = 0, pts = 0, first = 0, hp = C.BOSS.hp, hearts = C.BOSS.hearts, used = 0, wrong = false, ended = null;
  for (const a of answers) {
    if (boss && ended) { break; }
    used++;
    const base = gems[a.qtype];
    if (a.ok) {
      if (a.attempt === 1) { pts += a.hinted ? Math.ceil(base / 2) : base + (combo >= C.GEMS.comboFrom ? C.GEMS.comboBonus : 0) + (session.dir_bonus ? gems.dir : 0); first++; } else { pts += Math.ceil(base / 2); }
      combo++;
      if (boss && --hp <= 0) { ended = 'win'; }
    } else {
      combo = 0; wrong = true;
      if (boss && --hearts <= 0) { ended = 'lose'; }
    }
  }
  return { pts, first, wrong, ended, used, hits: C.BOSS.hp - hp };
}

function end(db, user, id, { activeSec, endedAt } = {}) {
  const s = loadOpen(db, user, id);
  const answers = db.prepare('SELECT * FROM answers WHERE session_id = ? ORDER BY id').all(s.id)
    .map((a) => ({ ...a, ok: !!a.ok, hinted: !!a.hinted }));
  if (!answers.length) { throw new HttpError(400, 'Aucune réponse : la séance n’est pas conservée.'); }
  const boss = s.game === 'boss', queue = JSON.parse(s.queue);
  const sc = scoreSession(s, answers, require('./rules').fromSettings(settingsOf(db, user.id)).gems);
  let win = true;
  if (boss) {
    if (sc.ended) { win = sc.ended === 'win'; }
    else if (answers.length >= queue.length) { win = false; }
    else { throw new HttpError(400, 'Le Gardien n’est pas terminé.'); }
  } else {
    /* un mot est « passé » s'il a été réussi, ou raté deux fois (il n'est re-présenté qu'une fois) */
    const done = new Set(answers.filter((a) => a.ok || a.attempt >= 2).map((a) => a.word_id));
    if (!queue.every((w) => done.has(w))) { throw new HttpError(400, 'Séance incomplète : il reste des mots.'); }
  }
  return tx(db, () => {
    const now = endedAt || clock.nowMs(), endDay = P.dayOfMs(now);
    const wins = P.bossWins(db, user.id), before = P.rotationOf(db, user.id);
    /* le Gardien est « bonus » si la semaine de cette séance était déjà validée */
    const wk = clock.weekStart(endDay), prevWin = wins.find((w) => w.day >= wk && w.day <= wk + 6);
    const bonusBoss = boss && !!prevWin;
    const b = {
      fin: win ? C.GEMS.finWin : C.GEMS.finLose,
      perfect: !boss && !sc.wrong ? C.GEMS.perfect : 0,
      boss: boss && win && !bonusBoss ? C.BOSS.bonusGems : 0,
      daily: P.dailyOn(db, user.id, endDay) ? 0 : C.GEMS.daily,
    };
    const total = sc.pts + b.fin + b.perfect + b.boss + b.daily;
    addGems(db, user.id, sc.pts, 'answers', s.id, now);
    addGems(db, user.id, b.fin, 'fin', s.id, now);
    addGems(db, user.id, b.perfect, 'perfect', s.id, now);
    addGems(db, user.id, b.boss, 'boss', s.id, now);
    addGems(db, user.id, b.daily, 'daily', s.id, now);
    const cap = Math.round((now - s.started_at) / 1000 * 1.1) + 10;
    const sec = Math.max(20, Math.min(cap, Math.round(+activeSec || (now - s.started_at) / 1000)));
    const nWords = boss ? sc.used : queue.length;
    db.prepare('UPDATE sessions SET done = 1, ended_at = ?, active_sec = ?, n_words = ?, first_ok = ?, win = ?, gems = ? WHERE id = ?')
      .run(now, sec, nWords, sc.first, boss ? (win ? 1 : 0) : null, total, s.id);
    const up = db.prepare(`INSERT INTO word_stats (user_id, word_id, streak, attempts, fails, last_at) VALUES (?,?,?,1,?,?)
      ON CONFLICT(user_id, word_id) DO UPDATE SET streak = excluded.streak, attempts = attempts + 1, fails = fails + excluded.fails, last_at = excluded.last_at`);
    const streaks = new Map(db.prepare('SELECT word_id, streak FROM word_stats WHERE user_id = ?').all(user.id).map((r) => [r.word_id, r.streak]));
    for (const a of answers.slice(0, sc.used)) {
      const st = a.ok ? Math.min(3, (streaks.get(a.word_id) || 0) + 1) : 0;
      streaks.set(a.word_id, st);
      up.run(user.id, a.word_id, st, a.ok ? 0 : 1, now);
    }
    Pets.materialize(db, user);
    const after = P.rotationOf(db, user.id), unlocked = [];
    for (const g of Object.keys(after)) { if (before[g].locked && !after[g].locked) { unlocked.push(g); } }
    const locked = !boss && after[s.game].locked && !before[s.game].locked;
    const missed = []; const seen = new Set();
    for (const a of answers.slice(0, sc.used)) { if (!a.ok && !seen.has(a.word_id)) { seen.add(a.word_id); missed.push({ id: a.word_id, term: a.term, fr: a.fr }); } }
    return {
      id: s.id, game: s.game, lang: s.lang, win, bonusBoss, gems: total, points: sc.pts, bonus: b, first: sc.first, total: nWords,
      hits: sc.hits, perfect: b.perfect > 0, activeSec: sec, missed, rotation: { locked, unlocked }, balance: balance(db, user.id),
    };
  });
}

/**
 * Séance jouée hors-ligne, déclarée au retour du réseau : même correction et mêmes gains qu'une séance en ligne.
 * `clientId` rend l'envoi idempotent (un renvoi après une réponse perdue ne crée pas de doublon).
 */
function importOffline(db, user, p) {
  p = p || {};
  const clientId = String(p.clientId || '').slice(0, 64);
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(clientId)) { throw new HttpError(400, 'Identifiant de séance invalide.'); }
  const dup = db.prepare('SELECT id, gems FROM sessions WHERE user_id = ? AND client_id = ?').get(user.id, clientId);
  if (dup) { return { duplicate: true, id: dup.id, gems: dup.gems, balance: balance(db, user.id) }; }
  if (!C.LANGS.includes(p.lang) || !C.GAMES[p.game]) { throw new HttpError(400, 'Séance invalide.'); }
  const events = Array.isArray(p.events) ? p.events : [];
  if (!events.length || events.length > 400) { throw new HttpError(400, 'Événements invalides.'); }
  const ids = [...new Set((Array.isArray(p.wordIds) ? p.wordIds : []).map(Number))];
  if (!ids.length || ids.length > 60) { throw new HttpError(400, 'Mots invalides.'); }
  const now = clock.nowMs(), started = Math.min(now, Math.max(now - 14 * 864e5, Math.round(+p.startedAt) || now));
  const dir = FIXED_DIR.has(p.game) ? 'toTarget' : (p.dir === 'toTarget' ? 'toTarget' : 'toFr');
  const poolIn = poolWords(db, user, p.lang, 'words', [], ids), queue = poolIn.map((w) => w.id);
  const dirBonus = D.isDeficit(D.weaker(D.wordCounts(db, user.id, queue), poolIn).totals, dir) ? 1 : 0;
  if (queue.length !== ids.length) { throw new HttpError(400, 'Mots inconnus ou d’une autre langue.'); }
  const label = String(p.label || '').slice(0, 80) || scopeLabel(db, 'words', [], p.lang, 0);
  const endedAt = Math.min(now, started + Math.max(20, Math.min(3600, Math.round(+p.activeSec) || 20)) * 1000);
  return tx(db, () => {
    const id = Number(db.prepare('INSERT INTO sessions (user_id, lang, scope, game, dir, label, queue, started_at, client_id, dir_bonus) VALUES (?,?,?,?,?,?,?,?,?,?)')
      .run(user.id, p.lang, 'words', p.game, dir, label, JSON.stringify(queue), started, clientId, dirBonus).lastInsertRowid);
    // les événements sont rejoués par le chemin habituel (correction, indices), mais avec l'heure de la séance
    const open = { ...db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) };
    const set = settingsOf(db, user.id), inQueue = new Set(queue);
    for (const e of events) {
      if (e && e.type === 'hint') { addGems(db, user.id, -C.GEMS.hint, 'hint', id, started); continue; }
      if (!e || e.type !== 'answer' || !inQueue.has(Number(e.wordId)) || !QTYPES[open.game].includes(e.qtype)) { throw new HttpError(400, 'Événement invalide.'); }
      const wid = Number(e.wordId), w = db.prepare(WORD_SQL).get(wid);
      const j = judgeEvent(w, e, dir, set);
      const attempt = Number(db.prepare('SELECT COUNT(*) AS n FROM answers WHERE session_id = ? AND word_id = ?').get(id, wid).n) + 1;
      db.prepare('INSERT INTO answers (session_id, word_id, term, fr, lang, qtype, attempt, given, ok, hinted, kind, ms, at, form_label, exp) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
        .run(id, wid, w.term, w.fr, p.lang, e.qtype, attempt, j.given, j.ok ? 1 : 0, e.hinted ? 1 : 0, j.kind, Math.max(0, Math.min(600000, Math.round(+e.ms || 0))), started, j.label, j.label ? j.exp : null);
    }
    return end(db, user, id, { activeSec: p.activeSec, endedAt });
  });
}

function abandon(db, user, id) { db.prepare('DELETE FROM sessions WHERE id = ? AND user_id = ? AND done = 0').run(Number(id), user.id); }

module.exports = { weakWords, start, recordEvents, end, importOffline, abandon, scoreSession };
