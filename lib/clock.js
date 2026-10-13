'use strict';
/* Horloge du jeu. Fuseau fixé (le serveur peut être en UTC) ; décalage réservé aux tests. */
if (!process.env.TZ) { process.env.TZ = process.env.LEXIQUEST_TZ || 'Europe/Brussels'; }

let offsetMs = 0;
const clock = {
  now() { return new Date(Date.now() + offsetMs); },
  nowMs() { return Date.now() + offsetMs; },
  advance(ms) { offsetMs += ms; },
  reset() { offsetMs = 0; },
  /** numéro de l'heure depuis l'epoch (UTC) */
  hourOf(d) { return Math.floor((d || this.now()).getTime() / 36e5); },
  hourNow() { return this.hourOf(this.now()); },
  /** numéro de jour local depuis l'epoch (jour calendaire dans le fuseau) */
  dayIdx(d) {
    d = d || this.now();
    return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5);
  },
  /** premier jour (lundi) de la semaine contenant ce jour */
  weekStart(idx) { return idx - ((idx + 3) % 7); },
  /** début local (ms) du jour d'index idx */
  dayStartMs(idx) { const u = new Date(idx * 864e5); return new Date(u.getUTCFullYear(), u.getUTCMonth(), u.getUTCDate()).getTime(); },
};
module.exports = clock;
