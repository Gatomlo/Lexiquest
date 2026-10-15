'use strict';
/* Règles du jeu réglables par le parent, élève par élève (valeurs d'origine : lib/config.js). */
const C = require('./config');

const LIMITS = {
  rotMax: [1, 10], rotNeed: [1, 4], penCare: [0, 100], penJoy: [0, 100],
  gemCards: [0, 9], gemDuel: [0, 9], gemScramble: [0, 9], gemForge: [0, 9], gemDir: [0, 3],
};
const GEM_KEYS = { cards: 'gemCards', duel: 'gemDuel', scramble: 'gemScramble', forge: 'gemForge' };

/** règles en vigueur d'après les réglages de l'élève */
function fromSettings(set) {
  return {
    rot: { max: set.rotMax, need: set.rotNeed },
    pen: { care: set.penCare, joy: set.penJoy },
    gems: { cards: set.gemCards, duel: set.gemDuel, scramble: set.gemScramble, forge: set.gemForge, dir: set.gemDir },
  };
}
const DEFAULTS = fromSettings(C.DEFAULT_SETTINGS);

module.exports = { LIMITS, GEM_KEYS, fromSettings, DEFAULTS };
