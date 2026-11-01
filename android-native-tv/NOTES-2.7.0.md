# TV 2.7.0 — accueil et recommandations

- Recommandations calculées avec l’historique du profil actif : progression,
  récence, genres et résumés. Les titres déjà lancés sont exclus. Les anciens
  titres marqués vus servent de secours, comme sur le site.
- Classements par genre (« Populaires en Action », etc.) fondés sur les notes
  TMDB, avec au moins 300 votes pour les films et 150 pour les séries. Notes
  affichées sur les cartes ; « Tout voir » conserve le classement.
- Films et séries en tendance cette semaine : ordre TMDB, titres disponibles
  sur le site uniquement. Tendances âgées de plus de 48 heures masquées.
- Mangas et animation exclus des sélections sans intérêt établi par le profil.
  Les profils enfants conservent les dessins animés ; les rubriques explicites
  du catalogue et l’historique restent accessibles.
- Classements publics du site, avec instantané embarqué et copie locale pour
  démarrer sans attendre le réseau. Calcul des suggestions en arrière-plan.
- Catalogue public mis en cache : un téléchargement remplace les nombreuses
  pages Supabase, avec le parcours précédent conservé en cas d’indisponibilité.
- Badge vert « Vu » sur les affiches de l’accueil et des grilles : film terminé
  ou marqué vu ; série avec tous ses épisodes vus. Données du profil actif uniquement.
- Présentation native et commandes à la télécommande conservées. Comptes,
  profils, quotas, VIP et sauvegardes de lecture gardent leurs contrôles existants.

Validation : compilation Android, 97 vérifications des règles existantes et
24 vérifications de découverte et de complétion ; signature v2/v3 et alignement vérifiés.
Même package et certificat que l’APK publié ; versionCode 20.
Pas de téléviseur ni d’émulateur disponible pour un essai physique.
