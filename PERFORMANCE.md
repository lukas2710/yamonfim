# Revue des performances

Périmètre : 30 pages, layout et composants partagés. Revue du code et compilation de toutes les routes. Les mesures sont des calculs locaux sur le catalogue public, pas des mesures de chargement sur appareils physiques.

## Modifications communes

- Préconnexion au serveur des affiches TMDB.
- Décodage asynchrone de 48 images dans 24 fichiers : mêmes URL, dimensions, styles et priorités réseau.
- Préchargement des liens administrateur au survol ou au focus au lieu du chargement de toutes les pages présentes dans le menu.
- Minuteur du questionnaire actif sur l’accueil uniquement ; délai initial et règles de présentation conservés.
- Contrôles d’accès, quotas, paiements, requêtes métier, filtres et feuilles CSS conservés.

## Vérification

Compilation Next.js réussie. 59 tests réussis. Classes et styles JSX identiques sur les 27 fichiers modifiés. Aucune nouvelle erreur ESLint.

Sur 25872 titres et 29 genres, regroupement des sélections : 99.1 ms avant, 8.3 ms après. Listes et ordre exactement identiques ; travail réutilisé aux rendus suivants.

| Recherche | Avant | Après | Résultats |
|---|---:|---:|---:|
| stranger things | 168.5 ms | 108.4 ms | 4 identiques |
| harry poter | 156.1 ms | 123.7 ms | 13 identiques |
| le seigneur | 157.2 ms | 114.1 ms | 24 identiques |

## Pages examinées

| Route | Conclusion |
|---|---|
| `/abonnement` | Stripe chargé à l’ouverture du paiement ; compteurs et affiches mémorisés. |
| `/admin-vip` | Chargements et effets examinés ; optimisations partagées appliquées. |
| `/admin/accueil` | Recherche créée une fois par requête ; résultats mémorisés. |
| `/admin/avatars` | Décodage des images asynchrone ; chargements et interactions conservés. |
| `/admin/avis` | Chargements et effets examinés ; optimisations partagées appliquées. |
| `/admin/banners` | Recherche créée une fois par requête ; résultats mémorisés. |
| `/admin/collections` | Recherche créée une fois par requête ; résultats mémorisés. |
| `/admin/famille` | Décodage des images asynchrone ; chargements et interactions conservés. |
| `/admin/generiques` | Chargement des épisodes déjà limité aux séries ouvertes ; règles conservées. |
| `/admin/mangas` | Décodage des images asynchrone ; chargements et interactions conservés. |
| `/admin/nouveautes` | Décodage des images asynchrone ; chargements et interactions conservés. |
| `/admin` | Décodage des images asynchrone ; chargements et interactions conservés. |
| `/admin/promotions` | Chargements et effets examinés ; optimisations partagées appliquées. |
| `/admin/stats` | Recherche créée une fois ; graphiques chargés dans un module séparé. |
| `/admin/test-sources` | Chargements et effets examinés ; optimisations partagées appliquées. |
| `/app` | Page serveur statique ; optimisations partagées appliquées. |
| `/catalogue-import` | Chargements et effets examinés ; optimisations partagées appliquées. |
| `/conditions` | Page serveur statique ; optimisations partagées appliquées. |
| `/confidentialite` | Page serveur statique ; optimisations partagées appliquées. |
| `/desinscription` | Chargements et effets examinés ; optimisations partagées appliquées. |
| `/history` | Index de progression par titre ; première entrée conservée, listes mémorisées. |
| `/login` | Chargements et effets examinés ; optimisations partagées appliquées. |
| `/mentions-legales` | Page serveur statique ; optimisations partagées appliquées. |
| `/` | Genres, listes récentes et index des bannières mémorisés ; mêmes titres et même ordre. |
| `/profiles` | Décodage des images asynchrone ; chargements et interactions conservés. |
| `/report` | Chargements et effets examinés ; optimisations partagées appliquées. |
| `/requests` | Décodage des images asynchrone ; chargements et interactions conservés. |
| `/tv` | Recherche créée une fois ; catégories et résultats mémorisés. HLS déjà différé. |
| `/vip` | Chargements et effets examinés ; optimisations partagées appliquées. |
| `/watch/[id]` | Images en décodage asynchrone ; HLS déjà chargé à la demande. |
