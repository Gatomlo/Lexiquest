'use strict';
/* Web Push sans dépendance : clés VAPID (RFC 8292) et chiffrement du message aes128gcm (RFC 8188 / 8291), avec node:crypto. */
const crypto = require('node:crypto');

const b64u = (buf) => Buffer.from(buf).toString('base64url');
const unb64u = (s) => Buffer.from(String(s), 'base64url');

/** paire de clés VAPID : { publicKey: point non compressé (65 octets), privateKey: d (32 octets) }, en base64url */
function generateKeys() {
  const ecdh = crypto.createECDH('prime256v1');
  ecdh.generateKeys();
  return { publicKey: b64u(ecdh.getPublicKey()), privateKey: b64u(ecdh.getPrivateKey()) };
}

function vapidHeader(endpoint, keys, subject) {
  const pub = unb64u(keys.publicKey);
  const key = crypto.createPrivateKey({ key: { kty: 'EC', crv: 'P-256', d: keys.privateKey, x: b64u(pub.subarray(1, 33)), y: b64u(pub.subarray(33, 65)) }, format: 'jwk' });
  const head = b64u(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const body = b64u(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject }));
  const sig = crypto.sign('sha256', Buffer.from(head + '.' + body), { key, dsaEncoding: 'ieee-p1363' });
  return `vapid t=${head}.${body}.${b64u(sig)}, k=${keys.publicKey}`;
}

/** chiffre la charge pour un abonnement { p256dh, auth } ; renvoie le corps de la requête */
function encrypt(payload, p256dh, auth, fixed = {}) {  // `fixed` (clé éphémère, sel) : seulement pour le vecteur de test du RFC
  const uaPublic = unb64u(p256dh), authSecret = unb64u(auth);
  const as = crypto.createECDH('prime256v1');
  if (fixed.privateKey) { as.setPrivateKey(unb64u(fixed.privateKey)); } else { as.generateKeys(); }
  const asPublic = as.getPublicKey(), shared = as.computeSecret(uaPublic);
  const ikm = Buffer.from(crypto.hkdfSync('sha256', shared, authSecret, Buffer.concat([Buffer.from('WebPush: info\0'), uaPublic, asPublic]), 32));
  const salt = fixed.salt ? unb64u(fixed.salt) : crypto.randomBytes(16);
  const cek = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16));
  const nonce = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12));
  const cipher = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  const data = Buffer.concat([cipher.update(Buffer.concat([Buffer.from(payload), Buffer.from([2])])), cipher.final(), cipher.getAuthTag()]);
  const head = Buffer.alloc(21); salt.copy(head, 0); head.writeUInt32BE(4096, 16); head[20] = asPublic.length;
  return Buffer.concat([head, asPublic, data]);
}

/** envoie une notification ; en cas de refus, lève une erreur portant statusCode (404 et 410 : appareil disparu) */
async function send(sub, payload, { keys, subject, ttl = 6 * 3600 }) {
  const res = await fetch(sub.endpoint, {
    method: 'POST',
    headers: { 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', TTL: String(ttl), Urgency: 'normal', Authorization: vapidHeader(sub.endpoint, keys, subject) },
    body: encrypt(JSON.stringify(payload), sub.keys.p256dh, sub.keys.auth),
    signal: AbortSignal.timeout(15000),
  });
  if (res.status < 200 || res.status > 299) {
    const e = new Error(`Service de notification : HTTP ${res.status}`); e.statusCode = res.status; throw e;
  }
  return res.status;
}

module.exports = { generateKeys, vapidHeader, encrypt, send };
