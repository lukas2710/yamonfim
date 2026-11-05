# TV 2.7.8 — favoris et « à regarder plus tard »

- Fiche : boutons « Favori » et « Plus tard », par profil, partagés avec le site. Ils restent masqués tant que la table `user_lists` n'existe pas.
- Accueil : rangées « Mes favoris » et « À regarder plus tard », juste après « Reprendre ».
- Reprendre : un film arrêté dans ses deux dernières minutes ne revient plus, comme sur le site.
- Les listes ne changent pas l'accès : la limite gratuite reste vérifiée à la lecture.

L'erreur « Le catalogue ne peut pas être chargé (206) » a été corrigée côté serveur : elle disparaît aussi sur les versions déjà installées.

Validation : compilation Android, tests Java et signature par `build-apk.ps1`, depuis le code commité. Pas de test sur téléviseur ni sur émulateur.
