/* Correction des réponses : partagée par le navigateur et le serveur. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) { module.exports = factory(); }
  else { root.Judge = factory(); }
}(typeof self !== 'undefined' ? self : this, function () {
  function stripAcc(x) { return x.normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function norm(x, set) {
    x = String(x).toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, ' ').trim();
    if (set.accents) { x = stripAcc(x); }
    if (!set.articles) { x = x.replace(/^(de|het|een|the|a|an|to|le|la|les|l'|un|une)\s+/, ''); }
    return x;
  }
  function lev(a, b) {
    const m = a.length, n = b.length, d = [];
    for (let i = 0; i <= m; i++) { d[i] = [i]; }
    for (let j = 1; j <= n; j++) { d[0][j] = j; }
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
    }
    return d[m][n];
  }
  /** réponse attendue selon le sens : toFr = traduction française, sinon le terme */
  function expected(word, dir) { return dir === 'toFr' ? word.fr : word.term; }
  /** vrai si la réponse est juste (QCM : égalité stricte ; écriture : tolérances du parent) */
  function isCorrect(qtype, given, exp, set) {
    if (qtype === 'duel') { return given === exp; }
    if (qtype === 'scramble') { return String(given).replace(/\s/g, '').toLowerCase() === exp.replace(/\s/g, '').toLowerCase(); }
    return norm(given, set) === norm(exp, set);
  }
  /** « presque » à 2 lettres ou moins du mot attendu, sinon « oubli » */
  function errorKind(given, exp, set) {
    return given && lev(norm(given, set), norm(exp, set)) <= 2 ? 'presque' : 'oubli';
  }
  return { norm, lev, expected, isCorrect, errorKind };
}));
