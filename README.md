# Lexiquest

Jeu pédagogique pour mémoriser le vocabulaire de néerlandais et d'anglais : séances de 5 minutes, cinq jeux accessibles dès le départ, points à dépenser pour nourrir et soigner un compagnon fantastique, bons de régularité, et un tableau de bord pour suivre le travail.

> État : cahier des charges, maquette interactive et **application complète** (lots 0 à 3 : serveur, jeux, compagnon, boutique, suivi parent, PWA hors-ligne, notifications). Reste : déploiement et essais sur téléphone.

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

Aucune variable d'environnement à régler : le secret de session et les clés des notifications sont tirés au hasard au premier démarrage et gardés dans la base (`data/lexiquest.db`, hors dépôt, à sauvegarder).

**Première installation** : ouvrir `/parent` ; tant qu'il n'y a aucun compte, la page propose de créer le compte parent (premier arrivé, premier servi : à faire juste après le déploiement). Le parent ajoute ensuite l'élève dans Réglages. Mot de passe oublié : `node scripts/reset-password.js <identifiant> <nouveau mot de passe>` sur le serveur.

## Déploiement

Comme les autres outils : sous-application de [node-gateway](https://github.com/Gatomlo/node-gateway), sans configuration.

```
cd <passerelle>/apps
git clone https://github.com/Gatomlo/Lexiquest.git lexiquest
cd .. && npm install        # installe aussi les dépendances de apps/lexiquest (Node 22.5 ou plus : node:sqlite)
# redémarrer la passerelle
```

Élève : `/lexiquest/` · parent : `/lexiquest/parent`. Mise à jour : `git pull` dans `apps/lexiquest`, `npm install` à la racine, redémarrage. Les rappels par notification tournent dans le processus de la passerelle ; variables facultatives : `SESSION_SECRET`, `VAPID_SUBJECT`, `LEXIQUEST_DB`, `LEXIQUEST_TZ`, `REMINDERS=off` + `CRON_KEY` (cron externe sur `POST /api/cron/reminders`). Détails au §12 du cahier des charges.
