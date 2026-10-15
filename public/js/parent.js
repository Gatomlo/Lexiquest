(function () {
'use strict';
/* Suivi parent : quand, combien de temps, résultats, difficultés (cahier §9). */
var P = { me: null, students: [], sid: null, tab: 'overview', sub: null, sheet: null, toast: null, range: 30, dlang: 'all', 
  ov: null, invites: [], sessions: [], detail: null, diff: [], settings: null, lists: [], booted: false, loginErr: '', enter: true };
var STATE_N, GAMES, REALM = { nl: { s: 'Néerlandais', tag: 'NL', cls: 'r-nl' }, en: { s: 'Anglais', tag: 'EN', cls: 'r-en' } };

function base() { return 'admin/students/' + P.sid; }
function baseOf(id) { return 'admin/students/' + id; }
function load() {
  var t = P.tab;
  var p = api('GET', 'admin/students').then(function (r) {
    P.students = r.students;
    if (!P.sid || !r.students.some(function (s) { return s.id === P.sid; })) { P.sid = r.students.length ? r.students[0].id : null; }
    if (t === 'students') { return api('GET', 'admin/invites').then(function (o) { P.invites = o.invites; }); }
    if (!P.sid) { return null; }
    if (t === 'overview') { return api('GET', base() + '/overview').then(function (o) { P.ov = o; }); }
    if (t === 'sessions') { return api('GET', base() + '/sessions?range=' + (P.range === 999 ? 0 : P.range)).then(function (o) { P.sessions = o.sessions; }); }
    if (t === 'diff') { return api('GET', base() + '/difficulties').then(function (o) { P.diff = o.words; }); }
    return Promise.all([api('GET', base() + '/settings'), api('GET', base() + '/lists'), api('GET', 'admin/invites')]).then(function (r2) { P.settings = r2[0].settings; P.lists = r2[1].lists; P.invites = r2[2].invites; });
  });
  return p;
}
function fail(e) {
  if (e && e.status === 401) { P.me = null; render(); return; }
  toast(e && e.message ? e.message : 'Connexion impossible.');
}
function reload() { return load().then(render).catch(fail); }

function viewSetup() {
  return '<div class="view login"><div class="login-top">' + critter('phenix', 0, 96, 1, null, null)
   + '<h1>Lexiquest</h1><p>Bienvenue ! Crée le compte parent pour commencer.</p></div>'
   + '<form class="login-body" id="setupForm"><label class="field">Ton nom<input name="name" autocomplete="name" required></label>'
   + '<label class="field">Identifiant<input name="username" autocomplete="username" autocapitalize="none" required></label>'
   + '<label class="field">Mot de passe (8 caractères minimum)' + pwInput('name="password" minlength="8" autocomplete="new-password" required') + '</label>'
   + (P.loginErr ? '<div class="alert bad">' + ic('alert') + '<span>' + esc(P.loginErr) + '</span></div>' : '')
   + '<button class="btn wide" type="submit">Créer le compte parent</button>'
   + '<p class="login-note">Tu ajouteras ensuite le compte de l’élève dans Réglages.</p></form></div>';
}
function viewLogin() {
  if (P.setup) { return viewSetup(); }
  return '<div class="view login"><div class="login-top">' + critter('phenix', 0, 96, 1, null, null)
   + '<h1>Lexiquest</h1><p>Suivi parent</p></div>'
   + '<form class="login-body" id="loginForm"><label class="field">Identifiant<input name="username" autocomplete="username" autocapitalize="none" required></label>'
   + '<label class="field">Mot de passe' + pwInput('name="password" autocomplete="current-password" required') + '</label>'
   + (P.loginErr ? '<div class="alert bad">' + ic('alert') + '<span>' + esc(P.loginErr) + '</span></div>' : '')
   + '<label class="check"><input type="checkbox" name="remember" checked> Garder la connexion</label>'
   + '<button class="btn wide" type="submit">Se connecter</button></form></div>';
}
function who() {
  var sel = P.students.length > 1 ? '<select class="txt" id="studentSel" style="width:auto;margin-right:8px">' + P.students.map(function (s) { return '<option value="' + s.id + '"' + (s.id === P.sid ? ' selected' : '') + '>' + esc(s.name) + '</option>'; }).join('') + '</select>' : '';
  var peek = P.sid ? '<button class="btn sm alt" data-act="viewas">Voir comme l’élève</button>' : '';
  return '<div class="who">' + sel + peek + '</div>';
}
function noStudent() {
  return '<div class="ptitle"><h1>Suivi</h1></div><div class="pcard"><p class="muted">Aucun élève pour l’instant.</p><button class="btn sm wide" style="margin-top:10px" data-act="addstudent">' + ic('plus') + ' Ajouter un élève</button></div>' + footer();
}

function pOverview() {
  var o = P.ov, st = o.stats, pet = o.pet, B = o.boss, last = o.last, gone = o.goneDays;
  var h = '<div class="ptitle"><div><h1>Suivi de ' + esc(o.student.name) + '</h1><p class="muted">Élève</p></div>' + who() + '</div><div class="pgrid">';
  h += '<div class="pcard s12"><div class="status"><span class="sdot' + (gone === null || gone >= 2 ? ' warn' : '') + '"></span><div>' + (last
    ? '<b style="font-size:17px">' + (gone === 0 ? 'A travaillé aujourd’hui' : 'Dernière séance : ' + dayLabel(last.endedAt).toLowerCase()) + '</b><p class="muted">' + dayLabel(last.endedAt) + ' à ' + hm(last.startedAt) + ' · ' + dur(last.activeSec) + ' · ' + GAMES[last.game].n + ' · ' + esc(last.label) + '</p>'
    : '<b style="font-size:17px">Aucune séance pour l’instant</b>') + '</div></div></div>';
  h += '<div class="pcard s12"><div class="kpis">'
    + '<div class="kpi"><span>Jours joués · 7 j</span><b class="tnum">' + st.days7 + '/7</b><small class="' + (st.days7 >= st.goalDays ? 'up' : 'down') + '">objectif ' + st.goalDays + ' jours</small></div>'
    + '<div class="kpi"><span>Temps · 7 jours</span><b class="tnum">' + dur(st.minutes7 * 60) + '</b><small class="muted">' + st.sessions7 + ' séance' + (st.sessions7 > 1 ? 's' : '') + '</small></div>'
    + '<div class="kpi"><span>Réussite · 7 jours</span><b class="tnum">' + (st.acc7 === null ? '–' : Math.round(st.acc7 * 100) + ' %') + '</b><small class="' + (st.accDelta >= 0 ? 'up' : 'down') + '">' + (st.accDelta >= 0 ? '+' : '') + st.accDelta + ' pts vs semaine d’avant</small></div>'
    + '<div class="kpi"><span>Série</span><b class="tnum">' + st.streak + ' j</b><small class="muted">jours de suite avec séance</small></div></div></div>';
  var al = '', stuck = st.weak.filter(function (r) { return r.stuck; });
  if (gone === null) { al += '<div class="alert bad">' + ic('alert') + '<span>Aucune séance enregistrée.</span></div>'; }
  else if (gone >= 2) { al += '<div class="alert bad">' + ic('alert') + '<span>Aucune séance depuis ' + gone + ' jours.</span></div>'; }
  if (pet.ko) { al += '<div class="alert bad">' + ic('alert') + '<span>L’avatar ' + esc(pet.name) + ' est à terre : il attend une potion de résurrection (' + CFG.resPrice + ' gemmes).</span></div>'; }
  else if (pet.lvl >= 2) { al += '<div class="alert bad">' + ic('alert') + '<span>L’avatar ' + esc(pet.name) + ' est ' + STATE_N[pet.lvl].toLowerCase() + ' : il n’a pas eu de soins récemment.</span></div>'; }
  if (pet.hits > 0) { al += '<div class="alert bad">' + ic('alert') + '<span>Le Gardien n’a pas été vaincu la semaine dernière : ' + esc(pet.name) + ' a perdu ' + (pet.hits * o.rules.pen.care) + ' de vie.</span></div>'; }
  else if (!B.won && B.left <= 2) { al += '<div class="alert">' + ic('clock') + '<span>Gardien de la semaine pas encore vaincu : ' + (B.left === 0 ? 'dernier jour' : B.left + ' jour' + (B.left > 1 ? 's' : '') + ' restant' + (B.left > 1 ? 's' : '')) + '.</span></div>'; }
  if (st.days7 < st.goalDays) { al += '<div class="alert">' + ic('clock') + '<span>' + st.days7 + ' jour' + (st.days7 > 1 ? 's' : '') + ' joué' + (st.days7 > 1 ? 's' : '') + ' sur 7, pour un objectif de ' + st.goalDays + '.</span></div>'; }
  if (stuck.length) { al += '<div class="alert bad">' + ic('alert') + '<span>' + stuck.length + ' mot' + (stuck.length > 1 ? 's' : '') + ' raté' + (stuck.length > 1 ? 's' : '') + ' plus de 5 fois sans réussite récente : <b>' + stuck.slice(0, 3).map(function (r) { return esc(r.term); }).join(', ') + '</b>.</span></div>'; }
  if (!al) { al = '<div class="alert">' + ic('check') + '<span>Rien à signaler cette semaine.</span></div>'; }
  h += '<div class="pcard s6"><h2>À surveiller</h2><div class="alerts">' + al + '</div></div>';
  h += '<div class="pcard s6"><h2>Son compagnon</h2><div class="petrow">' + critter(pet.id, pet.lvl, 96, pet.stage, null, null) + '<div style="flex:1"><b>' + esc(pet.name) + ' · ' + pet.kind + '</b><p class="muted" style="margin-bottom:6px">' + STATE_N[pet.lvl] + (pet.days > 0 ? ' · ' + pet.days + ' jour' + (pet.days > 1 ? 's' : '') + ' sans soins' : '') + '</p>' + bars(pet) + evtLine(pet)
    + '<p class="muted" style="margin-top:10px;font-size:13px">Gardien de la semaine : <b>' + (B.won ? 'vaincu en ' + REALM[B.wonLang].s.toLowerCase() : (B.left === 0 ? 'à vaincre aujourd’hui' : 'à vaincre, ' + B.left + ' j restants')) + '</b></p></div></div></div>';
  var lg = st.dirs.lists.filter(function (l) { return l.toFr.n + l.toTarget.n > 0; });
  h += '<div class="pcard s6"><h2>Équilibre des deux sens</h2><p class="muted" style="margin-bottom:8px">Réponses du premier essai, 30 derniers jours</p>' + (lg.length ? lg.map(function (l) {
    var tot = l.toFr.n + l.toTarget.n, lop = Math.min(l.toFr.n, l.toTarget.n) / tot < 0.25;
    return '<p style="margin:10px 0 2px"><span class="tag ' + REALM[l.lang].cls + '">' + REALM[l.lang].tag + '</span> <b>' + esc(l.name) + '</b>' + (lop ? ' <small class="down">sens déséquilibré</small>' : '') + '</p>' + dirBars(l, REALM[l.lang].tag);
  }).join('') : '<p class="muted">Pas encore de séance.</p>') + '</div>';
  h += '<div class="pcard s6"><h2>Minutes par jour</h2>' + barChart(st) + '</div>';
  h += '<div class="pcard s6"><h2>Taux de réussite par semaine</h2>' + lineChart(st) + '</div>';
  h += '<div class="pcard s6"><h2>Jours travaillés · 8 semaines</h2>' + heatmap(st) + '</div>';
  var names = ['Avant 16 h', '16 – 18 h', '18 – 20 h', 'Après 20 h'], mx = Math.max.apply(null, o.hourBuckets.concat([1]));
  h += '<div class="pcard s6"><h2>À quelle heure ?</h2><p class="muted" style="margin-bottom:8px">Séances des 30 derniers jours</p>' + o.hourBuckets.map(function (n, i) { return '<div class="hbar"><span class="l">' + names[i] + '</span><div class="t"><i style="width:' + Math.round(n / mx * 100) + '%"></i></div><span class="v tnum">' + n + '</span></div>'; }).join('') + '</div>';
  return h + '</div>';
}
function pSessions() {
  var h = '<div class="ptitle"><h1>Séances</h1>' + who() + '</div><div class="seg2">';
  [[7, '7 jours'], [30, '30 jours'], [999, 'Tout']].forEach(function (r) { h += '<button class="chip" aria-pressed="' + (P.range === r[0]) + '" data-act="range" data-v="' + r[0] + '">' + r[1] + '</button>'; });
  h += '</div><div class="pcard">';
  var last = '';
  P.sessions.forEach(function (s) {
    var dl = dayLabel(s.endedAt);
    if (dl !== last) { h += '<div class="dayh">' + dl + '</div>'; last = dl; }
    var pc = s.n ? s.first / s.n : 0, cls = s.game === 'boss' ? (s.win ? 'g' : 'r') : (pc >= 0.8 ? 'g' : pc >= 0.6 ? 'o' : 'r');
    h += '<button class="srow" data-act="sess" data-id="' + s.id + '"><span class="tm tnum">' + hm(s.startedAt) + '</span><span class="main"><b>' + esc(s.label) + '</b><span><span class="tag ' + REALM[s.lang].cls + '">' + REALM[s.lang].tag + '</span> ' + GAMES[s.game].n + ' · ' + dur(s.activeSec) + '</span></span><span class="score ' + cls + '">' + (s.game === 'boss' ? (s.win ? 'Vaincu' : 'Échec') : s.first + '/' + s.n) + '</span></button>';
  });
  if (!P.sessions.length) { h += '<p class="muted">Aucune séance sur cette période.</p>'; }
  return h + '</div>';
}
function pSessDetail() {
  var s = P.detail; if (!s) { return ''; }
  var okn = s.answers.filter(function (a) { return a.ok; }).length;
  var h = '<button class="backbtn" data-act="back">' + ic('left') + ' Séances</button><div class="ptitle"><div><h1>' + esc(s.label) + '</h1><p class="muted">' + dayLabel(s.endedAt) + ' à ' + hm(s.startedAt) + ' · ' + GAMES[s.game].n + ' · ' + REALM[s.lang].s + '</p></div></div>';
  h += '<div class="kpis" style="margin-bottom:14px"><div class="kpi"><span>Temps actif</span><b class="tnum">' + dur(s.activeSec) + '</b></div><div class="kpi"><span>Réponses</span><b class="tnum">' + s.answers.length + '</b></div><div class="kpi"><span>Justes</span><b class="tnum">' + okn + '</b></div><div class="kpi"><span>Du 1er coup</span><b class="tnum">' + s.first + '/' + s.n + '</b></div></div>';
  h += '<div class="pcard"><h2>Réponse par réponse</h2><table class="adet">';
  s.answers.forEach(function (a) {
    h += '<tr><td class="okx" style="color:' + (a.ok ? 'var(--grass)' : 'var(--coral)') + '">' + (a.ok ? '✓' : '✗') + '</td><td><b>' + esc(a.term) + '</b><br><span class="muted">' + esc(a.fr) + (a.form_label ? ' · ' + esc(a.form_label.replace(/ \| /g, ' · ')) : '') + '</span></td><td>' + (a.ok ? '' : (a.given ? '« ' + esc(a.given) + ' »' : '<span class="muted">pas de réponse</span>') + (a.exp ? '<br><span class="muted">attendu : ' + esc(a.exp.replace(/ \| /g, ' · ')) + '</span>' : '') + (a.kind ? '<span class="kind">' + a.kind + '</span>' : '')) + (a.attempt === 2 ? '<span class="kind">2e essai</span>' : '') + (a.hinted ? '<span class="kind">indice</span>' : '') + '</td><td class="tnum muted" style="text-align:right">' + (a.ms / 1000).toFixed(1) + ' s</td></tr>';
  });
  return h + '</table></div>';
}
function pDiff() {
  var w = P.diff.filter(function (r) { return P.dlang === 'all' || r.lang === P.dlang; });
  var h = '<div class="ptitle"><h1>Mots difficiles</h1>' + who() + '</div><div class="seg2">';
  [['all', 'Tous'], ['nl', 'Néerlandais'], ['en', 'Anglais']].forEach(function (r) { h += '<button class="chip" aria-pressed="' + (P.dlang === r[0]) + '" data-act="dlang" data-v="' + r[0] + '">' + r[1] + '</button>'; });
  h += '</div><div class="pcard"><p class="muted" style="margin-bottom:6px">Au moins 3 essais sur 30 jours et 40 % d’échec ou plus.</p>';
  w.forEach(function (r, i) {
    var rate = Math.round(r.fails / r.attempts * 100), lw = r.lastWrong;
    h += '<div class="dword"><div class="top"><span class="rk">' + (i + 1) + '</span><div class="tt"><b>' + esc(r.term) + '</b><span>' + esc(r.fr) + ' · ' + REALM[r.lang].s + '</span></div><span class="pct tnum">' + rate + ' %</span></div>'
      + '<div class="bar2"><i style="width:' + rate + '%"></i></div>'
      + '<p class="sub tnum">' + r.fails + ' échecs sur ' + r.attempts + ' essais' + (lw ? ' · dernière erreur ' + dayLabel(lw.at).toLowerCase() + (lw.given ? ' : « ' + esc(lw.given) + ' »' : '') + (lw.kind ? '<span class="kind">' + lw.kind + '</span>' : '') : '') + '</p></div>';
  });
  if (!w.length) { h += '<p class="muted">Aucun mot difficile pour l’instant.</p>'; }
  return h + '</div>';
}
function footer() {
  return displayControls() + '<div style="height:16px"></div><button class="btn alt wide" data-act="logout">' + ic('out') + ' Se déconnecter</button>';
}
function pStudents() {
  var h = '<div class="ptitle"><h1>Élèves</h1></div><div class="pgrid">';
  P.students.forEach(function (s) {
    h += '<div class="pcard s6"><h2>' + esc(s.name) + (s.id === P.sid ? ' <span class="tag">suivi</span>' : '') + '</h2>'
      + '<p class="muted" style="margin-bottom:10px">Identifiant : ' + esc(s.username) + ' · ' + s.lists + ' liste' + (s.lists > 1 ? 's' : '') + ' · ' + (s.lastAt ? 'dernière séance ' + dayLabel(s.lastAt).toLowerCase() : 'pas encore de séance') + '</p>'
      + '<div style="display:flex;gap:8px;flex-wrap:wrap">'
      + '<button class="btn sm" data-act="follow" data-id="' + s.id + '">Voir le suivi</button>'
      + '<button class="btn sm alt" data-act="viewas" data-id="' + s.id + '">Voir comme l’élève</button>'
      + '<button class="btn sm alt" data-act="renamestudent" data-id="' + s.id + '">Renommer</button>'
      + '<button class="btn sm alt" data-act="resetpw" data-id="' + s.id + '">Nouveau mot de passe</button>'
      + '<button class="btn sm alt" data-act="delstudent" data-id="' + s.id + '" style="color:var(--coral)">Supprimer</button></div></div>';
  });
  if (!P.students.length) { h += '<div class="pcard s12"><p class="muted">Aucun élève pour l’instant.</p></div>'; }
  h += '<div class="pcard s12"><h2>Ajouter un élève</h2>'
    + P.invites.map(function (i) { return '<div class="row"><div><b>' + esc(i.name) + '</b><small>Invitation en attente · valable jusqu’au ' + new Date(i.expiresAt).toLocaleDateString('fr-BE') + '</small></div><button class="btn sm alt" data-act="delinvite" data-id="' + i.id + '">Annuler</button></div>'; }).join('')
    + '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><button class="btn sm" data-act="addstudent">' + ic('plus') + ' Inviter un élève</button><button class="btn sm alt" data-act="directstudent">Créer le compte moi-même</button></div></div>';
  return h + '</div>' + footer();
}
function pSettings() {
  var S = P.settings, stu = P.students.filter(function (s) { return s.id === P.sid; })[0], C = CFG;
  var h = '<div class="ptitle"><h1>Réglages</h1>' + who() + '</div><div class="pgrid"><div class="pcard s6"><h2>Objectif et correction</h2>'
   + '<div class="row"><div>Jours de jeu par semaine<small>Sert d’objectif dans le tableau de bord</small></div><div class="stepper"><button class="btn sm alt" data-act="goal" data-v="-1" aria-label="Moins">−</button><b class="tnum">' + S.goalDays + ' j</b><button class="btn sm alt" data-act="goal" data-v="1" aria-label="Plus">+</button></div></div>'
   + '<div class="row"><div>Durée d’une séance<small>Nombre de mots ajusté pour viser ≈ 5 min</small></div><b class="disp">≈ 5 min</b></div>'
   + '<div class="row"><div>Tolérer les accents<small>« cafe » accepté pour « café »</small></div><button class="switch" role="switch" aria-checked="' + S.accents + '" data-act="toggle" data-v="accents" aria-label="Tolérer les accents"></button></div>'
   + '<div class="row"><div>Articles obligatoires<small>« de fiets » et non « fiets », « to wake up » et non « wake up »</small></div><button class="switch" role="switch" aria-checked="' + S.articles + '" data-act="toggle" data-v="articles" aria-label="Articles obligatoires"></button></div></div>';
  h += '<div class="pcard s6"><h2>Comptes</h2>' + (stu ? '<div class="row"><div><b>' + esc(stu.name) + '</b><small>Élève · ' + esc(stu.username) + '</small></div><button class="btn sm alt" data-act="resetpw">Nouveau mot de passe</button></div>' : '')
   + P.invites.map(function (i) { return '<div class="row"><div><b>' + esc(i.name) + '</b><small>Invitation en attente · valable jusqu’au ' + new Date(i.expiresAt).toLocaleDateString('fr-BE') + '</small></div><button class="btn sm alt" data-act="delinvite" data-id="' + i.id + '">Annuler</button></div>'; }).join('')
   + '<div class="row"><div><b>' + esc(P.me.name) + '</b><small>Parent · administrateur</small></div></div><button class="btn sm wide" style="margin-top:10px" data-act="addstudent">' + ic('plus') + ' Inviter un élève</button></div>';
  h += '<div class="pcard s6"><h2>Listes de l’élève</h2>';
  P.lists.forEach(function (l) { h += '<div class="row"><div>' + esc(l.name) + '<small>' + REALM[l.lang].s + ' · ' + l.words.length + ' mots' + (l.by === 'parent' ? ' · donnée' : '') + (l.headers ? ' · ' + l.headers.length + ' colonnes' : '') + '</small></div>' + '<div class="row-actions"><button class="btn sm alt" data-act="editlist" data-id="' + l.id + '">Modifier</button><button class="btn sm alt" data-act="dellist" data-id="' + l.id + '" data-own="' + (l.by === 'parent' ? '' : '1') + '">Retirer</button></div></div>'; });
  if (!P.lists.length) { h += '<p class="muted">Aucune liste.</p>'; }
  if (P.students.length > 1 && P.lists.length) { h += '<button class="btn sm alt wide" style="margin-top:10px" data-act="copylists">Copier des listes vers un autre élève</button>'; }
  h += '<button class="btn sm wide" style="margin-top:10px" data-act="newlist">' + ic('plus') + ' Donner une liste</button></div>';
  h += '<div class="pcard s6"><h2>Régularité et récompenses</h2><div class="row"><div>Bon du jour<small>à la première séance du jour</small></div><b class="disp">+10 gemmes</b></div>';
  C.vouch.forEach(function (v) { h += '<div class="row"><div>' + v.d + ' jours de suite</div><b class="disp">+' + v.p + ' gemmes</b></div>'; });
  h += '<p class="muted" style="font-size:12.5px;margin-top:8px">Compagnon : −' + C.rates.joy + ' de plaisir et −' + C.rates.food + ' d’énergie par heure ; sous ' + C.low + ', faim et ennui retirent chacun ' + C.rates.care + ' de vie par heure. Une séance par jour plus le bon du jour suffit tout juste à l’entretenir. La nuit (' + C.night.from + ' h – ' + C.night.to + ' h), il dort : tout baisse deux fois moins vite. Un événement aléatoire tous les 1 à 3 jours. À 0 de vie, il est à terre jusqu’à une potion de résurrection (' + C.resPrice + ' gemmes).</p></div>';
  function stepper(k, step, unit, label, hint) {
    return '<div class="row"><div>' + label + (hint ? '<small>' + hint + '</small>' : '') + '</div><div class="stepper"><button class="btn sm alt" data-act="rule" data-k="' + k + '" data-d="' + (-step) + '" aria-label="Moins">−</button><b class="tnum">' + S[k] + unit + '</b><button class="btn sm alt" data-act="rule" data-k="' + k + '" data-d="' + step + '" aria-label="Plus">+</button></div></div>';
  }
  h += '<div class="pcard s12"><h2>Règles du jeu</h2>'
   + stepper('rotMax', 1, ' séances', 'Rotation : un jeu se verrouille après', 'Les cinq jeux restent accessibles à tour de rôle, pour varier')
   + stepper('rotNeed', 1, ' jeux', 'Pour le rouvrir : jouer', 'jeux différents (le Gardien compte)')
   + stepper('penCare', 5, '', 'Gardien non vaincu : perte de vie', 'Chaque semaine sans Gardien vaincu, au passage du lundi ; langue au choix mais jamais 3 semaines de suite la même ; un Gardien bonus ne change rien')
   + stepper('penJoy', 5, '', 'Gardien non vaincu : perte de plaisir', '')
   + stepper('gemDir', 1, '', 'Bonus du sens le moins travaillé', 'Gemmes en plus par bon mot du premier coup quand la séance est jouée dans le sens (langue → français ou français → langue) le moins travaillé ; 0 pour supprimer')
   + '<h2 style="margin-top:16px">Gemmes par bon mot</h2>'
   + stepper('gemCards', 1, '', GAMES.cards.n, 'Du premier coup ; moitié (arrondie au-dessus) avec indice ou au second essai ; +1 au combo de 3')
   + stepper('gemDuel', 1, '', GAMES.duel.n, '')
   + stepper('gemScramble', 1, '', GAMES.scramble.n, '')
   + stepper('gemForge', 1, '', GAMES.forge.n + ' (et écriture du Gardien)', '')
   + '<p class="muted" style="font-size:12.5px;margin-top:10px">Les valeurs d’origine sont calibrées pour qu’une séance par jour suffise tout juste à entretenir le compagnon : plus de gemmes ou moins de pertes rend le jeu plus facile.</p>'
   + '<button class="btn sm alt" style="margin-top:8px" data-act="rulesreset">Rétablir les valeurs d’origine</button></div>';
  h += '<div class="pcard s12"><h2>Données</h2><p class="muted">Export de toutes les séances et réponses au format CSV, ou suppression complète du compte élève.</p><div style="display:flex;gap:10px;margin-top:12px;flex-wrap:wrap"><a class="btn sm" style="text-decoration:none" href="' + base() + '/export.csv" download>' + ic('down') + ' Exporter en CSV</a><button class="btn sm alt" data-act="delstudent">Supprimer les données</button></div></div></div>';
  return h + notifCard('parent') + displayControls() + '<div style="height:16px"></div><button class="btn alt wide" data-act="logout">' + ic('out') + ' Se déconnecter</button>';
}
function viewSheet() {
  var s = P.sheet; if (!s) { return ''; }
  if (s.t === 'invite') {
    if (s.link) {
      return '<div class="scrim" data-act="closesheet"></div><div class="sheet"><h3>Lien pour ' + esc(s.name) + '</h3>'
       + '<p class="muted" style="margin:6px 0 12px">Envoie-lui ce lien (message, e-mail…). Il choisira son identifiant et son mot de passe. Valable 7 jours, à usage unique.</p>'
       + '<input class="txt" id="inviteLink" readonly value="' + esc(s.link) + '" onfocus="this.select()">'
       + '<div style="display:flex;gap:10px;margin-top:12px"><button class="btn" style="flex:1" data-act="copylink">Copier le lien</button>' + (navigator.share ? '<button class="btn alt" data-act="sharelink">Partager</button>' : '') + '</div>'
       + '<button class="btn alt wide" style="margin-top:10px" data-act="closesheet">Terminé</button></div>';
    }
    return '<div class="scrim" data-act="closesheet"></div><form class="sheet" id="inviteForm"><h3>Inviter un élève</h3>'
     + '<p class="muted" style="margin:6px 0 12px">Tu reçois un lien à lui envoyer : il crée lui-même son identifiant et son mot de passe.</p>'
     + '<label class="field" style="margin-bottom:10px">Prénom de l’élève<input class="txt" name="name" autocomplete="off" required></label>'
     + '<div style="display:flex;gap:10px;margin-top:14px"><button class="btn alt" type="button" data-act="closesheet">Annuler</button><button class="btn good" style="flex:1" type="submit">Créer le lien</button></div>'
     + '<button class="ad-link" type="button" data-act="directstudent" style="margin-top:12px">Je préfère créer le compte moi-même</button></form>';
  }
  if (s.t === 'rename') {
    var rs = P.students.filter(function (x) { return x.id === s.id; })[0]; if (!rs) { return ''; }
    return '<div class="scrim" data-act="closesheet"></div><form class="sheet" id="renameForm" data-id="' + rs.id + '"><h3>Renommer l’élève</h3>'
     + '<label class="field" style="margin:10px 0">Nom affiché<input class="txt" name="name" value="' + esc(rs.name) + '" maxlength="40" required></label>'
     + '<p class="muted">L’identifiant de connexion (' + esc(rs.username) + ') ne change pas.</p>'
     + '<div style="display:flex;gap:10px;margin-top:14px"><button class="btn alt" type="button" data-act="closesheet">Annuler</button><button class="btn good" style="flex:1" type="submit">Enregistrer</button></div></form>';
  }
  if (s.t === 'delstudent') {
    var ds = P.students.filter(function (x) { return x.id === s.id; })[0]; if (!ds) { return ''; }
    return '<div class="scrim" data-act="closesheet"></div><form class="sheet" id="delForm" data-id="' + ds.id + '" data-user="' + esc(ds.username) + '"><h3>Supprimer ' + esc(ds.name) + '</h3>'
     + '<div class="alert bad" style="margin:10px 0">' + ic('alert') + '<span>Le compte, les listes, les séances, les gemmes et le compagnon seront effacés <b>définitivement</b>.</span></div>'
     + '<label class="field" style="margin-bottom:10px">Pour confirmer, recopie l’identifiant : <b>' + esc(ds.username) + '</b><input class="txt" name="confirm" autocomplete="off" autocapitalize="none" required></label>'
     + '<div style="display:flex;gap:10px;margin-top:14px"><button class="btn alt" type="button" data-act="closesheet">Annuler</button><button class="btn bad" style="flex:1" type="submit">Supprimer définitivement</button></div></form>';
  }
  if (s.t === 'copylists') {
    var others = P.students.filter(function (x) { return x.id !== P.sid; });
    var nm = (P.students.filter(function (x) { return x.id === P.sid; })[0] || {}).name || 'l’élève';
    return '<div class="scrim" data-act="closesheet"></div><form class="sheet" id="copyForm"><h3>Copier des listes</h3>'
     + '<p class="muted" style="margin:4px 0 12px">Les mots sont copiés sans la progression de ' + esc(nm) + '. Les copies apparaissent comme listes données.</p>'
     + '<p class="muted" style="margin-bottom:6px"><b>Listes à copier</b></p>'
     + P.lists.map(function (l) { return '<label class="row" style="cursor:pointer"><span><input type="checkbox" name="list" value="' + l.id + '"> ' + esc(l.name) + '<small>' + REALM[l.lang].s + ' · ' + l.words.length + ' mots</small></span></label>'; }).join('')
     + '<p class="muted" style="margin:12px 0 6px"><b>Vers</b></p>'
     + others.map(function (x) { return '<label class="row" style="cursor:pointer"><span><input type="checkbox" name="to" value="' + x.id + '"' + (others.length === 1 ? ' checked' : '') + '> ' + esc(x.name) + '</span></label>'; }).join('')
     + '<div style="display:flex;gap:10px;margin-top:14px"><button class="btn alt" type="button" data-act="closesheet">Annuler</button><button class="btn good" style="flex:1" type="submit">Copier</button></div></form>';
  }
  if (s.t === 'editlist') {
    var el = P.lists.filter(function (x) { return String(x.id) === String(s.id); })[0]; if (!el) { return ''; }
    return '<div class="scrim" data-act="closesheet"></div><form class="sheet" id="editListForm" data-id="' + el.id + '"><h3>Modifier la liste</h3><p class="muted" style="margin:4px 0 12px">Un mot par ligne : <b>mot = traduction</b>. Les mots conservés gardent leur progression. (' + REALM[el.lang].s + ')</p>'
     + '<label class="field" style="margin-bottom:10px">Nom<input class="txt" name="name" value="' + esc(el.name) + '" required></label>'
     + '<label class="field" style="margin-bottom:10px">Ou remplacer par un fichier CSV (mot ; traduction)<input type="file" accept=".csv,.tsv,.txt,text/csv,text/plain" data-csv="#editListForm textarea"></label>'
     + '<textarea name="text" style="min-height:220px" required>' + esc(listText(el)) + '</textarea>'
     + '<div style="display:flex;gap:10px;margin-top:14px"><button class="btn alt" type="button" data-act="closesheet">Annuler</button><button class="btn good" style="flex:1" type="submit">Enregistrer</button></div></form>';
  }
  if (s.t === 'student') {
    return '<div class="scrim" data-act="closesheet"></div><form class="sheet" id="studentForm"><h3>Nouvel élève</h3>'
     + '<label class="field" style="margin:10px 0">Nom affiché<input class="txt" name="name" required></label><label class="field" style="margin-bottom:10px">Identifiant<input class="txt" name="username" autocapitalize="none" required></label>'
     + '<label class="field" style="margin-bottom:10px">Mot de passe (8 caractères minimum)' + pwInput('class="txt" name="password" minlength="8" required') + '</label>'
     + '<div style="display:flex;gap:10px;margin-top:14px"><button class="btn alt" type="button" data-act="closesheet">Annuler</button><button class="btn good" style="flex:1" type="submit">Créer le compte</button></div></form>';
  }
  if (s.t === 'password') {
    return '<div class="scrim" data-act="closesheet"></div><form class="sheet" id="pwForm"><h3>Nouveau mot de passe</h3>'
     + '<label class="field" style="margin:10px 0">Mot de passe (8 caractères minimum)' + pwInput('class="txt" name="password" minlength="8" required') + '</label>'
     + '<div style="display:flex;gap:10px;margin-top:14px"><button class="btn alt" type="button" data-act="closesheet">Annuler</button><button class="btn good" style="flex:1" type="submit">Enregistrer</button></div></form>';
  }
  return '<div class="scrim" data-act="closesheet"></div><form class="sheet" id="listForm"><h3>Donner une liste</h3><p class="muted" style="margin:4px 0 12px">Un mot par ligne : <b>mot = traduction</b></p>'
   + '<label class="field" style="margin-bottom:10px">Langue<select class="txt" name="lang"><option value="nl">Néerlandais</option><option value="en">Anglais</option></select></label>'
   + '<label class="field" style="margin-bottom:10px">Nom<input class="txt" name="name" placeholder="Chapitre 5" required></label>'
   + '<label class="field" style="margin-bottom:10px">Ou un fichier CSV (mot ; traduction)<input type="file" accept=".csv,.tsv,.txt,text/csv,text/plain" data-csv="#listForm textarea"></label>'
   + '<label class="field" style="margin-bottom:10px">Ou plusieurs fichiers CSV d’un coup (une liste par fichier, nommée comme le fichier)<input type="file" multiple accept=".csv,.tsv,.txt,text/csv,text/plain" data-csvmulti="1"></label>'
   + '<textarea name="text" placeholder="de fiets = le vélo&#10;het huis = la maison" required></textarea>'
   + '<div style="display:flex;gap:10px;margin-top:14px"><button class="btn alt" type="button" data-act="closesheet">Annuler</button><button class="btn good" style="flex:1" type="submit">Donner la liste</button></div></form>';
}
function shell() {
  var t = P.tab;
  if (!P.sid) { return '<div class="view enter">' + noStudent() + '</div>'; }
  var body = P.sub && P.sub.t === 'sess' ? pSessDetail() : t === 'overview' ? (P.ov ? pOverview() : '') : t === 'sessions' ? pSessions() : t === 'diff' ? pDiff() : t === 'students' ? pStudents() : (P.settings ? pSettings() : '');
  var tb = '<nav class="tabbar" aria-label="Navigation parent">'
   + '<button class="tab" data-act="ptab" data-v="overview" aria-current="' + (t === 'overview') + '">' + ic('bars') + 'Aperçu</button>'
   + '<button class="tab" data-act="ptab" data-v="sessions" aria-current="' + (t === 'sessions') + '">' + ic('list') + 'Séances</button>'
   + '<button class="tab" data-act="ptab" data-v="diff" aria-current="' + (t === 'diff') + '">' + ic('alert') + 'Difficultés</button>'
   + '<button class="tab" data-act="ptab" data-v="students" aria-current="' + (t === 'students') + '">' + ic('paw') + 'Élèves</button>'
   + '<button class="tab" data-act="ptab" data-v="settings" aria-current="' + (t === 'settings') + '">' + ic('gear') + 'Réglages</button></nav>';
  return '<div class="view' + (P.enter ? ' enter' : '') + '">' + body + '</div>' + tb;
}
function render() {
  var app = document.getElementById('app'), h = '';
  if (P.booted) { h = P.me ? shell() + viewSheet() : viewLogin(); }
  if (P.toast) { h += '<div class="toast">' + esc(P.toast) + '</div>'; }
  app.className = 'app adult';
  app.innerHTML = h; P.enter = false;
  if (P.me && P.tab === 'settings') { accordion(app); }
}
/** Réglages : chaque carte devient un accordéon, fermé par défaut ; l'état ouvert survit aux redessins */
function accordion(root) {
  P.open = P.open || {};
  Array.prototype.slice.call(root.querySelectorAll('.pcard')).forEach(function (card) {
    var h2 = card.querySelector('h2'); if (!h2 || h2.parentNode !== card) { return; }
    var d = document.createElement('details'), sm = document.createElement('summary'), key = h2.textContent;
    d.className = card.className + ' acc'; d.setAttribute('style', card.getAttribute('style') || ''); d.dataset.k = key; d.open = !!P.open[key];
    sm.textContent = key; card.removeChild(h2);
    while (card.firstChild) { d.appendChild(card.firstChild); }
    d.insertBefore(sm, d.firstChild); card.parentNode.replaceChild(d, card);
  });
}
document.addEventListener('toggle', function (e) { var d = e.target; if (d && d.classList && d.classList.contains('acc')) { P.open = P.open || {}; P.open[d.dataset.k] = d.open; } }, true);
/** message éphémère ; si une fenêtre est ouverte, on ne redessine pas (render() effacerait les champs en cours de saisie) */
function toast(m) {
  var app = document.getElementById('app');
  function drop() { P.toast = null; if (P.sheet) { var x = app.querySelector('.toast'); if (x) { x.remove(); } } else { render(); } }
  P.toast = m;
  if (P.sheet) { var old = app.querySelector('.toast'); if (old) { old.remove(); } var d = document.createElement('div'); d.className = 'toast'; d.textContent = m; app.appendChild(d); }
  else { render(); }
  clearTimeout(toast.t); toast.t = setTimeout(drop, 2600);
}

document.getElementById('app').addEventListener('click', function (e) {
  var pf = e.target.closest('[data-pref]');
  if (pf) { setPref(pf.dataset.pref, pf.dataset.v); applyTheme(); render(); return; }
  var t = e.target.closest('[data-act]'); if (!t) { return; }
  var a = t.dataset.act, v = t.dataset.v;
  if (a.indexOf('notif-') === 0) { handleNotif(a, t).then(function () { return loadNotif(); }).then(render).catch(function (err) { toast(err.message); }); return; }
  switch (a) {
    case 'logout': api('POST', 'auth/logout', {}).then(function () { P.me = null; P.ov = null; render(); }).catch(fail); break;
    case 'ptab': P.tab = v; P.sub = null; P.enter = true; render(); reload(); break;
    case 'range': P.range = +v; reload(); break;
    case 'dlang': P.dlang = v; render(); break;
    case 'sess': api('GET', base() + '/sessions/' + t.dataset.id).then(function (d) { P.detail = d; P.sub = { t: 'sess' }; P.enter = true; render(); }).catch(fail); break;
    case 'back': P.sub = null; P.enter = true; render(); break;
    case 'goal': api('PATCH', base(), { goalDays: P.settings.goalDays + (+v) }).then(function (r) { P.settings = r.settings; render(); }).catch(fail); break;
    case 'rule': { var rp = {}; rp[t.dataset.k] = P.settings[t.dataset.k] + (+t.dataset.d); api('PATCH', base(), rp).then(function (r) { P.settings = r.settings; render(); }).catch(fail); break; }
    case 'rulesreset': {
      var d0 = CFG.rulesDefault, rp2 = { rotMax: d0.rot.max, rotNeed: d0.rot.need, penCare: d0.pen.care, penJoy: d0.pen.joy, gemCards: d0.gems.cards, gemDuel: d0.gems.duel, gemScramble: d0.gems.scramble, gemForge: d0.gems.forge, gemDir: d0.gems.dir };
      api('PATCH', base(), rp2).then(function (r) { P.settings = r.settings; render(); toast('Valeurs d’origine rétablies.'); }).catch(fail); break;
    }
    case 'toggle': { var patch = {}; patch[v] = !P.settings[v]; api('PATCH', base(), patch).then(function (r) { P.settings = r.settings; render(); }).catch(fail); break; }
    case 'addstudent': P.sheet = { t: 'invite' }; render(); break;
    case 'directstudent': P.sheet = { t: 'student' }; render(); break;
    case 'copylink': {
      var li = document.getElementById('inviteLink'); li.select();
      (navigator.clipboard ? navigator.clipboard.writeText(li.value) : Promise.reject()).then(function () { toast('Lien copié.'); }, function () { try { document.execCommand('copy'); toast('Lien copié.'); } catch (e) { toast('Copie le lien à la main.'); } });
      break;
    }
    case 'sharelink': navigator.share({ title: 'Lexiquest', text: 'Voici ton lien pour créer ton compte Lexiquest :', url: P.sheet.link }).catch(function () { /* annulé */ }); break;
    case 'delinvite': api('DELETE', 'admin/invites/' + t.dataset.id).then(reload).catch(fail); break;
    case 'follow': P.sid = +t.dataset.id; P.ov = null; P.settings = null; P.tab = 'overview'; P.enter = true; render(); reload(); break;
    case 'renamestudent': P.sheet = { t: 'rename', id: +t.dataset.id }; render(); break;
    case 'resetpw': if (t.dataset.id) { P.sid = +t.dataset.id; P.ov = null; P.settings = null; } P.sheet = { t: 'password' }; render(); break;
    case 'newlist': P.sheet = { t: 'list' }; render(); break;
    case 'copylists': P.sheet = { t: 'copylists' }; render(); break;
    case 'viewas': api('POST', baseOf(t.dataset.id || P.sid) + '/view-as', {}).then(function () { location.href = './'; }).catch(fail); break;
    case 'editlist': P.sheet = { t: 'editlist', id: t.dataset.id }; render(); break;
    case 'closesheet': P.sheet = null; render(); break;
    case 'dellist':
      if (t.dataset.own && !window.confirm('Cette liste a été créée par l’élève. La retirer quand même ?')) { break; }
      api('DELETE', base() + '/lists/' + t.dataset.id).then(reload).catch(fail); break;
    case 'delstudent': P.sheet = { t: 'delstudent', id: +(t.dataset.id || P.sid) }; render(); break;
  }
});
document.getElementById('app').addEventListener('change', function (e) {
  if (e.target.dataset && e.target.dataset.act === 'notif-time') { handleNotif('notif-time', e.target).then(render).catch(function (err) { toast(err.message); }); }
  if (e.target.dataset && e.target.dataset.csv) { readCsvInto(e.target, toast); }
  if (e.target.dataset && e.target.dataset.csvmulti && e.target.files && e.target.files.length) {
    toast('Import en cours…');
    importCsvFiles(e.target.files, document.querySelector('#listForm [name=lang]').value, function (b) { return api('POST', base() + '/lists', b); })
      .then(function (r) { if (r.ok) { P.sheet = null; } return reload().then(function () { toast(importSummary(r)); }); })
      .catch(function (err) { toast(err.message); });
  }
  if (e.target.id === 'studentSel') { P.sid = +e.target.value; P.ov = null; P.settings = null; reload(); }
});
document.getElementById('app').addEventListener('submit', function (e) {
  e.preventDefault();
  var f = e.target, id = f.id;
  if (id === 'renameForm') {
    api('PATCH', baseOf(f.dataset.id), { name: f.name.value }).then(function () { P.sheet = null; toast('Nom enregistré.'); return reload(); }).catch(function (err) { toast(err.message); });
  } else if (id === 'delForm') {
    api('DELETE', baseOf(f.dataset.id), { confirm: f.confirm.value }).then(function () {
      P.sheet = null; if (P.sid === +f.dataset.id) { P.sid = null; P.ov = null; P.settings = null; } toast('Compte supprimé.'); return reload();
    }).catch(function (err) { toast(err.message); });
  } else if (id === 'copyForm') {
    var pick = function (n) { return Array.prototype.slice.call(f.querySelectorAll('input[name=' + n + ']:checked')).map(function (i) { return +i.value; }); };
    var ls = pick('list'), to = pick('to');
    if (!ls.length || !to.length) { toast('Coche au moins une liste et un élève.'); return; }
    api('POST', base() + '/lists/copy', { listIds: ls, to: to }).then(function (r) { P.sheet = null; toast(r.copied + ' liste' + (r.copied > 1 ? 's' : '') + ' copiée' + (r.copied > 1 ? 's' : '') + '.'); }).catch(function (err) { toast(err.message); });
  } else if (id === 'editListForm') {
    api('PUT', base() + '/lists/' + f.dataset.id, { name: f.name.value, text: f.text.value }).then(function () { P.sheet = null; toast('Liste enregistrée.'); return reload(); }).catch(function (err) { toast(err.message); });
  } else if (id === 'inviteForm') {
    api('POST', 'admin/invites', { name: f.name.value }).then(function (r) {
      P.sheet = { t: 'invite', name: f.name.value.trim(), link: new URL('./', location.href).href + '#invite=' + r.token }; render();
      if (P.tab === 'settings') { load().then(function () { /* liste des invitations à jour au retour */ }); }
    }).catch(function (err) { toast(err.message); });
  } else if (id === 'setupForm') {
    api('POST', 'setup', { name: f.name.value, username: f.username.value, password: f.password.value })
      .then(function (r) { P.me = r.me; P.setup = false; P.loginErr = ''; P.tab = 'overview'; return load().then(loadNotif); }).then(render)
      .catch(function (err) { P.loginErr = err.message; render(); });
  } else if (id === 'loginForm') {
    api('POST', 'auth/login', { username: f.username.value, password: f.password.value, remember: f.remember.checked })
      .then(function (r) { if (r.me.role !== 'parent') { location.href = './'; return new Promise(function () { /* redirection en cours */ }); } P.me = r.me; P.loginErr = ''; P.tab = 'overview'; return load().then(loadNotif); }).then(render)
      .catch(function (err) { P.loginErr = err.message; render(); });
  } else if (id === 'studentForm') {
    api('POST', 'admin/students', { name: f.name.value, username: f.username.value, password: f.password.value })
      .then(function (r) { P.sheet = null; P.sid = r.id; P.ov = null; toast('Compte créé.'); return reload(); }).catch(function (err) { toast(err.message); });
  } else if (id === 'pwForm') {
    api('PATCH', base(), { password: f.password.value }).then(function () { P.sheet = null; render(); toast('Mot de passe changé.'); }).catch(function (err) { toast(err.message); });
  } else if (id === 'listForm') {
    api('POST', base() + '/lists', { lang: f.lang.value, name: f.name.value, text: f.text.value }).then(function () { P.sheet = null; toast('Liste donnée.'); return reload(); }).catch(function (err) { toast(err.message); });
  }
});

window.onInstallReady = function () { if (P.me) { render(); } };
loadConfig().then(function (c) { STATE_N = c.stateN; GAMES = c.games; return api('GET', 'me'); })
  .then(function (r) { if (r.me.role !== 'parent') { location.replace('./'); return new Promise(function () { /* redirection en cours */ }); } P.me = r.me; return load().then(loadNotif); })
  .catch(function () { P.me = null; return api('GET', 'setup').then(function (s) { P.setup = s.needed; }).catch(function () { /* hors-ligne */ }); })
  .then(function () { P.booted = true; render(); });
})();
