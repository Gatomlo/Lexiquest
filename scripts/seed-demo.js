#!/usr/bin/env node
'use strict';
/* Données de démonstration pour essayer l'application en local : un parent, une élève et quatre listes.
   Refuse de s'exécuter en production. Mot de passe : variable LEXIQUEST_PASSWORD (défaut : lexiquest-demo). */
if (process.env.NODE_ENV === 'production') { console.error('Refusé en production.'); process.exit(1); }
const { open } = require('../lib/db');
const { createUser } = require('../lib/users');
const { createList } = require('../lib/lists');

const pw = process.env.LEXIQUEST_PASSWORD || 'lexiquest-demo';
const db = open();
if (db.prepare("SELECT 1 FROM users WHERE username = 'papa'").get()) { console.error('Déjà initialisé (compte « papa » existant).'); process.exit(1); }
const parent = createUser(db, { username: 'papa', display: 'Parent', role: 'parent', password: pw });
const lea = createUser(db, { username: 'lea', display: 'Léa', role: 'student', password: pw, parentId: parent });
const L = (lang, name, sub, text, by) => createList(db, lea, { lang, name, sub, text, assignedBy: by });
L('nl', 'Les vêtements', 'de kleren', 'de trui = le pull\nhet hemd = la chemise\nde broek = le pantalon\nde rok = la jupe\nde jas = le manteau\nde schoenen = les chaussures\nde sokken = les chaussettes\nde muts = le bonnet\nde sjaal = l’écharpe\nde handschoenen = les gants\ndragen = porter\npassen = essayer\nkopen = acheter\nduur = cher\ngoedkoop = bon marché');
L('nl', 'In de klas', 'à l’école', 'de leerkracht = le professeur\nde leerling = l’élève\nhet bord = le tableau\nde stift = le feutre\nhet schrift = le cahier\nhet handboek = le manuel\nde toets = l’interrogation\nhet examen = l’examen\nhet rapport = le bulletin\nde vakantie = les vacances\nluisteren = écouter\nopletten = faire attention\neen vraag stellen = poser une question\nhet huiswerk = les devoirs\nafwezig zijn = être absent', parent);
L('en', 'Daily routine', 'la journée type', 'to wake up = se réveiller\nto get dressed = s’habiller\nto have breakfast = prendre le petit-déjeuner\nto catch the bus = attraper le bus\nhomework = les devoirs\nto hang out with friends = traîner avec des amis\nto go to bed = aller se coucher\nexhausted = épuisé\nschedule = l’horaire\nbreak = la pause');
L('en', 'Feelings & personality', 'caractère', 'shy = timide\nstubborn = têtu\nreliable = fiable\nmoody = lunatique\nconfident = sûr de soi\ncurious = curieux\nlazy = paresseux\nhard-working = travailleur\nanxious = anxieux\neasy-going = décontracté', parent);
console.log(`Démo prête : « papa » (parent) et « lea » (élève), mot de passe « ${pw} ».`);
