#!/usr/bin/env node
'use strict';
/* Crée un compte. Usage :
     node scripts/create-user.js parent <identifiant> "<nom affiché>" <mot de passe>
     node scripts/create-user.js student <identifiant> "<nom affiché>" <mot de passe> <identifiant du parent>
   Le mot de passe peut aussi venir de la variable LEXIQUEST_PASSWORD (évite l'historique du terminal). */
const { open } = require('../lib/db');
const { createUser } = require('../lib/users');

const [role, username, display, pwArg, parentName] = process.argv.slice(2);
const password = process.env.LEXIQUEST_PASSWORD || pwArg;
if (!role || !username || !display || !password) { console.error('Usage : voir l’en-tête de scripts/create-user.js'); process.exit(1); }
const db = open();
let parentId = null;
if (role === 'student') {
  const p = parentName && db.prepare("SELECT id FROM users WHERE username = ? AND role = 'parent'").get(parentName);
  if (!p) { console.error('Parent introuvable : crée d’abord le compte parent.'); process.exit(1); }
  parentId = p.id;
}
try { console.log('Compte créé, id', createUser(db, { username, display, role, password, parentId })); }
catch (e) { console.error(e.message); process.exit(1); }
