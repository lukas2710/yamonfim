# Android TV 2.7.5

- Le lecteur natif récupère le repère de générique du site, propose le prochain épisode avec le même compte à rebours et enchaîne au même moment.
- Après trois épisodes lancés automatiquement, l'app demande « Tu es toujours là ? », comme le site.
- Les affiches des titres terminés affichent « Vu » dans les rangées, la recherche, le catalogue et l'historique. Une série est terminée quand tous ses épisodes du catalogue sont marqués vus.
- La page `/app` télécharge cette version sous le même nom de fichier afin de permettre l'installation par-dessus l'ancienne APK.

Validation : compilation et vérifications intégrées au script de build, puis signature et alignement de l'APK. Le parcours des lecteurs intégrés en secours WebView ne peut pas exposer sa position de lecture au compteur natif ; le minutage du générique y reste contrôlé par le lecteur intégré.
