'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  display TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('student','parent')),
  hash TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  parent_id INTEGER REFERENCES users(id),
  pet_seed INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS lists (
  id INTEGER PRIMARY KEY,
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lang TEXT NOT NULL CHECK (lang IN ('nl','en')),
  name TEXT NOT NULL,
  sub TEXT NOT NULL DEFAULT '',
  assigned_by INTEGER REFERENCES users(id),
  version INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS words (
  id INTEGER PRIMARY KEY,
  list_id INTEGER NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  term TEXT NOT NULL,
  fr TEXT NOT NULL,
  position INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS words_list ON words(list_id);
CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lang TEXT NOT NULL,
  scope TEXT NOT NULL,
  game TEXT NOT NULL,
  dir TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  list_id INTEGER,
  queue TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  active_sec INTEGER NOT NULL DEFAULT 0,
  n_words INTEGER NOT NULL DEFAULT 0,
  first_ok INTEGER NOT NULL DEFAULT 0,
  win INTEGER,
  done INTEGER NOT NULL DEFAULT 0,
  gems INTEGER NOT NULL DEFAULT 0,
  client_id TEXT
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id, done, started_at);
CREATE TABLE IF NOT EXISTS answers (
  id INTEGER PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  word_id INTEGER,
  term TEXT NOT NULL,
  fr TEXT NOT NULL,
  lang TEXT NOT NULL,
  qtype TEXT NOT NULL,
  attempt INTEGER NOT NULL,
  given TEXT NOT NULL DEFAULT '',
  ok INTEGER NOT NULL,
  hinted INTEGER NOT NULL DEFAULT 0,
  kind TEXT,
  ms INTEGER NOT NULL DEFAULT 0,
  at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS answers_session ON answers(session_id);
CREATE TABLE IF NOT EXISTS word_stats (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  word_id INTEGER NOT NULL,
  streak INTEGER NOT NULL DEFAULT 0,
  attempts INTEGER NOT NULL DEFAULT 0,
  fails INTEGER NOT NULL DEFAULT 0,
  last_at INTEGER,
  PRIMARY KEY (user_id, word_id)
);
CREATE TABLE IF NOT EXISTS gem_events (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  delta INTEGER NOT NULL,
  reason TEXT NOT NULL,
  session_id INTEGER,
  at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS gem_user ON gem_events(user_id);
CREATE TABLE IF NOT EXISTS user_pets (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  species TEXT NOT NULL,
  food REAL NOT NULL,
  care REAL NOT NULL,
  joy REAL NOT NULL,
  anchor_hour INTEGER NOT NULL,
  active INTEGER NOT NULL DEFAULT 0,
  adopted_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, species)
);
CREATE TABLE IF NOT EXISTS pet_events (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  species TEXT NOT NULL,
  hour INTEGER NOT NULL,
  type TEXT NOT NULL,
  ref TEXT,
  gauge TEXT,
  delta REAL
);
CREATE INDEX IF NOT EXISTS pet_events_user ON pet_events(user_id, hour);
CREATE TABLE IF NOT EXISTS user_items (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL,
  cat TEXT NOT NULL,
  bought_at INTEGER NOT NULL,
  equipped INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, item_id)
);
CREATE TABLE IF NOT EXISTS vouchers (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tier INTEGER NOT NULL,
  streak_start INTEGER NOT NULL,
  claimed_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, tier, streak_start)
);
CREATE TABLE IF NOT EXISTS settings (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  PRIMARY KEY (user_id, key)
);
CREATE TABLE IF NOT EXISTS invites (
  id INTEGER PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  parent_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  display TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at INTEGER
);
CREATE TABLE IF NOT EXISTS push_subs (
  endpoint TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS kv (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS http_sessions (
  sid TEXT PRIMARY KEY,
  sess TEXT NOT NULL,
  expires INTEGER NOT NULL
);
`;

/** bases créées avant une évolution du schéma */
function migrate(db) {
  const cols = db.prepare('PRAGMA table_info(sessions)').all().map((c) => c.name);
  if (!cols.includes('client_id')) { db.exec('ALTER TABLE sessions ADD COLUMN client_id TEXT'); }
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS sessions_client ON sessions(user_id, client_id) WHERE client_id IS NOT NULL');
}

function open(file) {
  file = file || process.env.LEXIQUEST_DB || path.join(__dirname, '..', 'data', 'lexiquest.db');
  if (file !== ':memory:') { fs.mkdirSync(path.dirname(file), { recursive: true }); }
  const db = new DatabaseSync(file);
  db.exec('PRAGMA foreign_keys = ON');
  if (file !== ':memory:') { db.exec('PRAGMA journal_mode = WAL'); }
  db.exec(SCHEMA);
  migrate(db);
  return db;
}

/** exécute fn dans une transaction ; rollback si elle lève */
function tx(db, fn) {
  if (db.inTx) { return fn(); } // transaction déjà ouverte : on s'y joint
  db.exec('BEGIN IMMEDIATE');
  db.inTx = true;
  try { const r = fn(); db.exec('COMMIT'); return r; }
  catch (e) { try { db.exec('ROLLBACK'); } catch (_) { /* déjà annulée */ } throw e; }
  finally { db.inTx = false; }
}

module.exports = { open, tx };
