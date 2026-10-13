'use strict';
const session = require('express-session');

/** magasin de sessions HTTP dans SQLite : les connexions survivent aux redémarrages */
class SqliteStore extends session.Store {
  constructor(db) { super(); this.db = db; this.lastPurge = 0; }
  get(sid, cb) {
    try {
      const r = this.db.prepare('SELECT sess, expires FROM http_sessions WHERE sid = ?').get(sid);
      if (!r || r.expires < Date.now()) { return cb(null, null); }
      cb(null, JSON.parse(r.sess));
    } catch (e) { cb(e); }
  }
  set(sid, sess, cb) {
    try {
      const exp = sess.cookie && sess.cookie.expires ? new Date(sess.cookie.expires).getTime() : Date.now() + 864e5;
      this.db.prepare('INSERT INTO http_sessions (sid, sess, expires) VALUES (?,?,?) ON CONFLICT(sid) DO UPDATE SET sess = excluded.sess, expires = excluded.expires')
        .run(sid, JSON.stringify(sess), exp);
      this.purge();
      cb && cb(null);
    } catch (e) { cb && cb(e); }
  }
  destroy(sid, cb) { try { this.db.prepare('DELETE FROM http_sessions WHERE sid = ?').run(sid); cb && cb(null); } catch (e) { cb && cb(e); } }
  touch(sid, sess, cb) { this.set(sid, sess, cb); }
  purge() {
    if (Date.now() - this.lastPurge < 36e5) { return; }
    this.lastPurge = Date.now();
    this.db.prepare('DELETE FROM http_sessions WHERE expires < ?').run(Date.now());
  }
}
module.exports = SqliteStore;
