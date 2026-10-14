'use strict';
/* Indicateurs communs à l'élève et au parent (cahier §9 et §10). */
const clock = require('./clock');
const C = require('./config');
const { settingsOf } = require('./users');
const P = require('./progress');
const Pets = require('./pets');
const { weakWords } = require('./sessions');

const SPAN = 63;
const backOf = (ms, today) => today - clock.dayIdx(new Date(ms));

function studentStats(db, user, { detail = false } = {}) {
  const today = clock.dayIdx(), cut = clock.dayStartMs(today - SPAN);
  const sessions = db.prepare('SELECT id, game, lang, win, started_at, ended_at, active_sec, n_words, first_ok, label FROM sessions WHERE user_id = ? AND done = 1 AND ended_at >= ? ORDER BY ended_at').all(user.id, cut);
  const first = db.prepare(`SELECT s.ended_at AS at, a.ok AS ok FROM answers a JOIN sessions s ON s.id = a.session_id
    WHERE s.user_id = ? AND s.done = 1 AND s.ended_at >= ? AND a.attempt = 1`).all(user.id, cut);
  const mins = new Array(SPAN + 1).fill(0), playedBack = new Set();
  for (const s of sessions) { const b = backOf(s.ended_at, today); if (b >= 0 && b <= SPAN) { mins[b] += s.active_sec / 60; playedBack.add(b); } }
  const acc = (from, to) => { let n = 0, ok = 0; for (const a of first) { const b = backOf(a.at, today); if (b <= from && b >= to) { n++; ok += a.ok; } } return n ? ok / n : null; };
  let days7 = 0, week = 0, n7 = 0;
  for (let i = 0; i < 7; i++) { if (playedBack.has(i)) { days7++; } week += mins[i]; }
  for (const s of sessions) { if (backOf(s.ended_at, today) < 7) { n7++; } }
  const a7 = acc(6, 0), a14 = acc(13, 7);
  const accWeeks = []; for (let i = 7; i >= 0; i--) { accWeeks.push(acc(i * 7 + 6, i * 7)); }
  const cnt = { cards: 0, duel: 0, scramble: 0, forge: 0, boss: 0 }; let bossWins = 0;
  for (const s of sessions) { if (backOf(s.ended_at, today) < 30) { cnt[s.game]++; if (s.game === 'boss' && s.win) { bossWins++; } } }
  const allDays = P.playedDays(db, user.id), st = P.streakOf(allDays);
  const mastery = {};
  for (const l of C.LANGS) {
    const rows = db.prepare(`SELECT l.id, COUNT(w.id) AS n, SUM(CASE WHEN COALESCE(s.streak,0) >= 3 THEN 1 ELSE 0 END) AS m
      FROM lists l JOIN words w ON w.list_id = l.id LEFT JOIN word_stats s ON s.word_id = w.id AND s.user_id = ?
      WHERE l.owner_id = ? AND l.lang = ? GROUP BY l.id`).all(user.id, user.id, l);
    mastery[l] = rows.length ? rows.reduce((a, r) => a + r.m / r.n, 0) / rows.length : 0;
  }
  const weak = weakWords(db, user.id).slice(0, 10).map((w) => {
    const o = { wordId: w.wordId, term: w.term, fr: w.fr, lang: w.lang, attempts: w.attempts, fails: w.fails };
    if (detail) {
      const lw = db.prepare(`SELECT a.given, a.kind, a.at FROM answers a JOIN sessions s ON s.id = a.session_id
        WHERE s.user_id = ? AND a.word_id = ? AND a.ok = 0 ORDER BY a.id DESC LIMIT 1`).get(user.id, w.wordId);
      o.lastWrong = lw ? { given: lw.given, kind: lw.kind, at: lw.at } : null;
      const tail = db.prepare(`SELECT a.ok FROM answers a JOIN sessions s ON s.id = a.session_id WHERE s.user_id = ? AND a.word_id = ? ORDER BY a.id DESC LIMIT 1`).get(user.id, w.wordId);
      o.stuck = w.fails >= 5 && !!tail && !tail.ok;
    }
    return o;
  });
  return {
    today: { idx: today, dow: new Date().getDay() },
    days7, minutes7: week, sessions7: n7, acc7: a7, accDelta: a7 !== null && a14 !== null ? Math.round((a7 - a14) * 100) : 0,
    streak: st.count, minutesByDay: mins.map((m) => Math.round(m * 10) / 10), accWeeks,
    games30: cnt, bossWins30: bossWins, mastery, weak, goalDays: settingsOf(db, user.id).goalDays, goalMin: settingsOf(db, user.id).goalMin,
  };
}

function sessionRow(s) {
  return { id: s.id, game: s.game, lang: s.lang, label: s.label, startedAt: s.started_at, endedAt: s.ended_at, activeSec: s.active_sec, first: s.first_ok, n: s.n_words, win: s.win === null ? null : !!s.win };
}
function sessionList(db, userId, rangeDays) {
  const cut = clock.nowMs() - (rangeDays || 36500) * 864e5;
  return db.prepare('SELECT * FROM sessions WHERE user_id = ? AND done = 1 AND ended_at >= ? ORDER BY ended_at DESC').all(userId, cut).map(sessionRow);
}
function sessionDetail(db, userId, sid) {
  const s = db.prepare('SELECT * FROM sessions WHERE id = ? AND user_id = ? AND done = 1').get(Number(sid), userId);
  if (!s) { return null; }
  const answers = db.prepare('SELECT term, fr, lang, qtype, attempt, given, ok, hinted, kind, ms, form_label, exp FROM answers WHERE session_id = ? ORDER BY id').all(s.id)
    .map((a) => ({ ...a, ok: !!a.ok, hinted: !!a.hinted }));
  return { ...sessionRow(s), answers };
}

function adminOverview(db, student) {
  const stats = studentStats(db, student, { detail: true });
  const last = db.prepare('SELECT * FROM sessions WHERE user_id = ? AND done = 1 ORDER BY ended_at DESC LIMIT 1').get(student.id);
  const cut = clock.nowMs() - 30 * 864e5, buckets = [0, 0, 0, 0];
  for (const r of db.prepare('SELECT started_at FROM sessions WHERE user_id = ? AND done = 1 AND ended_at >= ?').all(student.id, cut)) {
    const h = new Date(r.started_at).getHours(); buckets[h < 16 ? 0 : h < 18 ? 1 : h < 20 ? 2 : 3]++;
  }
  const gone = last ? clock.dayIdx() - P.dayOfMs(last.ended_at) : null;
  return {
    student: { id: student.id, name: student.display, username: student.username },
    stats, last: last ? sessionRow(last) : null, goneDays: gone, hourBuckets: buckets,
    pet: Pets.view(db, student), boss: P.bossStatus(db, student.id), rules: require('./rules').fromSettings(settingsOf(db, student.id)),
  };
}

function csvEscape(v) { v = v === null || v === undefined ? '' : String(v); return /[",\n;]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
function exportCsv(db, userId) {
  const rows = db.prepare(`SELECT s.id AS session, s.started_at, s.lang, s.game, s.dir, s.active_sec, a.term, a.fr, a.qtype, a.attempt, a.given, a.ok, a.kind, a.ms
    FROM answers a JOIN sessions s ON s.id = a.session_id WHERE s.user_id = ? AND s.done = 1 ORDER BY a.id`).all(userId);
  const head = ['seance', 'debut', 'langue', 'jeu', 'sens', 'duree_active_s', 'mot', 'traduction', 'type_question', 'essai', 'reponse', 'juste', 'type_erreur', 'temps_ms'];
  const lines = [head.join(';')];
  for (const r of rows) {
    lines.push([r.session, new Date(r.started_at).toISOString(), r.lang, r.game, r.dir, r.active_sec, r.term, r.fr, r.qtype, r.attempt, r.given, r.ok ? 1 : 0, r.kind, r.ms].map(csvEscape).join(';'));
  }
  return '﻿' + lines.join('\r\n') + '\r\n';
}

module.exports = { studentStats, sessionList, sessionDetail, adminOverview, exportCsv };
