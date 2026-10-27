# YAMONFILM TV 2.3.1

- Même package `com.yamonfilm.tv` et même clé de signature ; versionCode 11.
- Préparation du lien du prochain épisode pendant la dernière minute, sans ajout au quota ni à l’historique avant son lancement.
- Barre « Lecture suivante » avec progression de cinq secondes, de 35 à 30 secondes avant la fin réelle. Pause, annulation et dernier épisode respectés.
- Moviez prioritaire via le serveur du site ; les secours provenant de Movix sont limités à EmbedOrigin.
- Les modifications de la logique native nécessitent d’installer ce nouvel APK par-dessus la version précédente.

Vérifications : compilation Java/DEX, 89 contrôles de logique, alignement et signatures v2/v3. Le fonctionnement matériel sur une box Bouygues reste à vérifier sur l’appareil.
