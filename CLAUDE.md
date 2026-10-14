# Lexiquest — vocabulaire en jeu

## Objectif
Jeu pédagogique web (PWA, smartphone first) pour mémoriser le vocabulaire de néerlandais et d'anglais : séances de 5 min, points à dépenser pour soigner un compagnon fantastique (inspiration Tamagotchi), bons de régularité, suivi parent (quand, combien de temps, résultats, difficultés). Public : une adolescente de 3e secondaire. Successeur de « Carnet de Vocabulaire » (artefact v1).

## État
**Lots 0, 1, 2 et 3 codés** (serveur, jeux, compagnon, boutique, suivi parent, PWA hors-ligne, notifications push, import CSV, nouveaux compagnons et articles ; pas d'e-mail). Montage dans `node-gateway` vérifié (`apps/lexiquest`). Reste : déploiement chez Infomaniak, tests sur téléphone réel, calibrage après une semaine d'usage.

## Fichiers clés
- `docs/cahier-des-charges.md` : spécification complète (source de vérité).
- `maquette/index.html` : maquette interactive autonome (HTML/CSS/JS vanilla, données simulées, aucun réseau sauf Google Fonts). Rôles élève/parent via le sélecteur du haut ; « Absence simulée » avance le calendrier pour montrer la décrépitude.

- `server.js` (entrée, exporte l'app), `app.js` (`createApp(db)` pour les tests), `lib/` (règles : `config.js` barème, `sessions.js`, `pets.js`, `progress.js`, `stats.js`, `push.js`, `reminders.js` ; outils : `session.js`, `password.js`, `webpush.js`, `retry-load.js`, `repair-modules.js`), `routes/api.js` et `routes/admin.js`, `public/` (front vanilla : `student.js`, `parent.js`, `art.js`, `common.js`, `offline.js`, `judge.js` partagé avec le serveur, `sw.js` service worker versionné par le serveur), `test/`.

## Stack cible (voir le cahier, §12)
Node ≥ 22.5, `node:sqlite`, front vanilla sans build — comme Fée Lezcomptes. **Aucune dépendance propre** : Express est celui de la passerelle (résolu depuis `node_modules` de la racine ; `devDependencies` seulement pour l'essai en autonome), mots de passe en scrypt (`lib/password.js`), sessions signées (`lib/session.js`), Web Push écrit avec `node:crypto` (`lib/webpush.js`, conforme au vecteur de test du RFC 8291). Déployé comme sous-application de `Gatomlo/node-gateway` (`apps/lexiquest`, route `/lexiquest`, Infomaniak).

## Règles non évidentes
- L'app **exporte** son app Express (`module.exports = app`) et ne `listen()` que si `require.main === module` : `server.js` est l'entrée (réparation de `node_modules`, chargement avec nouveaux essais si Node refuse un `package.json` sur le volume réseau), `app.js` contient l'application.
- Côté navigateur : **chemins relatifs uniquement** (montage sous `/lexiquest`).
- Aucun déblocage par niveau, mais **rotation** : un jeu (hors Gardien) se verrouille après 3 séances et se rouvre en jouant 2 autres jeux différents. Un **Gardien hebdomadaire** à vaincre (sinon −40 vie, −20 plaisir) ; un Gardien bonus (semaine déjà validée) n'a aucun effet.
- Monnaie = **gemmes** ; les jeux difficiles en rapportent davantage (1, 2, 3, 4 par bon mot). Le compagnon ne meurt jamais : à 0 de vie il est « à terre », seule la potion de résurrection (150) le relève.
- **Règles réglables par le parent, élève par élève** (rotation, pertes du Gardien, gemmes par bon mot ; `lib/rules.js`, clés de la table `settings`, valeurs d'origine dans `lib/config.js`). Tout calcul doit lire les règles de l'élève, jamais les constantes de `config.js`.
- **Équilibre** (valeurs d'origine) : 1 séance/jour + bon du jour ≈ entretien (≈ 40 gemmes/jour) ; l'épargne (compagnons 400 à 1 500, accessoires et décors durables) exige plusieurs séances par jour. Tout changement de prix ou de vitesse des jauges doit garder cet équilibre.
- Jauges **vie / énergie / plaisir**, baisse **horaire** (plaisir −1,5/h, énergie −1,2/h ; vie −0,75/h par jauge sous 20), **divisée par deux la nuit** (20 h – 8 h, il dort ; sans manger la nuit, mais **réveil affamé : −8 d'énergie à 8 h**) + un **événement aléatoire** (30 au catalogue) tous les 1 à 3 jours sur une jauge.
- **Une seule langue par séance** (néerlandais ou anglais) : jamais de mélange, ni dans les mots, ni dans les distracteurs du QCM ; la langue se choisit avant la portée.
- L'élève a ses propres statistiques (mêmes indicateurs que le parent, sans le détail des séances).
- **Style retenu : Adulte** (le style Jeu n'existe plus que dans la maquette). Thème clair/sombre réglable sur l'appareil.
- **Compte élève par lien d'invitation** : le parent crée un lien à usage unique (7 jours, jeton haché en base, `lib/invites.js`) ; l'élève ouvre `/lexiquest/#invite=…` et choisit identifiant et mot de passe. Toute requête qui modifie des données porte un corps JSON, même vide (le client `api()` l'impose ; le serveur répond 415 sinon).
- L'écran de connexion élève ne montre **aucune entrée « parent »** ; le parent a son adresse à part.
- Gemmes calculées côté serveur depuis les événements ; solde = somme de `gem_events`. Décrépitude calculée à la lecture (simulation heure par heure, événements tirés d'une graine par élève), pas de tâche planifiée.
- **Hors-ligne** : l'appareil joue avec le dernier état connu et envoie les séances à `POST /sessions/import` (identifiant unique, idempotent) ; le serveur recorrige tout. Rien d'autre ne marche sans réseau (boutique, bons).
- **Rappels** : Web Push (VAPID), minuterie dans le processus ou cron externe `POST /api/cron/reminders` (`CRON_KEY`) ; iPhone seulement après installation sur l'écran d'accueil.
- **Le serveur décide** : il choisit les mots, corrige (`public/js/judge.js`), calcule les gemmes et recalcule rotation, Gardien et série depuis les séances terminées. Le client ne fait qu'afficher et déclarer ses réponses.
- **Zéro configuration, comme les autres outils de la passerelle** : secret de session et clés VAPID tirés au hasard au premier démarrage et gardés dans la table `kv` ; **premier compte = parent, créé à la première visite de `/parent`** (`POST /api/setup`, refusé dès qu'un compte existe) ; les variables d'environnement (`SESSION_SECRET`, `VAPID_SUBJECT`, `LEXIQUEST_DB`, `CRON_KEY`…) restent facultatives.
- Fuseau : `Europe/Brussels` par défaut si `TZ` n'est pas défini (`lib/clock.js`) ; cookie de session limité au chemin de montage ; manifestes nommés `manifest.json` (la passerelle en lit l'icône pour son accueil).
- Dépôt public : aucune donnée réelle d'élève, ni `.env`, ni `*.db`.

## Commandes
- `npm install`, `npm test` (node:test, base en mémoire), `npm run seed-demo` (comptes papa/lea, dev seulement), `npm start`, `node scripts/reset-password.js` (mot de passe oublié).
- Voir la maquette : ouvrir `maquette/index.html` dans un navigateur (aucune installation).
- Contrôle de syntaxe du script de la maquette : extraire le `<script>` puis `node --check`.

## Méthode de travail
- Répondre en français, **concis** (réponses courtes), sauf demande explicite de détail, d’analyse ou de réponse complète. Lire des extraits ciblés plutôt que `maquette/index.html` en entier (≈ 1000 lignes).
- Garder cahier des charges et maquette cohérents : toute décision de jeu (barème, jeux, états du compagnon) se change aux deux endroits.
