'use strict';
/* Stockage local : séances jouées hors-ligne en attente d'envoi, dernier état connu, identifiants de séance. */
var Offline = (function () {
  var KQ = 'lq.queue', KC = 'lq.cache';
  function read(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v === null || v === undefined ? d : v; } catch (e) { return d; } }
  function write(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  function uuid() {
    if (window.crypto && crypto.randomUUID) { return crypto.randomUUID(); }
    return 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2, 12) + Math.random().toString(36).slice(2, 8);
  }
  return {
    uuid: uuid,
    queue: function (userId) { return read(KQ, []).filter(function (i) { return i.userId === userId; }); },
    add: function (item) { var q = read(KQ, []); q.push(item); return write(KQ, q); },
    remove: function (clientId) { write(KQ, read(KQ, []).filter(function (i) { return i.clientId !== clientId; })); },
    saveCache: function (userId, st, stats) { write(KC, { userId: userId, st: st, stats: stats, at: Date.now() }); },
    loadCache: function () { return read(KC, null); },
    clearCache: function () { try { localStorage.removeItem(KC); } catch (e) { /* rien */ } },
  };
}());
