# Lexiquest — vocabulaire en jeu

## Objectif
Jeu pédagogique web (PWA, smartphone first) pour mémoriser le vocabulaire de néerlandais et d'anglais : séances de 5 min, points à dépenser pour soigner un compagnon fantastique (inspiration Tamagotchi), bons de régularité, suivi parent (quand, combien de temps, résultats, difficultés). Public : une adolescente de 3e secondaire. Successeur de « Carnet de Vocabulaire » (artefact v1).

## État
Phase **cahier des charges + maquette**. L'application serveur n'est pas encore écrite.

## Fichiers clés
- `docs/cahier-des-charges.md` : spécification complète (source de vérité).
- `maquette/index.html` : maquette interactive autonome (HTML/CSS/JS vanilla, données simulées, aucun réseau sauf Google Fonts). Rôles élève/parent via le sélecteur du haut ; « Absence simulée » avance le calendrier pour montrer la décrépitude.

## Stack cible (voir le cahier, §12)
Node ≥ 22.5, Express, express-session, bcryptjs, `node:sqlite`, front vanilla sans build — comme Fée Lezcomptes. Déployé comme sous-application de `Gatomlo/node-gateway` (`apps/lexiquest`, route `/lexiquest`, Infomaniak).

## Règles non évidentes
- L'app **exporte** son app Express (`module.exports = app`) et ne `listen()` que si `require.main === module`.
- Côté navigateur : **chemins relatifs uniquement** (montage sous `/lexiquest`).
- Aucun déblocage par niveau, mais **rotation** : un jeu (hors Gardien) se verrouille après 3 séances et se rouvre en jouant 2 autres jeux différents. Un **Gardien hebdomadaire** à vaincre (sinon −40 vie, −20 plaisir) ; un Gardien bonus (semaine déjà validée) n'a aucun effet.
- Monnaie = **gemmes** ; les jeux difficiles en rapportent davantage (1, 2, 3, 4 par bon mot). Le compagnon ne meurt jamais : à 0 de vie il est « à terre », seule la potion de résurrection (150) le relève.
- **Équilibre** : 1 séance/jour + bon du jour ≈ entretien (≈ 40 gemmes/jour) ; l'épargne (compagnons 400 à 1 500, accessoires et décors durables) exige plusieurs séances par jour. Tout changement de prix ou de vitesse des jauges doit garder cet équilibre.
- Jauges **vie / énergie / plaisir**, baisse **horaire** (plaisir −1,5/h, énergie −1,2/h ; vie −0,75/h par jauge sous 20), **divisée par deux la nuit** (20 h – 8 h, il dort) + un **événement aléatoire** (30 au catalogue) tous les 1 à 3 jours sur une jauge.
- **Une seule langue par séance** (néerlandais ou anglais) : jamais de mélange, ni dans les mots, ni dans les distracteurs du QCM ; la langue se choisit avant la portée.
- L'élève a ses propres statistiques (mêmes indicateurs que le parent, sans le détail des séances).
- Deux styles complets à comparer dans la maquette (Jeu / Adulte, bouton en haut de page) : décision en attente.
- L'écran de connexion élève ne montre **aucune entrée « parent »** ; le parent a son adresse à part.
- Gemmes calculées côté serveur depuis les événements ; solde = somme de `gem_events`. Décrépitude calculée à la lecture (simulation heure par heure, événements tirés d'une graine par élève), pas de tâche planifiée.
- Dépôt public : aucune donnée réelle d'élève, ni `.env`, ni `*.db`.

## Commandes
- Voir la maquette : ouvrir `maquette/index.html` dans un navigateur (aucune installation).
- Contrôle de syntaxe du script de la maquette : extraire le `<script>` puis `node --check`.

## Méthode de travail
- Répondre en français, concis. Lire des extraits ciblés plutôt que `maquette/index.html` en entier (≈ 1000 lignes).
- Garder cahier des charges et maquette cohérents : toute décision de jeu (barème, jeux, états du compagnon) se change aux deux endroits.
