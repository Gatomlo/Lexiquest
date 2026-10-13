'use strict';
/* Outils communs à l'application élève et au suivi parent. Chemins relatifs uniquement (montage sous /lexiquest). */
var CFG = null;
var DAYN = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
var MONN = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
var DINI = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
var STATN = { food: 'Énergie', care: 'Vie', joy: 'Plaisir' };
var GAUGES = ['care', 'food', 'joy'];

function pad(n) { return String(n).padStart(2, '0'); }
function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
function sh(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
function hm(d) { d = new Date(d); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
function dur(sec) { if (sec < 90) { return Math.round(sec) + ' s'; } var m = Math.round(sec / 60); if (m < 60) { return m + ' min'; } return Math.floor(m / 60) + ' h ' + pad(m % 60); }
function dayLabel(d) {
  d = new Date(d); var t = new Date();
  var diff = Math.round((new Date(t.getFullYear(), t.getMonth(), t.getDate()) - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 864e5);
  if (diff === 0) { return 'Aujourd’hui'; }
  if (diff === 1) { return 'Hier'; }
  return DAYN[d.getDay()] + ' ' + d.getDate() + ' ' + MONN[d.getMonth()];
}

/* ---------- API ---------- */
function api(method, path, body) {
  return fetch('api/' + path, {
    method: method, credentials: 'same-origin',
    // toute requête qui modifie quelque chose porte un corps JSON (même vide) : le serveur l'exige
    headers: method === 'GET' ? {} : { 'Content-Type': 'application/json' },
    body: method === 'GET' ? undefined : JSON.stringify(body === undefined ? {} : body),
  }).catch(function () {
    var off = new Error('Pas de réseau.'); off.offline = true; throw off;
  }).then(function (res) {
    return res.text().then(function (t) {
      var j = null; try { j = JSON.parse(t); } catch (e) { /* pas du JSON */ }
      if (!res.ok) { var err = new Error((j && j.error) || 'Erreur ' + res.status); err.status = res.status; throw err; }
      return j;
    });
  });
}
function loadConfig() {
  return api('GET', 'config').then(function (c) { CFG = c; setPref('config', JSON.stringify(c)); return c; }, function (e) {
    var c = null; try { c = JSON.parse(pref('config', 'null')); } catch (x) { /* cache illisible */ }
    if (e.offline && c) { CFG = c; return c; }
    throw e;
  });
}

/* ---------- affichage : style (Jeu / Adulte) et thème (clair / sombre), gardés dans le navigateur ---------- */
function pref(k, d) { try { return localStorage.getItem('lq.' + k) || d; } catch (e) { return d; } }
function setPref(k, v) { try { localStorage.setItem('lq.' + k, v); } catch (e) { /* stockage indisponible */ } }
function applyTheme() {
  var t = pref('mode', 'auto');
  if (t === 'auto') { delete document.documentElement.dataset.theme; } else { document.documentElement.dataset.theme = t; }
}
applyTheme();

/* ---------- jauges ---------- */
function bars(n) {
  function col(v) { return v >= 50 ? 'var(--grass)' : v >= 25 ? 'var(--sun)' : 'var(--coral)'; }
  return '<div class="sbars">' + GAUGES.map(function (k) { return '<div class="sb"><span class="n">' + STATN[k] + '</span><div class="t"><i style="width:' + Math.round(n[k]) + '%;background:' + col(n[k]) + '"></i></div><span class="v tnum">' + Math.round(n[k]) + '</span></div>'; }).join('') + '</div>';
}
function evtLine(pet) {
  var e = pet.lastEvent; if (!e) { return ''; }
  var when = e.hoursAgo < 1 ? 'À l’instant' : e.hoursAgo < 24 ? 'Il y a ' + e.hoursAgo + ' h' : 'Il y a ' + Math.floor(e.hoursAgo / 24) + ' j';
  return '<div class="evt">' + when + ' : ' + esc(pet.name) + ' ' + e.text + ' <b class="' + (e.delta > 0 ? 'up' : 'dn') + '">' + (e.delta > 0 ? '+' : '−') + Math.abs(e.delta) + ' ' + STATN[e.gauge].toLowerCase() + '</b></div>';
}

/* ---------- graphiques (données : voir lib/stats.js) ---------- */
function barChart(st) {
  var vals = [], i, mx = st.goalMin * 1.6;
  for (i = 6; i >= 0; i--) { vals.push({ m: st.minutesByDay[i], l: DINI[(st.today.dow - i + 700) % 7] }); mx = Math.max(mx, st.minutesByDay[i]); }
  var W = 300, H = 150, base = 118, ph = 92, x0 = 14, step = 40, bw = 26;
  var g = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Minutes de travail par jour sur 7 jours">';
  var gy = base - st.goalMin / mx * ph;
  g += '<line x1="6" x2="' + (W - 6) + '" y1="' + base + '" y2="' + base + '" class="grid"/>';
  vals.forEach(function (v, k) {
    var hgt = Math.max(v.m ? 3 : 0, v.m / mx * ph);
    g += '<rect class="bar' + (v.m < st.goalMin ? ' low' : '') + '" x="' + (x0 + k * step) + '" y="' + (base - hgt) + '" width="' + bw + '" height="' + hgt + '" rx="7"/>';
    g += '<text x="' + (x0 + k * step + bw / 2) + '" y="' + (base - hgt - 6) + '" text-anchor="middle">' + (v.m ? Math.round(v.m) : '') + '</text>';
    g += '<text x="' + (x0 + k * step + bw / 2) + '" y="' + (base + 16) + '" text-anchor="middle">' + v.l + '</text>';
  });
  return g + '<line class="goal" x1="6" x2="' + (W - 6) + '" y1="' + gy + '" y2="' + gy + '"/><text class="gl" x="' + (W - 8) + '" y="' + (gy - 5) + '" text-anchor="end">séance cible ' + st.goalMin + ' min</text></svg>';
}
function heatmap(st) {
  var since = (st.today.dow + 6) % 7, h = '<div class="heat"><span></span>';
  for (var c = 0; c < 8; c++) { h += '<span class="dl" style="text-align:center">' + (c === 7 ? 'cette sem.' : '') + '</span>'; }
  var names = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
  for (var r = 0; r < 7; r++) {
    h += '<span class="dl">' + names[r] + '</span>';
    for (c = 0; c < 8; c++) {
      var back = since + 49 - (c * 7 + r), cls = 'hm';
      if (back < 0) { cls += ' fut'; } else {
        var m = st.minutesByDay[back] || 0; cls += m <= 0 ? '' : m < 3 ? ' l1' : m < 6 ? ' l2' : m < 10 ? ' l3' : ' l4';
        if (back === 0) { cls += ' now'; }
      }
      h += '<span class="' + cls + '"></span>';
    }
  }
  return h + '</div><div class="hleg"><span><i class="hm"></i>0 min</span><span><i class="hm l1"></i>moins de 3 min</span><span><i class="hm l2"></i>3 à 5 min</span><span><i class="hm l3"></i>6 à 9 min</span><span><i class="hm l4"></i>10 min et +</span><span><i class="hm now"></i>aujourd’hui</span></div>';
}
function lineChart(st) {
  var pts = st.accWeeks, W = 300, H = 130, x0 = 26, x1 = 284, yMin = 0.4, yMax = 1, top = 18, bot = 100;
  function X(k) { return x0 + k * (x1 - x0) / 7; }
  function Y(v) { return bot - (clamp(v, yMin, yMax) - yMin) / (yMax - yMin) * (bot - top); }
  var valid = pts.map(function (v, k) { return v === null ? null : [X(k), Y(v), v]; }).filter(Boolean);
  var g = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Taux de réussite par semaine">';
  [0.5, 0.75, 1].forEach(function (v) { g += '<line class="grid" x1="' + x0 + '" x2="' + x1 + '" y1="' + Y(v) + '" y2="' + Y(v) + '"/><text x="2" y="' + (Y(v) + 4) + '">' + Math.round(v * 100) + '</text>'; });
  if (valid.length) {
    var d = valid.map(function (p, k) { return (k ? 'L' : 'M') + p[0] + ' ' + p[1]; }).join(' ');
    g += '<path class="area" d="' + d + ' L' + valid[valid.length - 1][0] + ' ' + bot + ' L' + valid[0][0] + ' ' + bot + 'z"/><path class="line" d="' + d + '"/>';
    var lp = valid[valid.length - 1];
    g += '<circle class="dot" cx="' + lp[0] + '" cy="' + lp[1] + '" r="6"/><text x="' + lp[0] + '" y="' + (lp[1] - 12) + '" text-anchor="end" style="fill:var(--ink);font-size:13px">' + Math.round(lp[2] * 100) + ' %</text>';
  }
  return g + '<text x="' + x0 + '" y="' + (H - 6) + '" text-anchor="start">il y a 8 sem.</text><text x="' + x1 + '" y="' + (H - 6) + '" text-anchor="end">cette sem.</text></svg>';
}
function displayControls() {
  var md = pref('mode', 'auto');
  var seg = '<div class="seg" style="margin-top:6px">' + [['auto', 'Auto'], ['light', 'Clair'], ['dark', 'Sombre']].map(function (x) { return '<button data-pref="mode" data-v="' + x[0] + '" aria-pressed="' + (md === x[0]) + '">' + x[1] + '</button>'; }).join('') + '</div>';
  return '<div class="pcard" style="margin-top:14px"><h2>Affichage</h2><p class="muted" style="font-size:12.5px">Thème<br>' + seg + '</p></div>';
}

/* ---------- application installable, notifications ---------- */
var installPrompt = null;
if ('serviceWorker' in navigator) { window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () { /* hors HTTPS ou refusé : l'appli marche quand même */ }); }); }
window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); installPrompt = e; if (window.onInstallReady) { window.onInstallReady(); } });
window.addEventListener('appinstalled', function () { installPrompt = null; if (window.onInstallReady) { window.onInstallReady(); } });
function isStandalone() { return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true; }
function isIOS() { return /iphone|ipad|ipod/i.test(navigator.userAgent); }
function notifSupported() { return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window; }
var Notif = { info: null, busy: false };
function loadNotif() { return api('GET', 'reminder').then(function (i) { Notif.info = i; }).catch(function () { /* hors-ligne */ }); }
function urlB64(s) { var p = '='.repeat((4 - s.length % 4) % 4), b = (s + p).replace(/-/g, '+').replace(/_/g, '/'), r = atob(b), o = new Uint8Array(r.length); for (var i = 0; i < r.length; i++) { o[i] = r.charCodeAt(i); } return o; }
function enablePush() {
  return Notification.requestPermission().then(function (p) {
    if (p !== 'granted') { throw new Error('Notifications refusées : autorise-les dans les réglages du navigateur.'); }
    return navigator.serviceWorker.ready;
  }).then(function (reg) {
    return api('GET', 'push/key').then(function (k) {
      return reg.pushManager.getSubscription().then(function (sub) { return sub || reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64(k.key) }); });
    });
  }).then(function (sub) { return api('POST', 'push/subscribe', { subscription: sub.toJSON() }); })
    .then(function () { return api('PUT', 'reminder', { remind: true }); }).then(function (i) { Notif.info = i; });
}
function disablePush() {
  return navigator.serviceWorker.ready.then(function (reg) { return reg.pushManager.getSubscription(); }).then(function (sub) {
    return sub ? api('POST', 'push/unsubscribe', { endpoint: sub.endpoint }).then(function () { return sub.unsubscribe(); }) : null;
  }).then(function () { return api('PUT', 'reminder', { remind: false }); }).then(function (i) { Notif.info = i; });
}
/** réagit aux boutons data-act="notif-…" ; renvoie une promesse, ou null si l'action n'est pas la sienne */
function handleNotif(act, el) {
  if (act === 'notif-install') { if (!installPrompt) { return Promise.resolve(); } installPrompt.prompt(); return installPrompt.userChoice.then(function () { installPrompt = null; }); }
  if (act === 'notif-toggle') { return Notif.info && Notif.info.remind ? disablePush() : enablePush(); }
  if (act === 'notif-test') { return api('POST', 'push/test', {}); }
  if (act === 'notif-time') { return api('PUT', 'reminder', { remindAt: el.value }).then(function (i) { Notif.info = i; }); }
  return null;
}
/** lit un fichier CSV choisi et le met dans la zone de texte visée (data-csv = sélecteur) */
function readCsvInto(input, say) {
  var f = input.files && input.files[0]; if (!f) { return; }
  if (f.size > 400000) { say('Fichier trop gros (400 Ko maximum).'); return; }
  var r = new FileReader();
  r.onload = function () {
    var txt = String(r.result).replace(/^\ufeff/, ''), ta = document.querySelector(input.dataset.csv);
    if (!ta) { return; }
    ta.value = txt;
    var n = txt.split(/\r?\n/).filter(function (l) { return /[=\t;]/.test(l); }).length;
    say(n + ' mot' + (n > 1 ? 's' : '') + ' trouvé' + (n > 1 ? 's' : '') + ' : vérifie la liste puis valide.');
  };
  r.onerror = function () { say('Lecture du fichier impossible.'); };
  r.readAsText(f, 'utf-8');
}
function notifCard(who) {
  var i = Notif.info, h = '<div class="pcard" style="margin-top:14px"><h2>Application et notifications</h2>';
  if (!isStandalone() && installPrompt) { h += '<p class="muted" style="font-size:12.5px;margin-bottom:8px">Installe Lexiquest sur l’écran d’accueil : elle s’ouvre comme une application et marche sans réseau.</p><button class="btn sm wide" data-act="notif-install" style="margin-bottom:12px">Installer l’application</button>'; }
  else if (!isStandalone() && isIOS()) { h += '<p class="muted" style="font-size:12.5px;margin-bottom:8px">Sur iPhone : touche Partager puis « Sur l’écran d’accueil ». Les notifications ne marchent qu’après cette installation.</p>'; }
  if (!notifSupported() || (isIOS() && !isStandalone())) { return h + (notifSupported() ? '' : '<p class="muted" style="font-size:12.5px">Les notifications ne sont pas disponibles sur ce navigateur.</p>') + '</div>'; }
  var on = !!(i && i.remind), what = who === 'parent' ? 'Prévenez-moi quand mon enfant n’a pas joué depuis 2 jours' : 'Rappelle-moi de jouer (seulement si je n’ai pas encore joué ce jour-là)';
  h += '<div class="row"><div>Rappel quotidien<small>' + what + '</small></div><button class="switch" role="switch" aria-checked="' + on + '" data-act="notif-toggle" aria-label="Rappel quotidien"></button></div>';
  if (on) {
    h += '<div class="row"><div>Heure<small>' + (i.devices ? i.devices + ' appareil' + (i.devices > 1 ? 's' : '') + ' abonné' + (i.devices > 1 ? 's' : '') : 'aucun appareil abonné') + '</small></div><input type="time" class="txt" id="remindAt" value="' + esc(i.remindAt) + '" data-act="notif-time" style="width:auto"></div>'
      + '<button class="btn sm alt" style="margin-top:8px" data-act="notif-test">Envoyer une notification de test</button>';
  }
  return h + '</div>';
}
