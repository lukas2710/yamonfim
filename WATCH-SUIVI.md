# Lecteur et historique

La fiche `/watch/[id]` conserve le thème noir et rouge avec une nouvelle présentation des films et séries : affiche, synopsis, actions et progression. Pendant une série, les épisodes sont affichés à droite sur ordinateur et sous la vidéo sur mobile.

L’enchaînement automatique est désactivé : aucun chrono ne change l’épisode et Moviez reçoit `next=0`. La liste d’épisodes utilise le même lancement et les mêmes contrôles d’accès qu’avant. Les bandes de commandes au-dessus et au-dessous du lecteur sont remplacées par des commandes flottantes. Les contrats Supabase et la logique de quota sont conservés.

L’épisode lancé est enregistré dans `watch_history` pour le profil actif. Il est marqué vu dans `user_watched` après cinq secondes d’ouverture du lecteur. Fermer, changer d’épisode ou mettre la vidéo native en pause annule le délai en attente. Les épisodes sautés ne sont pas marqués vus automatiquement. La reprise distingue correctement l’index de saison de celui de l’épisode.

Moviez ne transmet pas sa position ni son état au site : ce délai mesure l’ouverture de son iframe, pas cinq secondes de vidéo réellement lues. La reprise conserve l’épisode choisi ; la position précise et la pause pilotée par le site sont disponibles pour les sources vidéo directes (MP4, WebM, HLS). Pour ces sources, la position est sauvegardée pendant la lecture et lors des pauses ou fermetures. Une fin de vidéo ne lance jamais la suivante.

Aucune donnée existante n’est supprimée et aucune migration n’est nécessaire.
