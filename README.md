# Lexiquest

Jeu pédagogique pour mémoriser le vocabulaire de néerlandais et d'anglais : séances de 5 minutes, cinq jeux accessibles dès le départ, points à dépenser pour nourrir et soigner un compagnon fantastique, bons de régularité, et un tableau de bord pour suivre le travail.

> État : cahier des charges et maquette interactive. L'application serveur reste à développer.

## Contenu

| Chemin | Rôle |
| --- | --- |
| [`docs/cahier-des-charges.md`](docs/cahier-des-charges.md) | Spécification fonctionnelle et technique |
| [`maquette/index.html`](maquette/index.html) | Maquette interactive, à ouvrir dans un navigateur |
| [`CLAUDE.md`](CLAUDE.md) | Contexte du projet pour le travail avec Claude Code |

## Voir la maquette

Ouvrir `maquette/index.html`. En haut de page : bascule **Élève / Parent**, **absence simulée** (0, 2, 4, 7 jours) pour voir le compagnon dépérir, vue smartphone ou ordinateur, thème clair ou sombre. Les données sont générées sur 8 semaines et rien n'est envoyé nulle part.

## Déploiement prévu

Sous-application de [node-gateway](https://github.com/Gatomlo/node-gateway), montée sur `/lexiquest`, avec SQLite pour les données. Détails au §12 du cahier des charges.
