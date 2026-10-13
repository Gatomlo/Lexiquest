# Lexiquest

Jeu pédagogique pour mémoriser le vocabulaire de néerlandais et d'anglais : séances de 5 minutes, cinq jeux accessibles dès le départ, points à dépenser pour nourrir et soigner un compagnon fantastique, bons de régularité, et un tableau de bord pour suivre le travail.

> État : cahier des charges, maquette interactive et **application des lots 0 et 1** (serveur, jeux, compagnon, boutique, suivi parent). Reste : lot 2 (PWA, hors-ligne) et lot 3 (extras).

## Contenu

| Chemin | Rôle |
| --- | --- |
| [`docs/cahier-des-charges.md`](docs/cahier-des-charges.md) | Spécification fonctionnelle et technique |
| [`maquette/index.html`](maquette/index.html) | Maquette interactive, à ouvrir dans un navigateur |
| `server.js`, `lib/`, `routes/` | Serveur Express + SQLite (`node:sqlite`) : règles du jeu, API sous `/api` |
| `public/` | Front sans build : élève (`index.html`) et parent (`parent.html`), polices hébergées |
| `test/` | Tests d'API et de règles (`npm test`) |
| [`CLAUDE.md`](CLAUDE.md) | Contexte du projet pour le travail avec Claude Code |

## Voir la maquette

Ouvrir `maquette/index.html`. En haut de page : bascule **Élève / Parent**, **absence simulée** (0, 2, 4, 7 jours) pour voir le compagnon dépérir et le Gardien frapper, style **Jeu / Adulte** à comparer sur toute l'application, vue smartphone ou ordinateur, thème clair ou sombre. Les données sont générées sur 8 semaines et rien n'est envoyé nulle part.

## Essayer en local

```
npm install
npm run seed-demo     # parent « papa » et élève « lea », mot de passe lexiquest-demo (jamais en production)
npm start             # http://localhost:3000  (élève) · http://localhost:3000/parent (parent)
npm test
```

Comptes réels : `LEXIQUEST_PASSWORD=… node scripts/create-user.js parent <id> "<nom>"` puis `… student <id> "<nom>" <id du parent>`. En production : `NODE_ENV=production`, `SESSION_SECRET` obligatoire, base dans `data/` (hors dépôt, à sauvegarder ; `LEXIQUEST_DB` pour changer l'emplacement), fuseau `Europe/Brussels` (`LEXIQUEST_TZ`).

## Déploiement prévu

Sous-application de [node-gateway](https://github.com/Gatomlo/node-gateway), montée sur `/lexiquest`, avec SQLite pour les données. Détails au §12 du cahier des charges.
