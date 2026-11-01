# Sélections de l’accueil

- Les recommandations utilisent uniquement l’historique du profil actif : récence,
  progression, genres et similarité des descriptions. Les titres déjà lancés sont exclus.
- Un manga ou une animation ne sont pas recommandés via le seul genre Action/Aventure.
  L’intérêt pour ces catégories nécessite un visionnage de dix minutes et au moins
  20 % de la durée connue. Les suggestions, le carrousel, les collections et les tops
  de l’accueil utilisent ce filtre. Les profils enfant gardent les dessins animés.
  Les recherches explicites et les rubriques du catalogue restent accessibles.
- `/api/home-rankings` consulte TMDB côté serveur : trois pages de Discover par
  genre pour chaque type, triées par note avec au moins 300 votes pour les films et
  150 pour les séries ; cinq pages de tendances hebdomadaires pour chaque type.
  Seuls les titres disponibles, autorisés pour le profil et identifiés par leur
  couple type/TMDB sont affichés. Ce sont des sélections TMDB, pas les notes
  exhaustives des 25 000+ titres du catalogue. Aucune note n’est inventée.
- Les tops sont classés par note décroissante, puis nombre de votes. Les tendances
  gardent l’ordre TMDB. La note affichée sur la carte est la moyenne brute sur dix.
- Les sélections sont enregistrées dans Netlify Blobs et rafraîchies toutes les six
  heures par `refresh-home-rankings`. Un instantané TMDB vérifié est embarqué
  pour répondre immédiatement au premier démarrage, sans calcul coûteux pendant
  la visite. Les tendances de plus de 48 heures sont masquées si le rafraîchissement échoue.
  `TMDB_API_KEY` reste une variable serveur. Un échec conserve le dernier résultat
  complet ; sans données, les tops restent masqués, sans bloquer l’accueil.

Sources : [Discover](https://developer.themoviedb.org/reference/discover-movie),
[tendances](https://developer.themoviedb.org/docs/popularity-and-trending).
TMDB fournit des tendances quotidiennes ou hebdomadaires, sans fenêtre mensuelle.
