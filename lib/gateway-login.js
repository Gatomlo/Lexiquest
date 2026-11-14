'use strict';
/* Connexion centralisee de node-gateway : si la passerelle fournit req.gateway (droit sur cet outil), ouvre une
   session locale pour le compte PARENT de meme identifiant. Jamais un compte eleve, aucun compte cree.
   Cette session « passerelle » n'est valable que tant que la passerelle se porte garante du meme compte : des
   que l'utilisateur se deconnecte ou perd son droit la-bas, elle tombe (controle a chaque requete).
   Une session locale normale (connexion avec mot de passe) n'est jamais touchee. Hors passerelle : sans effet. */
const bridge = require('./gateway-bridge');

module.exports = function gatewayLogin(db) {
  const parentFor = (id) => bridge.matchLocal(id, db.prepare("SELECT id, username FROM users WHERE role = 'parent' AND active = 1").all(), { email: null, login: 'username' });

  return function gatewayLoginMiddleware(req, res, next) {
    const s = req.session;
    if (!s) { return next(); }
    const id = bridge.identity(req);
    if (s.bridge) {
      // « aperçu comme l'élève » : le parent a mis son identifiant dans viewAs pendant que userId est celui de l'élève
      const parentId = s.viewAs || s.userId;
      const p = id && parentFor(id);
      if (p && p.id === parentId) { return next(); }
      return s.destroy(() => next());
    }
    if (s.userId || !id) { return next(); }
    const p = parentFor(id);
    if (!p) { return next(); }
    s.regenerate((err) => {
      if (!err) { s.userId = p.id; }
      next();
    }, { bridge: true }); // le drapeau est pose des la creation : cookie de 2 h, pas de 30 jours
  };
};
