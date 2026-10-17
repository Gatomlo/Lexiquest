(function () {
'use strict';
/* Application élève. L'état vient du serveur (GET state / stats) ; la séance se joue ici et se déclare au serveur. */
var S = { st: null, stats: null, tab: 'home', sub: null, sheet: null, sess: null, toast: null, lang: 'all',
  plang: 'nl', scope: 'all', one: null, pick: [], game: 'forge', dir: 'auto', enter: true, sayPet: null, munch: 0, booted: false,
  points: 0, rot: {}, owned: {}, inv: {}, equip: { acc: null, decor: null }, set: { accents: true, articles: true }, active: 'phenix', name: '', loginErr: '' };
var GAMES, ORDER, ROT, BOSS_PEN, PETS, ITEMS, DURABLE, VOUCH, STATE_N, REALM, RES_PRICE;
var LISTS = [], LB = {}, WB = {};
var CHEER_OK = ['Bravo !', 'Excellent !', 'Dans le mille !', 'Tu gères !', 'Parfait !'];
var CHEER_NO = ['Presque !', 'Pas de souci, on le retient.', 'On le reverra ensemble.', 'Regarde bien la réponse.'];

/* ---------- état : raccourcis sur ce que le serveur renvoie ---------- */
function critterS(kind, lvl, size, stg, react, acc) { return critter(kind, lvl, size, stg, react, acc === undefined ? (kind === S.active ? S.equip.acc : null) : acc); }
function petNow() { var p = S.st.pet; return { food: p.food, care: p.care, joy: p.joy, lvl: p.lvl, ko: p.ko, low: p.low, days: p.days, hits: p.hits }; }
function stage() { return S.st.pet.stage; }
function decorCls() { return S.equip.decor ? ' d-' + S.equip.decor : ''; }
function bossStatus() { return S.st.boss; }
function streak() { return S.st.streak; }
function hasSess(back) { return S.st.played7[6 - back]; }
function daysAgo(i) { var d = new Date(); d.setDate(d.getDate() - i); return d; }
function otherLang(l) { return l === 'nl' ? 'en' : 'nl'; }
function mastery(l) { var c = 0; l.words.forEach(function (w) { if (w.streak >= 3) { c++; } }); return l.words.length ? c / l.words.length : 0; }
function petMsg(n) {
  if (S.sayPet) { return S.sayPet; }
  if (n.ko) { return 'Je suis à terre… Seule une potion de résurrection peut me relever.'; }
  if (n.hits > 0) { return 'Le Gardien m’a frappé la semaine dernière… j’ai besoin de soins !'; }
  if (n.lvl === 3) { return 'Je suis tout délabré… Reviens jouer, et prends soin de moi s’il te plaît.'; }
  if (n.lvl === 2) { return n.low === 'food' ? 'J’ai faim… tu as des gemmes pour un petit repas ?' : n.low === 'care' ? 'Je me sens faible… une potion de soin me ferait du bien.' : 'Je m’ennuie… on joue à la balle ?'; }
  var h = new Date().getHours();
  if (n.lvl <= 1 && (h >= CFG.night.from || h < CFG.night.to)) { return 'Je somnole… la nuit je dors, mes jauges baissent moins vite.'; }
  if (n.lvl === 1) { return n.days > 0 ? 'Tu m’as manqué ! Une séance de 5 min et je suis ravi.' : 'Ça va, merci ! On joue encore ?'; }
  return 'Je suis en pleine forme grâce à toi !';
}
function applyConfig(c) {
  GAMES = c.games; ORDER = c.order; ROT = c.rot; PETS = c.pets; ITEMS = c.items; DURABLE = c.durable; VOUCH = c.vouch; STATE_N = c.stateN; RES_PRICE = c.resPrice;
  BOSS_PEN = { care: c.boss.penCare, joy: c.boss.penJoy }; ROT = { max: c.rot.max, need: c.rot.need };
  REALM = {}; Object.keys(c.realm).forEach(function (k) { REALM[k] = { s: c.realm[k].s, tag: c.realm[k].tag, cls: 'r-' + k }; });
}
function applyState(st, stats) {
  S.st = st; if (stats) { S.stats = stats; }
  ['cards', 'duel', 'scramble', 'forge'].forEach(function (g) { GAMES[g].g = st.rules.gems[g]; });
  ROT.max = st.rules.rot.max; ROT.need = st.rules.rot.need; BOSS_PEN.care = st.rules.pen.care; BOSS_PEN.joy = st.rules.pen.joy;
  S.gemDir = st.rules.gems.dir; S.dirForce = !!st.rules.dirForce; if (S.dirForce) { S.dir = 'auto'; }
  S.points = st.gems; S.rot = st.rotation; S.active = st.pet.id; S.name = st.me.name; S.set = st.settings; S.equip = st.inv.equip;
  S.owned = {}; st.pet.owned.forEach(function (o) { S.owned[o.id] = true; });
  S.inv = {}; st.inv.owned.forEach(function (id) { S.inv[id] = true; });
  LISTS = st.lists.map(function (l) { l.id = String(l.id); l.words.forEach(function (w) { w.lang = l.lang; w.hdr = l.headers ? l.headers.slice(1, -1) : null; }); return l; });
  LB = {}; WB = {}; LISTS.forEach(function (l) { LB[l.id] = l; l.words.forEach(function (w) { WB[w.id] = w; }); });
}
function refresh() {
  return Promise.all([api('GET', 'state'), api('GET', 'stats')]).then(function (r) { applyState(r[0], r[1]); S.offline = false; Offline.saveCache(r[0].me.id, r[0], r[1]); });
}
function pendingCount() { return S.st ? Offline.queue(S.st.me.id).length : 0; }
function syncBanner() {
  var n = pendingCount();
  if (!S.offline && !n) { return ''; }
  return '<div class="alert" style="margin-bottom:12px">' + ic(S.offline ? 'alert' : 'clock') + '<span>' + (S.offline ? '<b>Hors-ligne.</b> Tu peux jouer : tes séances seront envoyées au retour du réseau.' : 'Envoi de tes séances…') + (n ? ' ' + n + ' séance' + (n > 1 ? 's' : '') + ' en attente.' : '') + '</span></div>';
}
var syncing = false;
/** envoie les séances jouées hors-ligne, de la plus ancienne à la plus récente */
function trySync() {
  if (syncing || !S.st || !navigator.onLine) { return Promise.resolve(); }
  var items = Offline.queue(S.st.me.id); if (!items.length) { return Promise.resolve(); }
  syncing = true; var done = 0;
  return items.reduce(function (p, it) {
    return p.then(function () {
      return api('POST', 'sessions/import', it).then(function () { Offline.remove(it.clientId); done++; if (S.sess && S.sess.clientId === it.clientId) { S.sess.pendingSync = false; } },
        function (e) { if (e.offline || e.status === 401) { throw e; } Offline.remove(it.clientId); /* refusée par le serveur : inutile de la renvoyer */ });
    });
  }, Promise.resolve()).then(function () {
    syncing = false;
    return refresh().then(function () { render(); if (done) { toast(done + ' séance' + (done > 1 ? 's' : '') + ' envoyée' + (done > 1 ? 's' : '') + '.'); } });
  }, function (e) { syncing = false; softFail(e); });
}
function softFail(e) {
  if (e && e.offline) { if (!S.offline) { S.offline = true; render(); } return; }
  fail(e);
}
function localRotation(g) {
  var out = { locked: false, unlocked: [] };
  if (g !== 'boss' && S.rot[g]) { var r = S.rot[g]; r.n++; if (r.n >= ROT.max) { r.locked = true; r.seen = []; out.locked = true; } }
  Object.keys(S.rot).forEach(function (h) {
    var r = S.rot[h];
    if (h !== g && r.locked && r.seen.indexOf(g) < 0) { r.seen.push(g); if (r.seen.length >= ROT.need) { r.locked = false; r.n = 0; r.seen = []; out.unlocked.push(h); } }
  });
  return out;
}
function fail(e) {
  if (e && e.status === 401) { S.st = null; S.sess = null; S.enter = true; render(); return; }
  if (e && e.offline) { S.offline = true; toast('Pas de réseau : cette action demande une connexion.'); return; }
  toast(e && e.message ? e.message : 'Connexion impossible.');
}

/* ---------- connexion ---------- */
function viewLogin() {
  return '<div class="view login"><div class="login-top">' + critter('phenix', 0, 104, 1, null, null)
   + '<h1>Lexiquest</h1><p>Révise 5 minutes, prends soin de ton compagnon !</p></div>'
   + '<form class="login-body" id="loginForm"><label class="field">Identifiant<input name="username" autocomplete="username" autocapitalize="none" required></label>'
   + '<label class="field">Mot de passe' + pwInput('name="password" autocomplete="current-password" required') + '</label>'
   + (S.setupNeeded ? '<div class="alert">' + ic('alert') + '<span>Lexiquest n’est pas encore installé : le parent doit d’abord créer son compte sur la <a href="parent">page Suivi</a>.</span></div>' : '')
   + (S.loginErr || S.bootErr ? '<div class="alert bad">' + ic('alert') + '<span>' + esc(S.loginErr || S.bootErr) + '</span></div>' : '')
   + '<label class="check"><input type="checkbox" name="remember" checked> Garder la connexion</label>'
   + '<button class="btn wide" type="submit">Retrouver mon compagnon</button></form></div>';
}
function viewInvite() {
  var inv = S.invite;
  if (inv.err) {
    return '<div class="view login"><div class="login-top">' + critter('phenix', 0, 104, 1, null, null) + '<h1>Lexiquest</h1></div><div class="login-body"><div class="alert bad">' + ic('alert') + '<span>' + esc(inv.err) + '</span></div><button class="btn alt wide" data-act="noinvite">Retour à la connexion</button></div></div>';
  }
  var sugg = String(inv.name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return '<div class="view login"><div class="login-top">' + critter('phenix', 0, 104, 1, null, null)
   + '<h1>Bienvenue ' + esc(inv.name) + ' !</h1><p>Choisis ton identifiant et ton mot de passe.</p></div>'
   + '<form class="login-body" id="inviteForm"><label class="field">Identifiant<input name="username" value="' + esc(sugg) + '" autocomplete="username" autocapitalize="none" required></label>'
   + '<label class="field">Mot de passe (8 caractères minimum)' + pwInput('name="password" minlength="8" autocomplete="new-password" required') + '</label>'
   + '<label class="field">Mot de passe, encore une fois' + pwInput('name="password2" minlength="8" autocomplete="new-password" required') + '</label>'
   + (inv.formErr ? '<div class="alert bad">' + ic('alert') + '<span>' + esc(inv.formErr) + '</span></div>' : '')
   + '<button class="btn wide" type="submit">Créer mon compte</button></form></div>';
}
function footerHTML() {
  return notifCard('student') + displayControls() + '<button class="btn alt wide" style="margin-top:14px" data-act="logout">' + ic('out') + ' Se déconnecter</button>';
}
function wordsFor(scope, one, pick, lang) {
  var ls = langLists(lang);
  if (scope === 'all') { return ls.reduce(function (a, l) { return a.concat(l.words); }, []); }
  if (scope === 'one') { return LB[one] && LB[one].lang === lang ? LB[one].words : []; }
  if (scope === 'pick') { return pick.reduce(function (a, id) { return a.concat(LB[id] && LB[id].lang === lang ? LB[id].words : []); }, []); }
  return new Array(S.st.weak[lang] || 0).fill({ id: 0 });
}
function viewStats() {
  var h = hud(), st = S.stats;
  h += '<h1 class="disp" style="font-size:28px;margin-bottom:12px">Mes stats</h1>';
  h += '<div class="kpis" style="margin-bottom:14px">'
    + '<div class="kpi"><span>Jours joués · 7 j</span><b class="tnum">' + st.days7 + '/7</b><small class="muted">objectif ' + st.goalDays + '</small></div>'
    + '<div class="kpi"><span>Temps · 7 jours</span><b class="tnum">' + dur(st.minutes7 * 60) + '</b><small class="muted">séances de 5 min</small></div>'
    + '<div class="kpi"><span>Réussite · 7 j</span><b class="tnum">' + (st.acc7 === null ? '–' : Math.round(st.acc7 * 100) + ' %') + '</b><small class="' + (st.accDelta >= 0 ? 'up' : 'down') + '">' + (st.accDelta >= 0 ? '+' : '') + st.accDelta + ' pts</small></div>'
    + '<div class="kpi"><span>Série</span><b class="tnum">' + st.streak + ' j</b><small class="muted">jours de suite</small></div></div>';
  h += '<div class="pcard" style="margin-bottom:14px"><h2>Minutes par jour</h2>' + barChart(st) + '</div>';
  var mx = 1; ORDER.forEach(function (g) { mx = Math.max(mx, st.games30[g]); });
  h += '<div class="pcard" style="margin-bottom:14px"><h2>Mes jeux · 30 jours</h2>' + ORDER.map(function (g) { return '<div class="hbar"><span class="l" style="width:128px">' + GAMES[g].n + '</span><div class="t"><i style="width:' + Math.round(st.games30[g] / mx * 100) + '%;background:' + GAMES[g].col + '"></i></div><span class="v tnum">' + st.games30[g] + '</span></div>'; }).join('')
    + '<p class="muted" style="font-size:13px;margin-top:6px">Gardiens vaincus : <b>' + st.bossWins30 + '</b></p></div>';
  h += '<div class="pcard" style="margin-bottom:14px"><h2>Mes deux sens · 30 jours</h2>' + ['nl', 'en'].map(function (l) {
    var d = st.dirs.langs[l]; return d.toFr.n + d.toTarget.n ? '<p class="muted" style="margin:8px 0 2px"><span class="tag">' + REALM[l].tag + '</span> ' + REALM[l].s + '</p>' + dirBars(d, REALM[l].tag) : '';
  }).join('') + '<p class="muted" style="font-size:12.5px;margin-top:6px">Pour bien retenir un mot, travaille-le dans les deux sens. Le sens « Auto » te propose celui que tu as le moins joué, avec un petit bonus de gemmes.</p></div>';
  h += '<div class="pcard" style="margin-bottom:14px"><h2>Où j’en suis, par langue</h2>';
  ['nl', 'en'].forEach(function (l) {
    h += '<div class="hbar ' + REALM[l].cls + '"><span class="l" style="width:100px"><span class="tag">' + REALM[l].tag + '</span> ' + REALM[l].s + '</span><div class="t"><i style="width:' + Math.round(st.mastery[l] * 100) + '%;background:var(--acc)"></i></div><span class="v tnum" style="width:40px">' + Math.round(st.mastery[l] * 100) + ' %</span></div>';
  });
  h += '<p class="muted" style="font-size:12.5px;margin-top:4px">Part des mots maîtrisés (3 bonnes réponses de suite).</p></div>';
  h += '<div class="pcard" style="margin-bottom:14px"><h2>Jours travaillés · 8 semaines</h2>' + heatmap(st) + '</div>';
  h += '<div class="pcard" style="margin-bottom:14px"><h2>Réussite par semaine</h2>' + lineChart(st) + '</div>';
  var w = st.weak.slice(0, 6);
  h += '<div class="pcard"><h2>Mots coriaces</h2>';
  w.forEach(function (r, k) { h += '<div class="dword ' + REALM[r.lang].cls + '"><div class="top"><span class="rk">' + (k + 1) + '</span><div class="tt"><b>' + esc(r.term) + '</b><span><span class="tag">' + REALM[r.lang].tag + '</span> ' + esc(r.fr) + '</span></div><span class="pct tnum">' + Math.round(r.fails / r.attempts * 100) + ' %</span></div></div>'; });
  if (!w.length) { h += '<p class="muted">Aucun mot coriace : bravo !</p>'; }
  else {
    h += '<div style="display:flex;gap:10px;margin-top:12px;flex-wrap:wrap">' + ['nl', 'en'].filter(function (l) { return S.st.weak[l] > 0; }).map(function (l) { return '<button class="btn sm" data-act="playweak" data-lang="' + l + '">Réviser en ' + REALM[l].s.toLowerCase() + '</button>'; }).join('') + '</div>';
  }
  h += '<p class="muted" style="font-size:12.5px;margin-top:12px">Ce sont aussi les chiffres que ton parent peut consulter, avec le détail des séances.</p></div>';
  return '<div class="view' + (S.enter ? ' enter' : '') + '">' + h + '</div>';
}
function viewSaving() {
  var s = S.sess;
  return '<div class="sess"><div class="s-main" style="justify-content:center;text-align:center">'
    + (s.err ? '<p class="q-word">Oups…</p><p class="muted">' + esc(s.err) + '</p><button class="btn" data-act="retrysave">Réessayer l’enregistrement</button>'
      : '<p class="q-word">Enregistrement…</p><p class="muted">Calcul des gemmes.</p>') + '</div></div>';
}

/* ---------- séance ---------- */
function launch(extra) {
  if (S.dirForce) { S.dir = 'auto'; }
  var body = Object.assign({ lang: S.plang, scope: S.scope, listIds: S.scope === 'one' ? [S.one] : S.scope === 'pick' ? S.pick.slice() : [], game: S.game, dir: S.dir }, extra || {});
  api('POST', 'sessions', body).then(function (r) { begin(r, body, false); }).catch(function (e) { if (e.offline) { S.offline = true; startLocal(body); } else { fail(e); } });
}
function begin(r, body, offline) {
  var q = r.words.map(function (w) { return { id: w.id, term: w.term, fr: w.fr, streak: w.streak, lang: r.lang, forms: w.forms || null, hdr: w.hdr || null }; });
  S.sess = { id: r.id, ep: r.game, params: body, meta: { label: r.label, lang: r.lang }, dir: r.dir, queue: q, total: q.length, first: 0, tries: {}, wrong: {}, answers: [], combo: 0, maxCombo: 0, pts: 0,
    hearts: CFG.boss.hearts, hp: CFG.boss.hp, hpMax: CFG.boss.hp, qi: 0, activeMs: 0, done: false, fb: null, cur: null, win: null, lang: r.lang, pending: [], allEvents: [], flushing: null, saving: false, err: null,
    dirBonus: r.dirBonus ? 1 : 0, offline: !!offline, clientId: Offline.uuid(), startedAt: Date.now(), wordIds: q.map(function (w) { return w.id; }).filter(function (id, i, a) { return a.indexOf(id) === i; }) };
  nextQ(); S.sheet = null; S.enter = false; render();
}
/** même choix de mots que le serveur, avec ce que l'appareil connaît (le serveur revérifie tout au retour du réseau) */
function startLocal(body) {
  var lang = body.lang, game = body.game;
  if (game === 'boss') { var B = bossStatus(); if (!B.won && B.ban === lang) { toast('Pas 3 semaines de suite dans la même langue : choisis l’autre langue.'); return; } }
  else if (S.rot[game] && S.rot[game].locked) { toast('Ce jeu est verrouillé : joue d’autres jeux pour le retrouver.'); return; }
  var pool;
  if (body.scope === 'words') { pool = body.wordIds.map(function (id) { return WB[id]; }).filter(function (w) { return w && w.lang === lang; }); }
  else if (body.scope === 'weak') { pool = (S.stats.weak || []).filter(function (w) { return w.lang === lang; }).map(function (w) { return WB[w.wordId]; }).filter(Boolean); }
  else { pool = wordsFor(body.scope, body.listIds[0], body.listIds, lang); }
  if (pool.length < 2) { toast('Pas assez de mots dans cette sélection.'); return; }
  var adv = dirAdvice(lang, body.scope === 'one' || body.scope === 'pick' ? body.listIds : null);
  var dir = ['scramble', 'forge', 'boss'].indexOf(game) >= 0 ? 'toTarget' : body.dir === 'auto' ? adv.dir : (body.dir === 'toTarget' ? 'toTarget' : 'toFr');
  var n = GAMES[game].q, src = pool.slice();
  if (game === 'scramble') { var short = src.filter(function (w) { return w.term.replace(/\s/g, '').length <= 14; }); if (short.length >= 4) { src = short; } }
  var q = sh(sh(src).sort(function (a, b) { return a.streak - b.streak; }).slice(0, n)).slice(0, n);
  if (game === 'boss') { var b = q.slice(); while (b.length < CFG.boss.queue) { b = b.concat(sh(src)); } q = b.slice(0, CFG.boss.queue); }
  var label = body.scope === 'words' ? 'Mots à retravailler · ' + REALM[lang].s : scopeLabel(body.scope, body.listIds[0], body.listIds, lang);
  begin({ id: null, game: game, lang: lang, dir: dir, dirBonus: adv.totals[dir] < adv.totals[dir === 'toFr' ? 'toTarget' : 'toFr'], label: label, words: q }, body, true);
}
/** sens le moins travaillé (30 jours, premier essai) pour une langue ou des listes ; le serveur recompte tout */
function dirAdvice(lang, listIds) {
  var D = S.stats && S.stats.dirs, t = { toFr: 0, toTarget: 0 };
  if (D) {
    if (listIds && listIds.length) { D.lists.forEach(function (l) { if (listIds.indexOf(l.listId) >= 0) { t.toFr += l.toFr.n; t.toTarget += l.toTarget.n; } }); }
    else if (D.langs[lang]) { t.toFr = D.langs[lang].toFr.n; t.toTarget = D.langs[lang].toTarget.n; }
  }
  return { dir: t.toTarget < t.toFr ? 'toTarget' : 'toFr', deficit: t.toFr !== t.toTarget, totals: t };
}
function expOf(w, dir, form) { return Judge.expected(w, dir, form); }
/** forme demandée à cette question : une colonne au hasard (QCM, lettres), toute la ligne à l'écriture ; null pour un mot ordinaire */
function pickForm(w, type) {
  if (!w.forms || type === 'cards') { return null; }
  return type === 'forge' ? -1 : Math.floor(Math.random() * w.forms.length);
}
function nextQ() {
  var s = S.sess; if (!s.queue.length) { return; }
  var w = s.queue[0], type = s.ep === 'boss' ? (s.qi % 2 === 0 ? 'duel' : 'forge') : s.ep;
  var cur = { w: w, type: type, hint: false, opts: null, tiles: null, slots: [], t: Date.now(), lang: w.lang, form: pickForm(w, type) };
  var ans = expOf(w, s.dir, cur.form);
  if (type === 'duel') {
    var all = LISTS.filter(function (l) { return l.lang === w.lang; }).reduce(function (a, l) { return a.concat(l.words); }, []), cand;
    if (cur.form !== null) {
      /* mauvaises réponses : la même colonne des autres verbes, puis les autres formes */
      cand = all.filter(function (x) { return x.id !== w.id && x.forms && x.forms[cur.form]; }).map(function (x) { return x.forms[cur.form]; });
      all.forEach(function (x) { if (x.forms) { x.forms.forEach(function (f) { cand.push(f); }); } });
      cand = cand.filter(function (e) { return e !== ans && e.toLowerCase() !== w.term.toLowerCase(); });
    } else {
      cand = all.filter(function (x) { return x.id !== w.id && expOf(x, s.dir) !== ans; }).map(function (x) { return expOf(x, s.dir); });
    }
    var seen = {}, d = []; (cur.form !== null ? cand.slice(0, 12).concat(sh(cand.slice(12))) : sh(cand)).forEach(function (e) { if (d.length < 3 && !seen[e]) { seen[e] = 1; d.push(e); } });
    cur.opts = sh([ans].concat(d));
  }
  if (type === 'scramble') {
    var letters = ans.replace(/\s/g, '').split(''), t = sh(letters), tries = 0;
    while (t.join('') === letters.join('') && tries++ < 6) { t = sh(letters); }
    cur.tiles = t;
  }
  s.cur = cur;
}
function resolve(ok, given, hinted) {
  var s = S.sess, w = s.cur.w, ans = expOf(w, s.dir, s.cur.form), attempt = (s.tries[w.id] || 0) + 1; s.tries[w.id] = attempt;
  var kind = ok ? null : (given && Judge.lev(Judge.norm(given, S.set), Judge.norm(ans, S.set)) <= 2 ? 'presque' : 'oubli');
  s.answers.push({ wid: w.id, term: w.term, fr: w.fr, lang: w.lang, ok: ok, ms: Date.now() - s.cur.t, attempt: attempt, given: given || '', kind: kind });
  var ev = { type: 'answer', wordId: w.id, qtype: s.cur.type, given: given || '', ok: ok, ms: Date.now() - s.cur.t, hinted: !!hinted };
  if (s.cur.form !== null) { ev.form = s.cur.form; }
  s.pending.push(ev); s.allEvents.push(ev);
  var p = 0, base = GAMES[s.cur.type].g;
  if (ok) {
    if (attempt === 1) { p = hinted ? Math.ceil(base / 2) : base + (s.combo >= 3 ? 1 : 0) + (s.dirBonus ? S.gemDir : 0); s.first++; } else { p = Math.ceil(base / 2); }
    s.combo++; s.maxCombo = Math.max(s.maxCombo, s.combo);
    if (s.ep === 'boss') { s.hp--; }
  } else {
    s.combo = 0;
    if (attempt === 1 && s.ep !== 'boss') { s.wrong[w.id] = true; s.queue.push(w); }
    if (s.ep === 'boss') { s.hearts--; s.wrong[w.id] = true; }
  }
  s.pts += p; s.lastP = p;
  s.fb = { ok: ok, ans: ans, kind: kind, p: p };
}
/* envoie au serveur les réponses en attente (par lots) ; en cas d'échec elles restent en file */
function flush() {
  var s = S.sess; if (!s || s.offline) { return Promise.resolve(); }
  if (s.flushing) { return s.flushing; }
  if (!s.pending.length) { return Promise.resolve(); }
  var batch = s.pending.splice(0, 40);
  s.flushing = api('POST', 'sessions/' + s.id + '/events', { events: batch }).then(function () { s.flushing = null; return flush(); }, function (e) { s.pending = batch.concat(s.pending); s.flushing = null; throw e; });
  return s.flushing;
}
function advance() {
  var s = S.sess; s.queue.shift(); s.qi++; s.fb = null;
  if (s.ep === 'boss') {
    if (s.hp <= 0) { finish(true); return; }
    if (s.hearts <= 0 || !s.queue.length) { finish(false); return; }
  } else if (!s.queue.length) { finish(true); return; }
  flush().catch(function () { /* réessayé à la fin */ });
  nextQ(); render();
}
function finish(win) {
  var s = S.sess; s.done = true; s.win = win; s.saving = true; s.err = null; render(); save();
}
function save() {
  var s = S.sess; s.saving = true; s.err = null;
  if (s.offline) { saveOffline(); return; }
  flush().then(function () { return api('POST', 'sessions/' + s.id + '/end', { activeSec: Math.round(s.activeMs / 1000) }); }).then(function (R) {
    s.saving = false; s.total_pts = R.gems; s.b = R.bonus; s.pts = R.points; s.first = R.first; s.rotInfo = R.rotation; s.grew = R.grew; s.bonusBoss = R.bonusBoss; s.activeSec = R.activeSec; s.res = R;
    S.bestCombo = Math.max(S.bestCombo || 0, s.maxCombo);
    return refresh().then(function () { trySync(); });
  }).then(function () {
    var perfect = S.sess === s && s.res.perfect;
    render();
    if (perfect || (s.ep === 'boss' && s.win)) { confetti(40); }
  }).catch(function (e) {
    s.saving = false;
    if (e.status === 401) { fail(e); return; }
    if (e.offline) { s.offline = true; saveOffline(); return; }
    s.err = e.message; render();
  });
}
/** réseau absent à la fin : la séance est gardée sur l'appareil et envoyée plus tard (le serveur recalcule tout) */
function saveOffline() {
  var s = S.sess, boss = s.ep === 'boss', perfect = !boss && Object.keys(s.wrong).length === 0, B = bossStatus();
  var b = { fin: s.win ? CFG.gems.finWin : CFG.gems.finLose, perfect: perfect ? CFG.gems.perfect : 0, boss: boss && s.win && !B.won ? CFG.boss.bonusGems : 0, daily: S.st.dailyDone ? 0 : CFG.gems.daily };
  if (!Offline.add({ clientId: s.clientId, userId: S.st.me.id, lang: s.lang, game: s.ep, dir: s.dir, label: s.meta.label, wordIds: s.wordIds, startedAt: s.startedAt, activeSec: Math.round(s.activeMs / 1000), events: s.allEvents })) {
    s.saving = false; s.err = 'Mémoire de l’appareil pleine : la séance ne peut pas être gardée.'; render(); return;
  }
  s.b = b; s.total_pts = s.pts + b.fin + b.perfect + b.boss + b.daily; s.rotInfo = localRotation(s.ep); s.bonusBoss = boss && B.won; s.activeSec = Math.max(20, Math.round(s.activeMs / 1000));
  s.saving = false; s.pendingSync = true; s.res = { perfect: perfect }; s.offline = true;
  S.points += s.total_pts; S.st.gems = S.points; S.st.dailyDone = true;
  if (boss && s.win && !B.won) { B.won = true; B.wonLang = s.lang; }
  if (!S.st.played7[6]) { S.st.played7[6] = true; S.st.streak++; }
  Offline.saveCache(S.st.me.id, S.st, S.stats);
  render();
  if (perfect || (boss && s.win)) { confetti(40); }
  trySync();
}

function hud(){
  var n=petNow(S.active);
  return '<div class="hud"><span class="pill pts">'+ic('gem','var(--sky)')+'<span class="tnum">'+S.points+'</span></span>'
   +'<span class="pill fl">'+ic('flame','var(--coral)')+'<span class="tnum">'+streak()+'</span></span><span class="sp"></span>'
   +'<span class="state s'+n.lvl+'">'+STATE_N[n.lvl]+'</span></div>'+syncBanner();
}
function petCard(full){
  var n=petNow(),P=PETS[S.active];
  return '<div class="chunk petcard l'+n.lvl+decorCls()+'">'+critterS(S.active,n.lvl,full?150:120,stage(),S.munch?'happy':null)
   +'<div class="petname">'+P.n+'<span class="muted" style="font:700 13px Nunito;margin-left:8px">'+P.k+' · '+['bébé','enfant','ado','adulte'][stage()]+'</span></div>'
   +'<div class="bubble">'+esc(petMsg(n))+'</div>'+bars(n)+evtLine(S.st.pet)
   +(full?'':'<button class="btn sm alt" data-act="tab" data-v="pet" style="margin-top:6px">'+ic('heart')+(n.ko?' Le relever':' Prendre soin')+'</button>')+'</div>';
}
function langLists(lang){return LISTS.filter(function(l){return l.lang===lang;});}
function scopeLabel(scope,one,pick,lang){
  var L=REALM[lang].s;
  if(scope==='all'){return 'Toutes mes listes · '+L;}
  if(scope==='one'){return LB[one].name;}
  if(scope==='pick'){return pick.length+' liste'+(pick.length>1?'s':'')+' · '+L;}
  return 'Mots à revoir · '+L;
}
function viewPlay(){
  var h=hud(),L=S.plang,R2=REALM[L],ls=langLists(L);
  if(!LB[S.one]||LB[S.one].lang!==L){S.one=ls[0]?ls[0].id:null;}
  S.pick=S.pick.filter(function(id){return LB[id]&&LB[id].lang===L;});
  if(S.rot[S.game]&&S.rot[S.game].locked){var f=ORDER.filter(function(g){return !(S.rot[g]&&S.rot[g].locked);})[0];S.game=f||'boss';}
  h+='<h1 class="disp" style="font-size:28px">Jouer</h1><p class="muted">Une seule langue par séance, environ 5 minutes.</p>';
  h+='<div class="step"><i>1</i>Quelle langue ?</div><div class="langsel">';
  ['nl','en'].forEach(function(l){h+='<button class="lbtn '+REALM[l].cls+'" aria-pressed="'+(L===l)+'" data-act="plang" data-v="'+l+'"><span class="lt">'+REALM[l].tag+'</span><span>'+REALM[l].s+'<small>'+langLists(l).length+' liste'+(langLists(l).length>1?'s':'')+'</small></span></button>';});
  h+='</div><div class="'+R2.cls+'">';
  var wk=S.st.weak[L]||0;
  h+='<div class="step"><i>2</i>Quoi réviser en '+R2.s.toLowerCase()+' ?</div><div class="scopes">';
  [['all','Toutes mes listes',ls.length+' liste'+(ls.length>1?'s':'')],['one','Une liste','au choix'],['pick','Ma sélection','plusieurs listes'],['weak','Mots à revoir',wk+' mot'+(wk>1?'s':'')+' difficile'+(wk>1?'s':'')]].forEach(function(x){
    h+='<button class="scope" aria-pressed="'+(S.scope===x[0])+'" data-act="scope" data-v="'+x[0]+'">'+x[1]+'<small>'+x[2]+'</small></button>';
  });
  h+='</div>';
  if(S.scope==='one'||S.scope==='pick'){
    ls.forEach(function(l){
      var on=S.scope==='one'?S.one===l.id:S.pick.indexOf(l.id)>-1;
      h+='<button class="pick" aria-pressed="'+on+'" data-act="pickl" data-id="'+l.id+'"><span class="box">'+ic('check')+'</span><span style="flex:1"><b>'+esc(l.name)+'</b><span class="s">'+R2.s+' · '+l.words.length+' mots · '+Math.round(mastery(l)*100)+' % maîtrisés</span></span></button>';
    });
  }
  var pool=wordsFor(S.scope,S.one,S.pick,L);
  h+='<div class="step"><i>3</i>Choisis ton jeu</div><div class="games">';
  ORDER.forEach(function(g){
    var G=GAMES[g],r=S.rot[g],lock=!!(r&&r.locked),info='',dots='';
    var BB=bossStatus();
    if(g==='boss'){if(!BB.won&&BB.ban===L){lock=true;info='<span class="rotinfo lock">Pas 3 semaines de suite en '+R2.s.toLowerCase()+' : choisis l’autre langue pour le Gardien de la semaine</span>';}else{info='<span class="rotinfo">Hors rotation : '+(BB.won?'Gardien de la semaine déjà vaincu':'Gardien de la semaine à vaincre')+'</span>';}}
    else if(lock){var need=ROT.need-r.seen.length;info='<span class="rotinfo lock">Verrouillé : joue '+need+' autre'+(need>1?'s':'')+' jeu'+(need>1?'x':'')+' différent'+(need>1?'s':'')+' ('+r.seen.length+'/'+ROT.need+')</span>';}
    else{var left=ROT.max-r.n;for(var k=0;k<ROT.max;k++){dots+='<i class="'+(k<r.n?'on':'')+'"></i>';}info='<span class="rotinfo">'+(left===1?'Dernière partie avant verrouillage':left+' parties avant verrouillage')+' <span class="rotdots">'+dots+'</span></span>';}
    h+='<button class="gcard'+(lock?' locked':'')+'" aria-pressed="'+(S.game===g)+'" data-act="game" data-v="'+g+'"><span class="gic" style="background:'+(lock?'var(--lock)':G.col)+'">'+ic(lock?'lock':G.ic)+'</span><span style="flex:1;min-width:0"><b>'+G.n+'</b><span class="d">'+G.d+'</span>'
      +'<span class="gm"><span class="gp">'+ic('gem','var(--sky)')+'+'+G.g+' par bon mot</span><span class="diff" title="Difficulté">'+'●'.repeat(G.hard)+'○'.repeat(5-G.hard)+'</span></span>'+info+'</span></button>';
  });
  h+='</div>';
  var fixed=S.game==='scramble'||S.game==='forge'||S.game==='boss';
  var adv=dirAdvice(L,S.scope==='one'?[S.one]:S.scope==='pick'?S.pick:null),dn=function(d){return d==='toFr'?R2.tag+' → français':'français → '+R2.tag;},pickDir=fixed?'toTarget':S.dir==='auto'?adv.dir:S.dir,gain=adv.deficit&&pickDir===(adv.dir)&&S.gemDir>0;
  h+='<div class="step"><i>4</i>Dans quel sens ?</div><div class="seg" style="display:flex"><button style="flex:1" data-act="dir" data-v="auto" aria-pressed="'+(S.dir==='auto'&&!fixed)+'"'+(fixed?' disabled':'')+'>Auto</button><button style="flex:1" data-act="dir" data-v="toFr" aria-pressed="'+(S.dir==='toFr'&&!fixed)+'"'+(fixed||S.dirForce?' disabled':'')+'>'+R2.tag+' → FR</button><button style="flex:1" data-act="dir" data-v="toTarget" aria-pressed="'+(S.dir==='toTarget'||(fixed&&!S.dirForce))+'"'+(S.dirForce&&!fixed?' disabled':'')+'>FR → '+R2.tag+'</button></div>';
  h+='<p class="muted" style="font-size:13px;margin-top:6px">'+(fixed?'Ce jeu se joue toujours en français → '+R2.tag+'.':S.dir==='auto'?(S.dirForce?'Sens imposé par ton parent : le moins travaillé ces 30 jours, ici ':'Auto : le sens le moins travaillé ces 30 jours, ici ')+dn(adv.dir)+'.':'')+(gain?' <b>+'+S.gemDir+' gemme par bon mot</b> dans ce sens.':'')+'</p>';
  var BS2=bossStatus(),nq=Math.min(GAMES[S.game].q,pool.length),locked=(S.rot[S.game]&&S.rot[S.game].locked)||(S.game==='boss'&&!BS2.won&&BS2.ban===L);
  h+='<div class="chunk summary">'+ic('clock')+'<span>≈ 5 min · '+nq+' mots · '+esc(scopeLabel(S.scope,S.one,S.pick,L))+'</span></div>';
  h+='<button class="btn wide" data-act="launch"'+(pool.length<2||locked?' disabled':'')+'>'+ic('play','currentColor')+' Lancer la séance</button>';
  if(S.scope==='weak'&&!pool.length){h+='<p class="muted" style="margin-top:10px">Aucun mot difficile en '+R2.s.toLowerCase()+' pour l’instant : bravo !</p>';}
  return '<div class="view'+(S.enter?' enter':'')+'">'+h+'</div></div>';
}
function viewPet(){
  var h=hud(),n=petNow();
  h+=petCard(true);
  if(n.ko){h+='<div class="alert bad" style="margin-top:12px">'+ic('alert')+'<span>'+PETS[S.active].n+' est à terre : ses jauges sont figées et seule la potion de résurrection peut le relever.</span></div>';}
  var groups=[['food','Nourriture'],['care','Soins'],['play','Jeux']];
  groups.forEach(function(g){
    h+='<h2 class="sec">'+g[1]+'</h2><div class="items">';
    ITEMS.filter(function(i){return i.cat===g[0];}).forEach(function(i){
      var gains=i.set?'relève à '+i.set.care+' partout':Object.keys(i.gain).map(function(k){return '+'+i.gain[k]+' '+STATN[k].toLowerCase();}).join(', ');
      var off=S.points<i.price||(i.ko?!n.ko:n.ko);
      h+='<button class="item" data-act="buy" data-id="'+i.id+'"'+(off?' disabled':'')+'>'+itemSvg(i.id)+i.n+'<small>'+gains+'</small><span class="price">'+ic('gem','var(--sky)')+i.price+'</span></button>';
    });
    h+='</div>';
  });
  [['acc','Accessoires'],['decor','Décors']].forEach(function(g){
    h+='<h2 class="sec">'+g[1]+' <span class="muted" style="font:700 12px Nunito">· à toi pour toujours</span></h2><div class="items">';
    DURABLE.filter(function(d){return d.cat===g[0];}).forEach(function(d){
      var own=!!S.inv[d.id],on=S.equip[d.cat]===d.id;
      var pv=d.cat==='acc'?critterS(S.active,0,42,1,null,d.id):'<span class="swatch d-'+d.id+'"></span>';
      h+='<button class="item'+(on?' on':'')+'" data-act="dur" data-id="'+d.id+'"'+(!own&&S.points<d.price?' disabled':'')+'>'+pv+d.n
        +'<small>'+(on?'Porté · retirer':own?'À toi · porter':(d.cat==='acc'?'pour tous tes compagnons':'fond de ton compagnon'))+'</small>'
        +(own?'<span class="price">'+ic('check')+'</span>':'<span class="price">'+ic('gem','var(--sky)')+d.price+'</span>')+'</button>';
    });
    h+='</div>';
  });
  h+='<h2 class="sec">Mes compagnons</h2>';
  Object.keys(PETS).forEach(function(id){
    var P=PETS[id],own=!!S.owned[id],act=S.active===id;
    h+='<div class="chunk crow"><div class="pv">'+critterS(id,own?(act?n.lvl:0):0,60,1)+'</div><div style="flex:1;min-width:0"><b>'+P.n+'</b><span class="k">'+P.k+(own?(act?' · actif':' · se repose au chaud'):'')+'</span></div>'
     +(own?(act?'<span class="state s0">Actif</span>':'<button class="btn sm alt" data-act="choose" data-id="'+id+'">Choisir</button>')
          :'<button class="btn sm" data-act="adopt" data-id="'+id+'"'+(S.points<P.price?' disabled':'')+'>'+ic('gem','var(--sky)')+P.price+'</button>')+'</div>';
  });
  h+='<p class="muted" style="font-size:12.5px;margin-top:6px">Chaque heure, l’énergie et le plaisir baissent (deux fois moins vite la nuit, de 20 h à 8 h, pendant qu’il dort ; il se réveille affamé) ; la vie baisse quand il a faim ou s’ennuie trop. Seul le compagnon actif est concerné, les autres se reposent.</p>';
  return '<div class="view'+(S.enter?' enter':'')+'">'+h+'</div>';
}
function viewWords(){
  var h=hud();
  if(S.sub&&S.sub.t==='list'){
    var l=LB[S.sub.id],R2=REALM[l.lang];
    h+='<div class="'+R2.cls+'"><button class="backbtn" data-act="back">'+ic('left')+' Mes mots</button>';
    h+='<div class="ptitle"><div><h1 class="disp" style="font-size:26px">'+esc(l.name)+'</h1><p class="muted">'+esc(l.sub)+' · '+l.words.length+' mots</p></div><span class="tag">'+R2.tag+'</span></div>';
    h+='<div class="chunk" style="padding:6px 14px">';
    l.words.forEach(function(w){var p='';for(var i=1;i<=3;i++){p+='<span class="pip'+(w.streak>=i?' on':'')+'"></span>';}h+='<div class="wrow"><span class="t">'+esc(w.term)+(w.forms?'<small style="display:block;font-weight:600;color:var(--ink-2)">'+esc(formsText(w))+'</small>':'')+'</span><span class="f">'+esc(w.fr)+'</span><span class="pips">'+p+'</span></div>';});
    h+='</div><div style="height:16px"></div><button class="btn wide" data-act="playlist" data-id="'+l.id+'">'+ic('play','currentColor')+' Jouer cette liste</button>'+(l.by==='moi'?'<button class="btn alt wide" style="margin-top:10px" data-act="editlist" data-id="'+l.id+'">Modifier cette liste</button><button class="btn alt wide" style="margin-top:10px" data-act="dellist" data-id="'+l.id+'">Supprimer cette liste</button>':'')+'</div>';
    return '<div class="view enter">'+h+'</div>';
  }
  h+='<div class="ptitle"><h1 class="disp" style="font-size:28px">Mes mots</h1></div>';
  h+='<div class="seg2"><button class="chip" aria-pressed="'+(S.lang==='all')+'" data-act="lang" data-v="all">Tout</button><button class="chip" aria-pressed="'+(S.lang==='nl')+'" data-act="lang" data-v="nl">Néerlandais</button><button class="chip" aria-pressed="'+(S.lang==='en')+'" data-act="lang" data-v="en">Anglais</button></div>';
  LISTS.filter(function(l){return S.lang==='all'||l.lang===S.lang;}).forEach(function(l){
    var m=mastery(l),R2=REALM[l.lang];
    h+='<button class="chunk lcard '+R2.cls+'" data-act="openlist" data-id="'+l.id+'"><div class="ringbox">'+ring(m,52,7,'var(--acc)')+'<b class="tnum">'+Math.round(m*100)+'</b></div>'
      +'<div style="flex:1;min-width:0"><h3>'+esc(l.name)+'</h3><div class="m">'+l.words.length+' mots · '+R2.s+(l.by==='parent'?' · liste proposée':'')+'</div></div>'+ic('chev')+'</button>';
  });
  h+='<button class="btn fab" data-act="newlist">'+ic('plus')+' Nouvelle liste</button>';
  return '<div class="view'+(S.enter?' enter':'')+'">'+h+'</div>';
}
function studentShell(){
  var v=S.tab==='home'?viewHome():S.tab==='play'?viewPlay():S.tab==='pet'?viewPet():S.tab==='stats'?viewStats():viewWords();
  var tb='<nav class="tabbar" aria-label="Navigation">'
   +'<button class="tab" data-act="tab" data-v="home" aria-current="'+(S.tab==='home')+'">'+ic('home')+'Accueil</button>'
   +'<button class="tab" data-act="tab" data-v="play" aria-current="'+(S.tab==='play')+'">'+ic('play','currentColor')+'Jouer</button>'
   +'<button class="tab" data-act="tab" data-v="pet" aria-current="'+(S.tab==='pet')+'">'+ic('paw')+'Avatar</button>'
   +'<button class="tab" data-act="tab" data-v="stats" aria-current="'+(S.tab==='stats')+'">'+ic('bars')+'Stats</button>'
   +'<button class="tab" data-act="tab" data-v="words" aria-current="'+(S.tab==='words')+'">'+ic('book')+'Mots</button></nav>';
  return v+tb;
}
function viewSheet(){
  var sh2=S.sheet;if(!sh2){return '';}
  if(sh2.t==='newlist'){
    return '<div class="scrim" data-act="closesheet"></div><div class="sheet"><h3>Nouvelle liste</h3><p class="muted" style="margin:4px 0 12px">Colle tes mots, un par ligne : <b>mot = traduction</b></p>'
     +'<label class="field" style="margin-bottom:10px">Langue<select class="txt" id="nl-lang"><option value="nl">Néerlandais</option><option value="en">Anglais</option></select></label>'
     +'<label class="field" style="margin-bottom:10px">Nom<input class="txt" id="nl-name" placeholder="Chapitre 5" autocomplete="off"></label>'
     +'<label class="field" style="margin-bottom:10px">Ou un fichier CSV (mot ; traduction)<input type="file" accept=".csv,.tsv,.txt,text/csv,text/plain" data-csv="#nl-words"></label>'
     +'<label class="field" style="margin-bottom:10px">Ou plusieurs fichiers CSV d’un coup (une liste par fichier, nommée comme le fichier)<input type="file" multiple accept=".csv,.tsv,.txt,text/csv,text/plain" data-csvmulti="1"></label>'
     +'<textarea id="nl-words" placeholder="de fiets = le vélo&#10;het huis = la maison"></textarea>'
     +'<div style="display:flex;gap:10px;margin-top:14px"><button class="btn alt" data-act="closesheet">Annuler</button><button class="btn good" style="flex:1" data-act="savelist">Créer la liste</button></div></div>';
  }
  if(sh2.t==='editlist'){
    var el=LB[sh2.id];if(!el){return '';}
    return '<div class="scrim" data-act="closesheet"></div><div class="sheet"><h3>Modifier la liste</h3><p class="muted" style="margin:4px 0 12px">Un mot par ligne : <b>mot = traduction</b>. Les mots que tu gardes gardent leur progression ; ajoute, corrige ou retire des lignes. ('+REALM[el.lang].s+')</p>'
     +'<label class="field" style="margin-bottom:10px">Nom<input class="txt" id="el-name" value="'+esc(el.name)+'" autocomplete="off"></label>'
     +'<label class="field" style="margin-bottom:10px">Ou remplacer par un fichier CSV (mot ; traduction)<input type="file" accept=".csv,.tsv,.txt,text/csv,text/plain" data-csv="#el-words"></label>'
     +'<textarea id="el-words" style="min-height:220px">'+esc(listText(el))+'</textarea>'
     +'<div style="display:flex;gap:10px;margin-top:14px"><button class="btn alt" data-act="closesheet">Annuler</button><button class="btn good" style="flex:1" data-act="saveedit" data-id="'+el.id+'">Enregistrer</button></div></div>';
  }
  return '';
}
function viewSession(){
  var s=S.sess;
  var c=s.cur,w=c.w,R2=REALM[w.lang],multi=c.form!==null,ans=expOf(w,s.dir,c.form),q=multi?w.term+' ('+w.fr+')':(s.dir==='toFr'?w.term:w.fr);
  var ask=multi?(c.form<0?'Écris les formes : '+w.hdr.join(' · '):'Donne : '+w.hdr[c.form]):'';
  var prog,left={};
  if(s.ep==='boss'){prog=(s.hpMax-s.hp)/s.hpMax;}
  else{s.queue.forEach(function(x){left[x.id]=1;});prog=(s.total-Object.keys(left).length)/s.total;}
  var extra='';
  if(s.ep==='boss'){extra='<div class="hearts">'+heart(s.hearts>=1)+heart(s.hearts>=2)+heart(s.hearts>=3)+'</div>';}
  else if(s.combo>=2){extra='<span class="combo">Combo ×'+s.combo+'</span>';}
  var h='<div class="sess '+R2.cls+'"><div class="s-top"><button class="xbtn" data-act="quit" aria-label="Quitter">'+ic('x')+'</button>'
    +'<div class="s-prog"><i style="width:'+Math.round(prog*100)+'%"></i></div><div class="s-extra">'+extra+'</div></div>'
    +'<div class="langband"><span>'+R2.s.toUpperCase()+' · '+R2.tag+'</span><span>'+GAMES[s.ep].n+'</span></div>'
    +'<div class="s-sub"><span>'+esc(s.meta.label)+'</span><span class="tnum" id="stime">'+Math.floor(s.activeMs/60000)+':'+pad(Math.floor(s.activeMs/1000)%60)+'</span></div>';
  h+='<div class="s-main">';
  if(s.ep==='boss'){h+='<div class="bosswrap"><div class="boss'+(s.fb&&s.fb.ok?' hit':'')+'">'+bossArt(w.lang,110)+'</div><div class="hpbar"><i style="width:'+Math.round(s.hp/s.hpMax*100)+'%"></i></div></div>';}
  var tagq=s.dir==='toFr'?R2.tag:'FR',taga=s.dir==='toFr'?'FR':R2.tag;
  if(c.type==='cards'&&w.forms){q=w.term+' ('+w.fr+')';ans=w.forms.join(' · ');tagq=taga=R2.tag;}
  if(c.type==='cards'){
    h+='<p class="q-lbl">'+(w.forms?'Quelles sont les formes de…':s.dir==='toFr'?'Que signifie…':'Comment dit-on…')+'</p>'
     +'<div class="deck"><span class="swhint l" id="hl">À revoir</span><span class="swhint r" id="hr">Je savais</span><div class="fcard" id="fcard"><div class="fflip" id="fflip">'
     +'<div class="fface front"><span class="tag">'+tagq+'</span><span class="w">'+esc(q)+'</span><small>Touche la carte pour la retourner</small></div>'
     +'<div class="fface back"><span class="tag">'+taga+'</span><span class="w">'+esc(ans)+'</span><small>Glisse : à droite si tu savais</small></div></div></div></div>'
     +'<div class="s-actions"><button class="btn bad" data-act="flash" data-v="0">À revoir</button><button class="btn good" data-act="flash" data-v="1">Je savais</button></div>';
  }else if(c.type==='duel'){
    h+='<p class="q-lbl">'+(multi?ask+' — de…':s.dir==='toFr'?'Que signifie…':'Comment dit-on…')+'</p><p class="q-word">'+esc(q)+'</p><div class="opts">';
    c.opts.forEach(function(o,i){var st='';if(s.fb){st=o===ans?' ok':(o===c.picked?' no':'');}h+='<button class="opt'+st+'" data-act="opt" data-i="'+i+'"'+(s.fb?' disabled':'')+'><span class="k">'+'ABCD'[i]+'</span>'+esc(o)+'</button>';});
    h+='</div>';
  }else if(c.type==='scramble'){
    var li=0,sl='';
    ans.split('').forEach(function(ch){
      if(ch===' '){sl+='<span class="slotgap"></span>';return;}
      var ti=c.slots[li];sl+='<button class="slot'+(ti!==undefined?' f':'')+(s.fb&&s.fb.ok?' okk':'')+'" data-act="slot" data-i="'+li+'">'+(ti!==undefined?esc(c.tiles[ti]):'')+'</button>';li++;
    });
    h+='<p class="q-lbl">'+(multi?ask+' — remets les lettres dans l’ordre':'Remets les lettres dans l’ordre')+'</p><p class="q-word">'+esc(q)+'</p><div class="slots">'+sl+'</div><div class="tiles">';
    c.tiles.forEach(function(t,i){h+='<button class="tile'+(c.slots.indexOf(i)>-1?' used':'')+'" data-act="tile" data-i="'+i+'">'+esc(t)+'</button>';});
    h+='</div>';
  }else{
    var hint=c.hint?ans.replace(/\s.*$/,'').slice(0,Math.min(2,ans.length))+'…':'';
    var inputs='';
    if(multi&&c.form<0){
      var gv=(c.given||'').split(' | ');
      w.forms.forEach(function(f,i){inputs+='<input '+(i===0?'id="fin" ':'')+'class="'+(s.fb?(s.fb.ok?'okk':'no'):'')+'" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="'+esc(w.hdr[i])+'" placeholder="'+esc(i===0&&hint?hint:w.hdr[i])+'" '+(s.fb?'disabled value="'+esc(gv[i]||'')+'"':'')+' style="margin-bottom:8px">';});
    }else{
      inputs='<input id="fin" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="'+(hint?esc(hint):'Ta réponse…')+'" '+(s.fb?'disabled class="'+(s.fb.ok?'okk':'no')+'" value="'+esc(c.given||'')+'"':'')+'>';
    }
    h+='<p class="q-lbl">'+(multi?ask+' — de…':s.dir==='toFr'?'Que signifie…':'Écris en '+R2.s.toLowerCase())+'</p><p class="q-word">'+esc(q)+'</p>'
     +'<form class="forge" id="forge">'+inputs
     +(s.fb?'':'<button class="btn" type="submit">Forger !</button><button class="btn alt sm" type="button" data-act="hint"'+(c.hint||S.points<1?' disabled':'')+'>'+ic('gem','var(--sky)')+' Indice (1 gemme)</button>')+'</form>';
  }
  h+='</div>';
  if(s.fb){
    var okm=CHEER_OK[s.qi%CHEER_OK.length],nom=s.fb.kind==='presque'?'Presque ! Surveille l’orthographe.':CHEER_NO[s.qi%CHEER_NO.length];
    h+='<div class="fb '+(s.fb.ok?'ok':'no')+'"><h3>'+(s.fb.ok?okm:nom)+'</h3>'
      +(s.fb.ok?'<p>'+(s.fb.p?'+'+s.fb.p+' gemme'+(s.fb.p>1?'s':''):'Mot retrouvé !')+(s.combo>=3?' · combo ×'+s.combo:'')+'</p>':'<p>Réponse : <b>'+esc(s.fb.ans.replace(/ \| /g,' · '))+'</b></p>')
      +'<button class="btn wide '+(s.fb.ok?'good':'bad')+'" data-act="next">Continuer</button></div>';
    h+='<div class="mascot">'+critterS(S.active,petNow(S.active).lvl,64,stage(),s.fb.ok?'happy':'sad')+'</div>';
  }
  return h+'</div>';
}
function viewRecap(){
  var s=S.sess,boss=s.ep==='boss',won=s.win,b=s.b,n=petNow(S.active);
  var title=boss?(won?'Gardien vaincu !':'Le gardien résiste…'):(Object.keys(s.wrong).length===0?'Sans faute !':'Séance terminée !');
  var missed=[],seen={};s.answers.forEach(function(a){if(!a.ok&&!seen[a.wid]){seen[a.wid]=1;missed.push(a);}});
  var h='<div class="recap '+REALM[s.lang].cls+'">'+critterS(S.active,n.lvl,130,stage(),won===false?'sad':'wow')+'<h1>'+title+'</h1>';
  h+='<span class="tag" style="font-size:13px">'+REALM[s.lang].s+' · '+GAMES[s.ep].n+'</span>';
  if(s.pendingSync){h+='<div class="alert" style="max-width:420px;width:100%">'+ic('clock')+'<span>Séance gardée sur ton appareil : elle sera envoyée dès que le réseau revient. Les gemmes sont une estimation.</span></div>';}
  if(boss&&s.bonusBoss){h+='<div class="alert" style="max-width:420px;width:100%">'+ic('crown')+'<span><b>Gardien bonus</b> : la semaine était déjà validée. Victoire ou défaite, il ne change rien pour '+PETS[S.active].n+' ni pour la règle des langues ; seules les gemmes des bonnes réponses comptent.</span></div>';}
  else if(boss&&won){h+='<div class="alert" style="max-width:420px;width:100%;background:var(--grass-soft)">'+ic('heart')+'<span><b>'+PETS[S.active].n+' est sauvé</b> : le Gardien de la semaine est vaincu.</span></div>';}
  h+='<div class="rgrid"><div class="chunk rcell"><b class="tnum">+'+s.total_pts+'</b><span>gemmes gagnées</span></div>'
    +'<div class="chunk rcell"><b class="tnum">'+(boss?s.answers.filter(function(a){return a.ok;}).length+'/'+s.hpMax:s.first+'/'+s.total)+'</b><span>'+(boss?'coups portés':'du premier coup')+'</span></div>'
    +'<div class="chunk rcell"><b class="tnum">'+dur(s.activeSec)+'</b><span>temps actif</span></div></div>';
  h+='<div class="chunk lines"><div class="row"><span>Bonnes réponses ('+GAMES[s.ep].g+' par mot)</span><b>+'+s.pts+'</b></div><div class="row"><span>Séance terminée</span><b>+'+b.fin+'</b></div>'
    +(s.dirBonus&&S.gemDir>0?'<div class="row"><span>dont sens à travailler (+'+S.gemDir+' par bon mot du 1er coup)</span><b>inclus</b></div>':'')
    +(b.perfect?'<div class="row"><span>Sans faute</span><b>+'+b.perfect+'</b></div>':'')
    +(b.boss?'<div class="row"><span>Gardien vaincu</span><b>+'+b.boss+'</b></div>':'')
    +(b.daily?'<div class="row"><span>Bon du jour</span><b>+'+b.daily+'</b></div>':'')
    +'<div class="row"><span>Solde</span><b>'+S.points+' gemmes</b></div></div>';
  if(s.grew){h+='<div class="alert" style="max-width:420px;width:100%;background:var(--grass-soft)">'+ic('heart')+'<span><b>'+PETS[s.grew.species].n+' a grandi : il est '+(s.grew.stage===3?'adulte':'maintenant '+s.grew.name)+' !</b>'+(s.grew.gems?' +'+s.grew.gems+' gemmes offertes.':'')+'</span></div>';}
  var ri=s.rotInfo||{locked:false,unlocked:[]};
  if(ri.locked){h+='<div class="alert bad" style="max-width:420px;width:100%">'+ic('lock','none')+'<span><b>'+GAMES[s.ep].n+' est verrouillé</b> après '+ROT.max+' séances : joue '+ROT.need+' autres jeux différents pour le retrouver.</span></div>';}
  if(ri.unlocked.length){h+='<div class="alert" style="max-width:420px;width:100%;background:var(--grass-soft)">'+ic('check')+'<span>Retrouvé : <b>'+ri.unlocked.map(function(g){return GAMES[g].n;}).join(', ')+'</b>.</span></div>';}
  h+='<p class="muted" style="max-width:380px;font-size:13.5px">'+PETS[S.active].n+' compte sur toi : dépense tes gemmes en nourriture et en soins pour le garder en pleine forme.</p>';
  if(missed.length){h+='<div><p class="muted" style="margin-bottom:6px">Mots à retravailler</p><div class="missed">'+missed.map(function(a){return '<span>'+esc(a.term)+'</span>';}).join('')+'</div></div>';}
  h+='<p class="muted" style="font-size:12.5px;max-width:380px">Séance enregistrée dans ton historique (jour, durée, résultats), consultable par ton parent.</p>';
  h+='<div style="display:flex;flex-direction:column;gap:10px;width:100%;max-width:420px">';
  h+='<button class="btn" data-act="redo" data-v="care">'+ic('heart')+' Soigner mon compagnon</button>';
  var rl=S.rot[s.ep]&&S.rot[s.ep].locked;
  if(missed.length&&!boss&&!rl){h+='<button class="btn alt" data-act="redo" data-v="missed">Rejouer les mots ratés</button>';}
  if(boss&&!won){h+='<button class="btn alt" data-act="redo" data-v="same">Retenter le Gardien</button>';}
  h+='<button class="btn alt" data-act="redo" data-v="menu">Choisir un autre jeu</button></div></div>';
  return h;
}
function bindSwipe(){
  var card=document.getElementById('fcard');if(!card){return;}
  var flip=document.getElementById('fflip'),hl=document.getElementById('hl'),hr=document.getElementById('hr'),sx=0,dx=0,drag=false,moved=false;
  card.addEventListener('pointerdown',function(e){drag=true;moved=false;sx=e.clientX;dx=0;card.setPointerCapture(e.pointerId);card.style.transition='none';});
  card.addEventListener('pointermove',function(e){if(!drag){return;}dx=e.clientX-sx;if(Math.abs(dx)>6){moved=true;}card.style.transform='translateX('+dx+'px) rotate('+dx/16+'deg)';hr.style.opacity=clamp(dx/90,0,1);hl.style.opacity=clamp(-dx/90,0,1);});
  card.addEventListener('pointerup',function(){
    if(!drag){return;}drag=false;card.style.transition='transform .25s';
    if(!moved){card.style.transform='';flip.classList.toggle('flipped');return;}
    if(Math.abs(dx)>90){card.style.transform='translateX('+(dx>0?500:-500)+'px) rotate('+(dx>0?30:-30)+'deg)';var ok=dx>0;setTimeout(function(){flashAnswer(ok);},180);}
    else{card.style.transform='';hr.style.opacity=0;hl.style.opacity=0;}
  });
}
function pop(t){var el=document.createElement('div');el.className='xpfloat';el.textContent=t;el.style.transform='translateX(-50%)';document.getElementById('app').appendChild(el);setTimeout(function(){el.remove();},900);}
function confetti(n){
  var host=document.getElementById('app'),cols=['#FFC62E','#FF6150','#2FBF71','#2E8CFF','#6C3FD1','#FF9418'];
  for(var i=0;i<n;i++){var c=document.createElement('i');c.className='conf';c.style.left=Math.random()*100+'%';c.style.background=cols[i%cols.length];c.style.animationDelay=(Math.random()*.6)+'s';c.style.animationDuration=(1.8+Math.random()*1.2)+'s';host.appendChild(c);(function(el){setTimeout(function(){el.remove();},3400);})(c);}
}

function viewHome(){
  var n=petNow(),P=PETS[S.active],B=bossStatus(),st=streak(),now=new Date();
  var hello=now.getHours()<12?'Bonjour':now.getHours()<18?'Bon après-midi':'Bonsoir',i,ST=S.stats,days=ST.days7,week=ST.minutes7,a7=ST.acc7;
  function col(v){return v>=50?'var(--grass)':v>=25?'var(--sun)':'var(--coral)';}
  var next=VOUCH.filter(function(v){return v.d>st;})[0];
  var h='<div class="ad-head"><div><small>'+dayLabel(now)+'</small><h1>'+hello+', '+esc(S.name)+'</h1></div>'
    +'<div class="ad-chips"><span class="ad-chip">'+ic('flame','var(--coral)')+'<span class="tnum">'+st+'</span></span><span class="ad-chip">'+ic('gem','var(--sky)')+'<span class="tnum">'+S.points+'</span></span></div></div>';
  h+=syncBanner();
  h+='<div class="ad-hero'+decorCls()+'">'+critterS(S.active,n.lvl,124,stage(),S.munch?'happy':null)+'<div class="name">'+P.n+'</div><div class="ad-state">'+P.k+' · '+STATE_N[n.lvl]+'</div><div class="sub">'+esc(petMsg(n))+'</div>'
    +'<div class="ad-gauges">'+GAUGES.map(function(k){return '<div class="ad-g"><div class="lab"><span>'+STATN[k]+'</span><span class="tnum">'+Math.round(n[k])+'</span></div><div class="tr"><i style="width:'+Math.round(n[k])+'%;background:'+col(n[k])+'"></i></div></div>';}).join('')+'</div>'+evtLine(S.st.pet)
    +'<button class="ad-link" data-act="tab" data-v="pet">'+(n.ko?'Le relever':'Prendre soin')+'</button></div>';
  h+='<button class="ad-cta" data-act="tab" data-v="play"><span>Commencer une séance</span><span class="k">≈ 5 min</span></button>';
  var bo=B.ban?otherLang(B.ban):null;
  h+='<div class="ad-sec"><h2>Gardien de la semaine</h2></div><div class="ad-card"><div class="ad-boss">'+bossArt(B.won?B.wonLang:bo,54)+'<div style="flex:1;min-width:0"><b>'+(B.won?'Vaincu en '+REALM[B.wonLang].s.toLowerCase()+' · '+P.n+' est sauvé':'À vaincre avant dimanche')+'</b><span>'+(B.won?'Un nouveau Gardien arrive lundi.':(B.left===0?'Dernier jour : avant ce soir minuit. ':B.left+' jour'+(B.left>1?'s':'')+' restant'+(B.left>1?'s':'')+'. Sans victoire, '+P.n+' perd '+BOSS_PEN.care+' de vie. ')+(bo?'Cette semaine : '+REALM[bo].s.toLowerCase()+' obligatoire (pas 3 semaines de suite en '+REALM[B.ban].s.toLowerCase()+').':'Tu choisis la langue.'))+'</span></div></div>'
    +'<div class="ad-bar"><i style="width:'+Math.round((7-B.left)/7*100)+'%"></i></div></div>';
  h+='<div class="ad-sec"><h2>Régularité</h2></div><div class="ad-card"><div class="ad-week">';
  for(i=6;i>=0;i--){var d=daysAgo(i);h+='<div class="ad-day'+(hasSess(i)?' on':'')+(i===0?' today':'')+'"><i></i>'+DINI[d.getDay()]+'</div>';}
  h+='</div><p class="ad-note"><b>Série de '+st+' jour'+(st>1?'s':'')+'.</b> '+(next?'Prochain bon dans '+(next.d-st)+' jour'+(next.d-st>1?'s':'')+' : +'+next.p+' gemmes.':'Tous les bons de palier sont atteints.')+'</p></div>';
  var dailyDone=S.st.dailyDone;
  h+='<div class="ad-sec"><h2>Bonus</h2></div><div class="ad-card ad-bonus">'
    +'<div class="ad-bn'+(dailyDone?' done':'')+'"><span class="ad-bi">'+ic('gift')+'</span><div class="ad-bt"><b>Bon du jour</b><span>'+(dailyDone?'Encaissé aujourd’hui':'Offert à ta première séance du jour')+'</span></div><span class="ad-bv">'+ic('gem','var(--sky)')+'+10</span></div>';
  S.st.vouchers.forEach(function(v){
    var can=v.can,done=v.claimed;
    h+='<div class="ad-bn'+(done?' done':'')+'"><span class="ad-bi">'+ic('gift')+'</span><div class="ad-bt"><b>'+v.d+' jours de suite</b>'
      +(can?'<span class="ok">Prêt à encaisser</span>':done?'<span>Encaissé</span>':'<div class="ad-bar" style="margin-top:7px"><i style="width:'+Math.round(Math.min(1,st/v.d)*100)+'%;background:var(--sun)"></i></div>')+'</div>'
      +(can?'<button class="ad-claim" data-act="claim" data-v="'+v.d+'">Encaisser '+ic('gem','var(--on-sun)')+'+'+v.p+'</button>':'<span class="ad-bv">'+ic('gem','var(--sky)')+'+'+v.p+'</span>')+'</div>';
  });
  h+='</div>';
  h+='<div class="ad-sec"><h2>Cette semaine</h2><button class="ad-link" style="margin:0" data-act="tab" data-v="stats">Toutes mes stats</button></div><div class="ad-stats">'
    +'<div class="ad-stat"><b class="tnum">'+days+'/7</b><span>jours joués</span></div><div class="ad-stat"><b class="tnum">'+dur(week*60)+'</b><span>de pratique</span></div><div class="ad-stat"><b class="tnum">'+(a7===null?'–':Math.round(a7*100)+' %')+'</b><span>de réussite</span></div></div>';
  h+=footerHTML();
  return '<div class="view'+(S.enter?' enter':'')+'">'+h+'</div>';
}


/* ---------- aperçu « comme l'élève » (compte parent) : bandeau hors de l'application, qui descend d'autant ---------- */
function previewBar(on) {
  var bar = document.getElementById('pvbar'), app = document.getElementById('app');
  if (!on) { if (bar) { bar.remove(); } app.classList.remove('pv'); return; }
  if (!bar) {
    bar = document.createElement('div'); bar.id = 'pvbar'; bar.className = 'previewbar'; bar.setAttribute('role', 'status');
    bar.innerHTML = '<span>Aperçu du compte de <b></b> : tes actions comptent dans sa progression.</span><button class="btn sm" type="button">Retour parent</button>';
    bar.querySelector('button').addEventListener('click', function () {
      api('POST', 'auth/unview', {}).then(function () { Offline.clearCache(); location.href = 'parent'; }).catch(fail);
    });
    document.body.insertBefore(bar, app);
  }
  bar.querySelector('b').textContent = S.st.me.name;
  app.classList.add('pv');
}

/* ---------- rendu ---------- */
function render() {
  var app = document.getElementById('app'), h;
  if (!S.booted) { h = ''; }
  else if (S.invite) { h = viewInvite(); }
  else if (!S.st) { h = viewLogin(); }
  else if (S.sess) { h = S.sess.done ? (S.sess.res ? viewRecap() : viewSaving()) : viewSession(); }
  else { h = studentShell(); }
  if (S.st && !S.invite) { h += viewSheet(); }
  if (S.toast) { h += '<div class="toast">' + esc(S.toast) + '</div>'; }
  app.className = 'app adult';
  app.innerHTML = h;
  previewBar(!!(S.st && S.st.me.preview && !S.invite));
  S.enter = false;
  bindSwipe();
  var f = document.getElementById('fin'); if (f && !f.disabled) { f.focus(); }
}
/** message éphémère ; si une fenêtre est ouverte, on ne redessine pas (render() effacerait les champs en cours de saisie) */
function toast(m) {
  var app = document.getElementById('app');
  function drop() { S.toast = null; if (S.sheet) { var x = app.querySelector('.toast'); if (x) { x.remove(); } } else { render(); } }
  S.toast = m;
  if (S.sheet) { var old = app.querySelector('.toast'); if (old) { old.remove(); } var d = document.createElement('div'); d.className = 'toast'; d.textContent = m; app.appendChild(d); }
  else { render(); }
  clearTimeout(toast.t); toast.t = setTimeout(drop, 2600);
}
function go(tab, extra) {
  S.tab = tab; S.sub = null; S.enter = true; if (extra) { extra(); } render();
  refresh().then(function () { render(); }).catch(softFail);
}
function after(p) { return p.then(refresh).then(function () { render(); }).catch(fail); }

document.getElementById('app').addEventListener('click', function (e) {
  var pf = e.target.closest('[data-pref]');
  if (pf) { setPref(pf.dataset.pref, pf.dataset.v); applyTheme(); render(); return; }
  var t = e.target.closest('[data-act]'); if (!t) { return; }
  var a = t.dataset.act, v = t.dataset.v, s = S.sess;
  if (a.indexOf('notif-') === 0) { handleNotif(a, t).then(function () { return loadNotif(); }).then(render).catch(function (e) { toast(e.message); }); return; }
  switch (a) {
    case 'noinvite': S.invite = null; history.replaceState(null, '', location.pathname + location.search); S.enter = true; render(); break;
    case 'logout': api('POST', 'auth/logout', {}).then(function () { Offline.clearCache(); S.st = null; S.sess = null; S.tab = 'home'; S.enter = true; render(); }).catch(fail); break;
    case 'tab': go(v); break;
    case 'lang': S.lang = v; render(); break;
    case 'openlist': S.sub = { t: 'list', id: t.dataset.id }; S.enter = true; render(); break;
    case 'back': S.sub = null; S.enter = true; render(); break;
    case 'scope': S.scope = v; render(); break;
    case 'plang': S.plang = v; render(); break;
    case 'bossweek': { var BS = bossStatus(); if (BS.ban) { S.plang = otherLang(BS.ban); } S.scope = 'all'; S.game = 'boss'; go('play'); break; }
    case 'playweak': go('play', function () { S.plang = t.dataset.lang; S.scope = 'weak'; }); break;
    case 'pickl':
      if (S.scope === 'one') { S.one = t.dataset.id; } else { var ix = S.pick.indexOf(t.dataset.id); if (ix > -1) { S.pick.splice(ix, 1); } else { S.pick.push(t.dataset.id); } }
      render(); break;
    case 'game':
      if (S.rot[v] && S.rot[v].locked) { toast('Verrouillé : joue ' + (ROT.need - S.rot[v].seen.length) + ' autre(s) jeu(x) pour le retrouver.'); break; }
      if (v === 'boss') { var BG = bossStatus(); if (!BG.won && BG.ban === S.plang) { toast('Pas 3 semaines de suite dans la même langue : choisis l’autre langue.'); break; } }
      S.game = v; render(); break;
    case 'dir': S.dir = v; render(); break;
    case 'launch': launch(); break;
    case 'playlist': go('play', function () { S.plang = LB[t.dataset.id].lang; S.scope = 'one'; S.one = t.dataset.id; }); break;
    case 'claim': after(api('POST', 'vouchers/' + v + '/claim', {}).then(function () { confetti(24); toast('Bon encaissé !'); })); break;
    case 'buy':
      api('POST', 'shop/buy', { item: t.dataset.id }).then(function (r) {
        S.sayPet = r.say; S.munch = 1; if (r.resurrected) { confetti(30); }
        setTimeout(function () { S.munch = 0; S.sayPet = null; render(); }, 2200);
        return refresh();
      }).then(function () { render(); }).catch(fail); break;
    case 'dur': {
      var D = DURABLE.filter(function (x) { return x.id === t.dataset.id; })[0];
      after(S.inv[D.id] ? api('POST', 'shop/equip', { item: D.id }) : api('POST', 'shop/buy', { item: D.id }).then(function () { confetti(24); toast(D.n + ' : à toi pour toujours !'); }));
      break;
    }
    case 'choose': after(api('POST', 'pets/' + t.dataset.id + '/activate', {})); break;
    case 'adopt': after(api('POST', 'pets/' + t.dataset.id + '/adopt', {}).then(function () { confetti(30); toast(PETS[t.dataset.id].n + ' rejoint ton équipe !'); })); break;
    case 'closesheet': S.sheet = null; render(); break;
    case 'newlist': S.sheet = { t: 'newlist' }; render(); break;
    case 'savelist':
      api('POST', 'lists', { lang: document.getElementById('nl-lang').value, name: document.getElementById('nl-name').value, text: document.getElementById('nl-words').value })
        .then(function (r) { S.sheet = null; return refresh().then(function () { S.sub = { t: 'list', id: String(r.id) }; render(); toast('Liste créée : ' + LB[String(r.id)].words.length + ' mots'); }); }).catch(function (e) { toast(e.message); });
      break;
    case 'editlist': S.sheet = { t: 'editlist', id: t.dataset.id }; render(); break;
    case 'saveedit':
      api('PUT', 'lists/' + t.dataset.id, { name: document.getElementById('el-name').value, text: document.getElementById('el-words').value })
        .then(function () { S.sheet = null; return refresh(); }).then(function () { render(); toast('Liste enregistrée.'); }).catch(function (e) { if (e.offline || e.status === 401) { fail(e); } else { toast(e.message); } });
      break;
    case 'dellist':
      if (window.confirm('Supprimer cette liste ?')) { api('DELETE', 'lists/' + t.dataset.id).then(function () { S.sub = null; return refresh(); }).then(function () { render(); }).catch(fail); }
      break;
    case 'quit': api('DELETE', 'sessions/' + s.id).catch(function () { /* nettoyée plus tard */ }); S.sess = null; S.enter = true; render(); break;
    case 'retrysave': save(); render(); break;
    case 'redo':
      if (v === 'care') { S.sess = null; go('pet'); }
      else if (v === 'menu') { S.sess = null; go('play'); }
      else if (v === 'missed') { var ids = []; s.answers.forEach(function (x) { if (!x.ok && ids.indexOf(x.wid) < 0) { ids.push(x.wid); } }); S.sess = null; launch({ scope: 'words', wordIds: ids, listIds: [], game: s.ep, lang: s.lang, dir: s.dir === 'toFr' ? 'toFr' : 'toTarget' }); }
      else { var prm = s.params; S.sess = null; launch(prm); }
      break;
    case 'flash': flashAnswer(v === '1'); break;
    case 'opt': {
      if (s.fb) { break; }
      var o = s.cur.opts[+t.dataset.i]; s.cur.picked = o;
      var ok = o === expOf(s.cur.w, s.dir, s.cur.form); resolve(ok, o, false);
      if (ok && s.lastP) { pop('+' + s.lastP); }
      render(); break;
    }
    case 'next': advance(); break;
    case 'tile': {
      if (s.fb) { break; }
      var c = s.cur; if (c.slots.indexOf(+t.dataset.i) > -1) { break; }
      c.slots.push(+t.dataset.i);
      var ans = expOf(c.w, s.dir, c.form).replace(/\s/g, '');
      if (c.slots.length === ans.length) {
        var built = c.slots.map(function (i) { return c.tiles[i]; }).join('');
        var okk = built.toLowerCase() === ans.toLowerCase();
        resolve(okk, built, false); if (okk && s.lastP) { pop('+' + s.lastP); }
      }
      render(); break;
    }
    case 'slot': { if (s.fb) { break; } var cc = s.cur; if (+t.dataset.i < cc.slots.length) { cc.slots.splice(+t.dataset.i, 1); } render(); break; }
    case 'hint': if (S.points >= 1 && !s.cur.hint) { S.points--; s.cur.hint = true; s.cur.hinted = true; s.pending.push({ type: 'hint' }); s.allEvents.push({ type: 'hint' }); render(); } break;
  }
});
document.getElementById('app').addEventListener('change', function (e) {
  var t = e.target;
  if (t.dataset && t.dataset.act === 'notif-time') { handleNotif('notif-time', t).then(render).catch(function (err) { toast(err.message); }); }
  if (t.dataset && t.dataset.csv) { readCsvInto(t, toast); }
  if (t.dataset && t.dataset.csvmulti && t.files && t.files.length) {
    toast('Import en cours…');
    importCsvFiles(t.files, document.getElementById('nl-lang').value, function (b) { return api('POST', 'lists', b); })
      .then(function (r) { return refresh().then(function () { if (r.ok) { S.sheet = null; render(); } toast(importSummary(r)); }); })
      .catch(function (e) { toast(e.message); });
  }
});
document.getElementById('app').addEventListener('submit', function (e) {
  if (e.target.id === 'inviteForm') {
    e.preventDefault();
    var fi = e.target;
    if (fi.password.value !== fi.password2.value) { S.invite.formErr = 'Les deux mots de passe ne sont pas identiques.'; render(); return; }
    api('POST', 'invite/' + encodeURIComponent(S.invite.token) + '/accept', { username: fi.username.value, password: fi.password.value })
      .then(function () { S.invite = null; history.replaceState(null, '', location.pathname + location.search); S.tab = 'home'; S.enter = true; return refresh(); })
      .then(function () { render(); loadNotif().then(render); })
      .catch(function (err) { if (err.status === 410) { S.invite = { err: err.message }; } else { S.invite.formErr = err.message; } render(); });
    return;
  }
  if (e.target.id === 'loginForm') {
    e.preventDefault();
    var f = e.target;
    api('POST', 'auth/login', { username: f.username.value, password: f.password.value, remember: f.remember.checked })
      .then(function (r) { if (r.me.role === 'parent') { location.href = 'parent'; return new Promise(function () { /* redirection en cours */ }); } S.loginErr = ''; S.tab = 'home'; S.enter = true; return refresh(); }).then(function () { render(); loadNotif().then(render); trySync(); })
      .catch(function (err) { S.loginErr = err.message; render(); });
    return;
  }
  if (e.target.id !== 'forge') { return; }
  e.preventDefault();
  var s = S.sess; if (!s || s.fb) { return; }
  var given = Array.prototype.slice.call(document.querySelectorAll('#forge input')).map(function (i) { return i.value.trim(); }).join(' | ');
  if (!given.replace(/[ |]/g, '')) { return; }
  var exp = expOf(s.cur.w, s.dir, s.cur.form), ok = Judge.isCorrect('forge', given, exp, S.set);
  s.cur.given = given; resolve(ok, given, !!s.cur.hinted);
  if (ok && s.lastP) { pop('+' + s.lastP); }
  render();
});
function flashAnswer(ok) {
  var s = S.sess; if (!s || s.cur.type !== 'cards' || s.fb) { return; }
  resolve(ok, '', false);
  if (ok && s.lastP) { pop('+' + s.lastP); }
  s.fb = null; advance();
}

/* temps actif : application au premier plan, avec une interaction dans les 45 dernières secondes */
var lastAct = Date.now();
['pointerdown', 'keydown', 'touchstart'].forEach(function (ev) { window.addEventListener(ev, function () { lastAct = Date.now(); }, { passive: true }); });
setInterval(function () {
  var s = S.sess; if (!s || s.done || document.hidden || Date.now() - lastAct > 45000) { return; }
  s.activeMs += 1000; var el = document.getElementById('stime');
  if (el) { el.textContent = Math.floor(s.activeMs / 60000) + ':' + pad(Math.floor(s.activeMs / 1000) % 60); }
}, 1000);
/* les jauges évoluent avec les heures : on rafraîchit de temps en temps hors séance */
setInterval(function () { if (S.st && !S.sess && !document.hidden) { refresh().then(function () { render(); }).catch(softFail); } }, 5 * 60000);
setInterval(function () { if (pendingCount() && navigator.onLine) { trySync(); } }, 60000);
window.addEventListener('online', function () { S.offline = false; if (S.st) { trySync().then(function () { return S.sess ? null : refresh().then(render); }).catch(softFail); } render(); });
window.addEventListener('offline', function () { S.offline = true; render(); });
window.onInstallReady = function () { if (S.st && !S.sess) { render(); } };

var invMatch = /(?:^|[#&])invite=([A-Za-z0-9_-]+)/.exec(location.hash);
if (invMatch) { S.invite = { token: invMatch[1] }; }
loadConfig().then(function (c) { applyConfig(c); if (S.invite) { return api('GET', 'invite/' + encodeURIComponent(S.invite.token)).then(function (r) { S.invite.name = r.name; }, function (e) { S.invite = { err: e.offline ? 'Pas de réseau : réessaie avec Internet.' : e.message }; }); } }).then(function () { if (S.invite) { return; } return api('GET', 'me').then(function (m) { if (m.me.role === 'parent') { location.replace('parent'); return new Promise(function () { /* redirection en cours */ }); } return refresh(); }).catch(function (e) {
    if (!e.offline) { S.st = null; return api('GET', 'setup').then(function (s) { S.setupNeeded = s.needed; }).catch(function () { /* rien */ }); }
    var c2 = Offline.loadCache();   // pas de réseau : on repart du dernier état connu
    if (c2) { applyState(c2.st, c2.stats); S.offline = true; } else { S.st = null; S.bootErr = 'Pas de réseau. Connecte-toi une première fois avec Internet pour utiliser Lexiquest hors-ligne.'; }
  }); })
  .then(function () { S.booted = true; render(); if (S.st) { loadNotif().then(render); trySync(); } })
  .catch(function (e) { document.getElementById('app').innerHTML = '<div class="view"><p>Impossible de joindre le serveur. ' + esc(e.message) + '</p></div>'; });
})();
