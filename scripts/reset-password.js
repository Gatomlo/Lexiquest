#!/usr/bin/env node
'use strict';
/* Mot de passe oublié (surtout celui du parent) : à lancer sur le serveur, dans le dossier de l'application.
     node scripts/reset-password.js <identifiant> <nouveau mot de passe> */
const { open } = require('../lib/db');
const { setPassword } = require('../lib/users');

const [username, pw] = process.argv.slice(2);
if (!username || !pw) { console.error('Usage : node scripts/reset-password.js <identifiant> <nouveau mot de passe>'); process.exit(1); }
const db = open();
const u = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
if (!u) { console.error('Identifiant inconnu.'); process.exit(1); }
try { setPassword(db, u.id, pw); console.log('Mot de passe changé.'); } catch (e) { console.error(e.message); process.exit(1); }
