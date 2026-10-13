'use strict';
/* Mots de passe : scrypt (intégré à Node), format « scrypt$sel$empreinte » en hexadécimal. */
const crypto = require('node:crypto');

const KEYLEN = 32;
const hash = (password) => {
  const salt = crypto.randomBytes(16);
  return 'scrypt$' + salt.toString('hex') + '$' + crypto.scryptSync(String(password), salt, KEYLEN).toString('hex');
};
const DUMMY = hash('mot de passe factice');
/** compare en temps constant ; fait le même travail si le compte n'existe pas (stored vide) */
function verify(password, stored) {
  const parts = String(stored || DUMMY).split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') { return false; }
  const expected = Buffer.from(parts[2], 'hex');
  const got = crypto.scryptSync(String(password), Buffer.from(parts[1], 'hex'), KEYLEN);
  return expected.length === got.length && crypto.timingSafeEqual(expected, got) && !!stored;
}
module.exports = { hash, verify };
