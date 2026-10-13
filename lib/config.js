'use strict';
/* Barème et catalogues du jeu. Source de vérité : docs/cahier-des-charges.md (§4 à §7). */

const GAMES = {
  cards:    { n: 'Chasse aux cartes', d: 'Retourne la carte, puis glisse-la : je savais ou à revoir.', ic: 'cards', q: 14, col: 'var(--sky)', g: 1, hard: 1 },
  duel:     { n: 'Duel des sages', d: 'Quatre réponses, une seule est la bonne. Enchaîne les combos !', ic: 'swords', q: 14, col: 'var(--coral)', g: 2, hard: 2 },
  scramble: { n: 'Lettres folles', d: 'Les lettres sont mélangées : remets-les dans l’ordre.', ic: 'shuffle', q: 9, col: 'var(--grass)', g: 3, hard: 3 },
  forge:    { n: 'La Forge', d: 'Écris le mot de mémoire, lettre après lettre.', ic: 'hammer', q: 9, col: 'var(--amber)', g: 4, hard: 4 },
  boss:     { n: 'Le Gardien', d: 'Trois cœurs pour le vaincre : QCM et écriture mêlés.', ic: 'crown', q: 12, col: 'var(--plum)', g: 4, hard: 5 },
};
const ORDER = ['cards', 'duel', 'scramble', 'forge', 'boss'];
const ROT = { max: 3, need: 2 };
const BOSS = { hp: 8, hearts: 3, queue: 14, penCare: 40, penJoy: 20, bonusGems: 20 };
const GEMS = { finWin: 5, finLose: 2, perfect: 10, daily: 10, comboBonus: 1, comboFrom: 3, hint: 1 };
const VOUCH = [{ d: 3, p: 15 }, { d: 7, p: 40 }, { d: 14, p: 100 }, { d: 30, p: 250 }];
const RES_PRICE = 150;
const LANGS = ['nl', 'en'];
const REALM = { nl: { s: 'Néerlandais', tag: 'NL' }, en: { s: 'Anglais', tag: 'EN' } };

/* jauges : baisse par heure ; la nuit (20 h – 8 h) tout est divisé par deux */
const RATE = { food: 1.2, care: 0.75, joy: 1.5 };
const LOW = 20;
const NIGHT = { from: 20, to: 8, f: 0.5 };
const GAUGES = ['care', 'food', 'joy'];
const STATE_N = ['Radieux', 'Content', 'Fatigué', 'Décrépit', 'À terre'];

const PETS = {
  phenix:  { n: 'Lexi', k: 'Phénix', price: 0 },
  dragon:  { n: 'Pyro', k: 'Dragonnet', price: 400 },
  licorne: { n: 'Étoile', k: 'Licorne', price: 700 },
  griffon: { n: 'Griff', k: 'Griffon', price: 1000 },
  kraken:  { n: 'Glouglou', k: 'Bébé kraken', price: 1500 },
  renard:  { n: 'Roussette', k: 'Renardeau', price: 1200 },
  hibou:   { n: 'Hulotte', k: 'Chouette', price: 1800 },
};

const ITEMS = [
  { id: 'pomme', n: 'Pomme dorée', cat: 'food', price: 20, gain: { food: 25 }, say: 'Croc croc, délicieux !' },
  { id: 'gateau', n: 'Gâteau au miel', cat: 'food', price: 36, gain: { food: 50 }, say: 'Miam ! Merci !' },
  { id: 'festin', n: 'Grand festin', cat: 'food', price: 70, gain: { food: 100, joy: 10 }, say: 'Quel festin !' },
  { id: 'potion', n: 'Potion de soin', cat: 'care', price: 40, gain: { care: 35 }, say: 'Je me sens beaucoup mieux.' },
  { id: 'bain', n: 'Bain moussant', cat: 'care', price: 30, gain: { care: 20, joy: 5 }, say: 'Me voilà tout propre !' },
  { id: 'balle', n: 'Balle magique', cat: 'play', price: 20, gain: { joy: 25 }, say: 'Youpi, on joue !' },
  { id: 'resur', n: 'Potion de résurrection', cat: 'care', price: RES_PRICE, set: { food: 50, care: 50, joy: 50 }, ko: true, say: 'Je suis de retour ! Merci de ne pas m’avoir abandonné.' },
];

/* achats durables : gardés pour toujours, un accessoire et un décor portés à la fois */
const DURABLE = [
  { id: 'fleur', n: 'Fleur des champs', cat: 'acc', price: 50 },
  { id: 'noeud', n: 'Nœud papillon', cat: 'acc', price: 60 },
  { id: 'collier', n: 'Collier de perles', cat: 'acc', price: 80 },
  { id: 'echarpe', n: 'Écharpe', cat: 'acc', price: 90 },
  { id: 'bonnet', n: 'Bonnet à pompon', cat: 'acc', price: 100 },
  { id: 'casquette', n: 'Casquette', cat: 'acc', price: 110 },
  { id: 'lunettes', n: 'Lunettes rondes', cat: 'acc', price: 120 },
  { id: 'soleil', n: 'Lunettes de soleil', cat: 'acc', price: 130 },
  { id: 'bandeau', n: 'Bandeau de pirate', cat: 'acc', price: 140 },
  { id: 'medaille', n: 'Médaille d’or', cat: 'acc', price: 160 },
  { id: 'chapeau', n: 'Chapeau de magicien', cat: 'acc', price: 180 },
  { id: 'aureole', n: 'Auréole', cat: 'acc', price: 250 },
  { id: 'couronne', n: 'Couronne dorée', cat: 'acc', price: 300 },
  { id: 'casque', n: 'Casque audio', cat: 'acc', price: 160 },
  { id: 'monocle', n: 'Monocle', cat: 'acc', price: 190 },
  { id: 'cape', n: 'Cape de héros', cat: 'acc', price: 220 },
  { id: 'prairie', n: 'Prairie fleurie', cat: 'decor', price: 100 },
  { id: 'nuages', n: 'Mer de nuages', cat: 'decor', price: 120 },
  { id: 'foret', n: 'Forêt enchantée', cat: 'decor', price: 150 },
  { id: 'desert', n: 'Désert doré', cat: 'decor', price: 160 },
  { id: 'montagne', n: 'Montagne enneigée', cat: 'decor', price: 180 },
  { id: 'automne', n: 'Verger d’automne', cat: 'decor', price: 200 },
  { id: 'plage', n: 'Plage', cat: 'decor', price: 220 },
  { id: 'ocean', n: 'Fond marin', cat: 'decor', price: 260 },
  { id: 'chateau', n: 'Château', cat: 'decor', price: 320 },
  { id: 'volcan', n: 'Volcan', cat: 'decor', price: 340 },
  { id: 'aurore', n: 'Aurore boréale', cat: 'decor', price: 400 },
  { id: 'etoiles', n: 'Ciel étoilé', cat: 'decor', price: 450 },
  { id: 'neige', n: 'Village sous la neige', cat: 'decor', price: 240 },
  { id: 'jungle', n: 'Jungle', cat: 'decor', price: 280 },
  { id: 'espace', n: 'Espace', cat: 'decor', price: 520 },
];

/* événements aléatoires : un tous les 24 à 72 h, sur une seule jauge */
const EVTS = {
  baies: { t: 'a trouvé des baies sauvages', k: 'food', v: 15 },
  ruche: { t: 'a déniché une ruche abandonnée pleine de miel', k: 'food', v: 20 },
  noisettes: { t: 'a partagé les noisettes d’un écureuil', k: 'food', v: 10 },
  pommes: { t: 'a ramassé les pommes tombées avec le vent', k: 'food', v: 15 },
  sieste: { t: 'a fait une grande sieste au soleil', k: 'food', v: 10 },
  orage: { t: 'n’a pas dormi à cause d’un orage', k: 'food', v: -15 },
  corbeau: { t: 's’est fait voler son goûter par un corbeau', k: 'food', v: -10 },
  papillon: { t: 'a couru après un papillon toute la matinée', k: 'food', v: -10 },
  cauchemar: { t: 'a fait un cauchemar', k: 'food', v: -10 },
  gelee: { t: 'a vu la gelée abîmer ses fruits', k: 'food', v: -15 },
  luciole: { t: 'a joué avec une luciole', k: 'joy', v: 15 },
  arcenciel: { t: 'a admiré un double arc-en-ciel', k: 'joy', v: 10 },
  lutin: { t: 'a reçu la visite d’un lutin farceur', k: 'joy', v: 20 },
  plume: { t: 'a trouvé une plume brillante', k: 'joy', v: 10 },
  etoile: { t: 'a vu une étoile filante', k: 'joy', v: 15 },
  pluie: { t: 's’est ennuyé toute une journée de pluie', k: 'joy', v: -15 },
  mare: { t: 'a perdu son jouet dans la mare', k: 'joy', v: -10 },
  troll: { t: 's’est fait moquer par un troll grincheux', k: 'joy', v: -15 },
  brouillard: { t: 'est resté coincé dans le brouillard', k: 'joy', v: -10 },
  cachecache: { t: 'a perdu à cache-cache contre un lapin', k: 'joy', v: -5 },
  source: { t: 's’est baigné dans une source magique', k: 'care', v: 10 },
  fee: { t: 's’est fait soigner une aile par une fée', k: 'care', v: 15 },
  mousse: { t: 'a dormi sur un lit de mousse', k: 'care', v: 10 },
  tisane: { t: 'a bu la tisane d’une gentille sorcière', k: 'care', v: 10 },
  herbe: { t: 'a mâchonné une herbe médicinale', k: 'care', v: 5 },
  rhume: { t: 'a attrapé un rhume', k: 'care', v: -10 },
  ronces: { t: 's’est piqué dans un buisson de ronces', k: 'care', v: -10 },
  chute: { t: 'est tombé d’un arbre', k: 'care', v: -15 },
  guepe: { t: 's’est fait piquer par une guêpe', k: 'care', v: -5 },
  champignon: { t: 'a goûté un champignon douteux', k: 'care', v: -10 },
};
const EVT_IDS = Object.keys(EVTS);

const DEFAULT_SETTINGS = {
  accents: true, articles: true, goalDays: 5, goalMin: 5, remind: false, remindAt: '17:30',
  // règles du jeu réglables par le parent (voir lib/rules.js)
  rotMax: ROT.max, rotNeed: ROT.need, penCare: BOSS.penCare, penJoy: BOSS.penJoy,
  gemCards: GAMES.cards.g, gemDuel: GAMES.duel.g, gemScramble: GAMES.scramble.g, gemForge: GAMES.forge.g,
};

module.exports = {
  GAMES, ORDER, ROT, BOSS, GEMS, VOUCH, RES_PRICE, LANGS, REALM, RATE, LOW, NIGHT, GAUGES, STATE_N,
  PETS, ITEMS, DURABLE, EVTS, EVT_IDS, DEFAULT_SETTINGS,
};
