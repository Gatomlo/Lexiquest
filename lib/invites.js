'use strict';
/* Invitation d'un élève : le parent envoie un lien à usage unique ; l'élève y choisit son identifiant et son mot de passe. */
const crypto = require('node:crypto');
const clock = require('./clock');
const { HttpError, createUser } = require('./users');
const { tx } = require('./db');

const VALID_DAYS = 7;
const hashOf = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');

function create(db, parentId, display) {
  display = String(display || '').trim().slice(0, 60);
  if (!display) { throw new HttpError(400, 'Indique le prénom de l’élève.'); }
  const token = crypto.randomBytes(24).toString('base64url'), now = clock.nowMs();
  const id = Number(db.prepare('INSERT INTO invites (token_hash, parent_id, display, created_at, expires_at) VALUES (?,?,?,?,?)')
    .run(hashOf(token), parentId, display, now, now + VALID_DAYS * 864e5).lastInsertRowid);
  return { id, token, display, expiresAt: now + VALID_DAYS * 864e5 };
}

/** invitation encore utilisable ? (sinon null) */
function find(db, token) {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(String(token))) { return null; }
  const r = db.prepare('SELECT * FROM invites WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?').get(hashOf(token), clock.nowMs());
  return r || null;
}

function accept(db, token, { username, password }) {
  return tx(db, () => {
    const inv = find(db, token);
    if (!inv) { throw new HttpError(410, 'Ce lien n’est plus valable : demande-en un nouveau à ton parent.'); }
    const id = createUser(db, { username, display: inv.display, role: 'student', password, parentId: inv.parent_id });
    db.prepare('UPDATE invites SET used_at = ? WHERE id = ?').run(clock.nowMs(), inv.id);
    return { id, name: inv.display };
  });
}

const pending = (db, parentId) => db.prepare('SELECT id, display, created_at, expires_at FROM invites WHERE parent_id = ? AND used_at IS NULL AND expires_at > ? ORDER BY id DESC')
  .all(parentId, clock.nowMs()).map((r) => ({ id: r.id, name: r.display, createdAt: r.created_at, expiresAt: r.expires_at }));
function revoke(db, parentId, id) {
  if (!db.prepare('DELETE FROM invites WHERE id = ? AND parent_id = ? AND used_at IS NULL').run(Number(id), parentId).changes) { throw new HttpError(404, 'Invitation introuvable.'); }
}

module.exports = { create, find, accept, pending, revoke };
