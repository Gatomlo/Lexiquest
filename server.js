'use strict';
/* Point d'entrée : exporte l'app Express (montage par node-gateway) et n'écoute que s'il est lancé seul. */

// avant de charger express : répare un node_modules abîmé par une installation interrompue
try { require('./lib/repair-modules').repairIfNeeded(__dirname); } catch (e) { console.error(e.message); }

// puis charge l'application, avec de nouveaux essais si le volume renvoie un package.json incomplet
const app = require('./lib/retry-load').loadWithRetry(() => require('./app'));
module.exports = app;

if (require.main === module) {
  const port = Number(process.env.PORT) || 3000;
  app.listen(port, () => console.log(`Lexiquest sur http://localhost:${port} (fuseau ${process.env.TZ}, ${require('./lib/clock').now().toISOString()})`));
}
