'use strict';
/* Auto-réparation des dépendances de l'outil au démarrage (même logique que la passerelle).
   Une installation npm interrompue par l'hébergeur (délai, quota) peut laisser un package.json à moitié écrit dans
   node_modules (ex. celui d'express) : le montage échoue alors avec ERR_INVALID_PACKAGE_CONFIG, et le « npm install »
   de la passerelle saute l'outil car son node_modules paraît à jour. On vérifie ici, avant de charger express. */
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

function findBroken(rootDir, required) {
  const nm = path.join(rootDir, 'node_modules'), broken = [];
  const check = (dir) => { try { JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')); } catch (e) { broken.push(dir); } };
  if (!fs.existsSync(nm)) { return required.map((n) => path.join(nm, n)); }
  for (const name of fs.readdirSync(nm)) {
    if (name.startsWith('.')) { continue; }
    const dir = path.join(nm, name);
    let isDir = false;
    try { isDir = fs.statSync(dir).isDirectory(); } catch (e) { /* lien cassé */ }
    if (!isDir) { continue; }
    if (name.startsWith('@')) { for (const sub of fs.readdirSync(dir)) { check(path.join(dir, sub)); } } else { check(dir); }
  }
  for (const n of required) { const dir = path.join(nm, n); if (!fs.existsSync(dir) && !broken.includes(dir)) { broken.push(dir); } }
  return broken;
}

/** supprime les paquets abîmés ou manquants et réinstalle ; `install` est remplaçable pour les tests */
function repairIfNeeded(rootDir, { install, log = console } = {}) {
  const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
  const required = Object.keys(pkg.dependencies || {});
  const broken = findBroken(rootDir, required);
  if (!broken.length) { return []; }
  const names = broken.map((d) => path.relative(path.join(rootDir, 'node_modules'), d));
  log.warn(`Lexiquest : dépendances abîmées ou manquantes (${names.slice(0, 5).join(', ')}${names.length > 5 ? '…' : ''}) : réinstallation...`);
  for (const dir of broken) { fs.rmSync(dir, { recursive: true, force: true }); }
  (install || (() => execSync('npm install --omit=dev --ignore-scripts --no-audit --no-fund', { cwd: rootDir, stdio: 'inherit' })))();
  const still = findBroken(rootDir, required);
  if (still.length) { throw new Error('Réparation impossible : ' + still.map((d) => path.basename(d)).join(', ')); }
  log.log('Lexiquest : dépendances réparées.');
  return names;
}
module.exports = { findBroken, repairIfNeeded };
