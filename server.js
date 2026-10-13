'use strict';
const path = require('node:path');
const express = require('express');
const session = require('express-session');
const clock = require('./lib/clock');
const { open } = require('./lib/db');
const SqliteStore = require('./lib/session-store');
const { HttpError } = require('./lib/users');

const THIRTY_DAYS = 30 * 864e5;

function createApp(db) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.locals.db = db;

  const secret = process.env.SESSION_SECRET || (process.env.NODE_ENV === 'production' ? null : 'dev-secret-change-me');
  if (!secret) { throw new Error('SESSION_SECRET est obligatoire en production.'); }
  const store = new SqliteStore(db), cache = new Map();
  /* le cookie vit sous le chemin où l'application est montée (/lexiquest derrière la passerelle) */
  app.use((req, res, next) => {
    const base = req.baseUrl || '/';
    if (!cache.has(base)) {
      cache.set(base, session({
        name: 'lexiquest.sid', secret, store, resave: false, saveUninitialized: false, rolling: true,
        cookie: { path: base, httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' ? 'auto' : false, maxAge: THIRTY_DAYS },
      }));
    }
    cache.get(base)(req, res, next);
  });

  app.use((req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin', 'X-Frame-Options': 'DENY',
      'Content-Security-Policy': "default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'",
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

  app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'], maxAge: 0 }));

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err instanceof HttpError) { return res.status(err.status).json({ error: err.message }); }
    if (err && err.type === 'entity.parse.failed') { return res.status(400).json({ error: 'JSON invalide.' }); }
    console.error(err);
    res.status(500).json({ error: 'Erreur interne.' });
  });
  return app;
}

const app = createApp(open());
app.createApp = createApp;
module.exports = app;

if (require.main === module) {
  const port = Number(process.env.PORT) || 3000;
  app.listen(port, () => console.log(`Lexiquest sur http://localhost:${port} (fuseau ${process.env.TZ}, ${clock.now().toISOString()})`));
}
