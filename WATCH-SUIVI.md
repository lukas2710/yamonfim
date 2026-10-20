# Lecteur et historique

La page `/watch/[id]` conserve le style noir et rouge, avec le lecteur, la bannière de l’épisode en cours et les cartes d’épisodes.

Moviez fait défiler ses vidéos lui-même. Le site utilise un chrono invisible pour mettre à jour sa bannière, le statut vu et l’historique : il ne recharge pas l’iframe lors d’un changement estimé d’épisode. Lancer un épisode ne le marque pas immédiatement comme terminé.

## Lecteur Moviez actuellement utilisé

Le code public de Moviez ne fournit pas d’échange d’événements avec la page parente. Le site ne peut donc pas lire sa position exacte, commander sa pause ou observer une navigation interne dans son iframe. Aucun faux bouton pause ni faux suivi seconde par seconde n’est affiché.

Le paramètre `next=1` laisse Moviez enchaîner les vidéos. Le chrono du site prend la durée propre de l’épisode, puis celle de la série si elle manque, et enfin 45 minutes comme estimation de secours. Cinq secondes correspondent au délai de transition observé dans le lecteur Moviez. À l’échéance, le site marque l’ancien épisode vu, vérifie et réserve le quota du suivant, met à jour l’historique et la bannière. Un compte gratuit est arrêté si son quota est épuisé ; les VIP ne consomment pas de quota gratuit.

Ce suivi est une estimation autorisée par l’utilisateur : une pause, une publicité, un chargement lent, un changement de vitesse ou une avance dans Moviez peuvent le décaler. Le contrôle du quota suit donc les épisodes estimés et ne prouve pas les épisodes réellement lus dans Moviez.

Le bouton « Pause du suivi » fige le chrono et le bouton « Reprendre le suivi » le remet en marche sans compter la période de pause. Il faut aussi mettre la vidéo en pause dans Moviez. Une commande unique garantissant les deux n’est pas disponible avec son iframe actuel. Le lecteur reste monté : le couper artificiellement pour simuler une pause risquerait de recommencer la vidéo au début.

Références consultées : [documentation Moviez](https://api.moviez.ac/), [script public du lecteur, version 9](https://api.moviez.ac/player2/static/player2.js?v=9).

## Fichiers vidéo directs

Pour les sources MP4, WebM ou HLS : le bouton Pause pilote réellement la vidéo, les événements natifs donnent les positions, sauvegardées environ toutes les 10 secondes de vidéo et lors des pauses ou fermetures. La lecture reprend à la position enregistrée lorsque le flux permet la recherche. Le marquage vu survient à 95 % ou à la fin réelle ; l’enchaînement automatique se fait sur l’événement de fin et garde le contrôle du quota. Une ancienne préférence désactivant l’enchaînement ne bloque plus cette nouvelle règle.

Le suivi précis à la seconde reste réservé aux sources directement pilotées par le site. Pour Moviez, le fonctionnement demandé utilise explicitement une estimation, pas des événements que le fournisseur ne transmet pas.

Les écritures de l’historique sont ordonnées pour éviter qu’une sauvegarde tardive du précédent épisode écrase le suivant. La dernière sauvegarde lors d’une fermeture du navigateur reste une tentative : une coupure immédiate peut perdre les dernières secondes. Les erreurs de sauvegarde affichent un message.
