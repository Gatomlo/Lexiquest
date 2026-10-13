'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const express = require('express');
const clock = require('./lib/clock');
const { open } = require('./lib/db');
const { HttpError } = require('./lib/users');
const Kv = require('./lib/kv');

const PUBLIC = path.join(__dirname, 'public');

/** empreinte des fichiers publics (hors sw.js) : change à chaque mise à jour du site */
function swVersion(dir) {
  const h = crypto.createHash('sha1');
  const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const f = path.join(d, e.name);
    if (e.isDirectory()) { walk(f); } else if (e.name !== 'sw.js') { const st = fs.statSync(f); h.update(path.relative(dir, f) + st.size + st.mtimeMs); }
  } };
  walk(dir);
  return h.digest('hex').slice(0, 12);
}
const swSource = (dir) => fs.readFileSync(path.join(dir, 'sw.js'), 'utf8');

function createApp(db) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.locals.db = db;

  const secret = process.env.SESSION_SECRET || Kv.secret(db, 'sessionSecret'); // tiré au hasard à la première utilisation, gardé dans la base
  /* sessions : cookie signé, limité au chemin de montage (/lexiquest derrière la passerelle) */
  app.use(require('./lib/session').sessions(db, secret));

  app.use((req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin', 'X-Frame-Options': 'DENY',
      'Content-Security-Policy': "default-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'",
    });
    next();
  });
  app.use(express.json({ limit: '256kb' }));
  /* une requête qui modifie des données doit être du JSON : bloque les formulaires d'un autre site */
  app.use('/api', (req, res, next) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && !req.is('application/json')) { return next(new HttpError(415, 'JSON attendu.')); }
    next();
  });

  app.use('/api', require('./routes/api')(db));
  app.use('/api/admin', require('./routes/admin')(db));
  app.use('/api', (req, res, next) => next(new HttpError(404, 'Route inconnue.')));

  /* sans barre finale, les chemins relatifs du navigateur viendraient de la racine du site (/lexiquest → /lexiquest/) */
  app.get('/', (req, res, next) => {
    const q = req.originalUrl.indexOf('?'), p = q < 0 ? req.originalUrl : req.originalUrl.slice(0, q);
    if (p.endsWith('/')) { return next(); }
    res.redirect(301, p + '/' + (q < 0 ? '' : req.originalUrl.slice(q)));
  });
  /* le service worker porte une version : tout changement du site renouvelle le cache des appareils */
  app.get('/sw.js', (req, res) => {
    res.set({ 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'no-cache', 'Service-Worker-Allowed': './' });
    res.send(swSource(PUBLIC).replaceAll('__VERSION__', swVersion(PUBLIC)));
  });
  app.use(express.static(PUBLIC, { extensions: ['html'], maxAge: 0 }));

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err instanceof HttpError) { return res.status(err.status).json({ error: err.message }); }
    if (err && err.type === 'entity.parse.failed') { return res.status(400).json({ error: 'JSON invalide.' }); }
    console.error(err);
    res.status(500).json({ error: 'Erreur interne.' });
  });
  return app;
}

const db = open();
/* comptes créés avec l'ancien format de mot de passe (bcrypt) : illisibles, à réinitialiser */
const legacy = db.prepare("SELECT username FROM users WHERE hash NOT LIKE 'scrypt$%'").all();
if (legacy.length) { console.warn(`Lexiquest : ${legacy.length} compte(s) à l'ancien format de mot de passe (${legacy.map((u) => u.username).join(', ')}) : lance « node scripts/reset-password.js <identifiant> <nouveau mot de passe> » dans apps/lexiquest.`); }
const app = createApp(db);
app.createApp = createApp;
module.exports = app;
/* les rappels tournent dans le processus, seul ou monté par la passerelle (pas pendant les tests : base en mémoire) */
if (process.env.LEXIQUEST_DB !== ':memory:') { require('./lib/reminders').start(db); }

