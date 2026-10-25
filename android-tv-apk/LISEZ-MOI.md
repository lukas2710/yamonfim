# YAMONFILM TV

Version séparée pour **Android TV et Google TV, à partir d’Android 8**.

**APK :** `release/YAMONFILM-TV-2.4.0.apk`  
**Site utilisé :** https://yamonfim.vercel.app/  
**Identifiant Android :** `app.yamonfim.tv`.

Cette version est créée uniquement dans `android-tv-apk`. Le site et la version téléphone dans `android-apk` ne sont pas modifiés. Les deux applications ont des identifiants et des signatures distincts.

## Installer sur une TCL Android TV / Google TV

1. Transférer **uniquement l’APK TV** sur la télévision, par clé USB ou par une application de transfert de fichiers déjà disponible sur la TV.
2. Ouvrir le fichier APK avec le gestionnaire de fichiers de la TV.
3. Suivre les instructions Android pour installer l’application. Si Android le demande, autoriser cette installation pour le gestionnaire de fichiers utilisé.
4. Ouvrir **YAMONFILM TV** depuis les applications de la télévision, puis se connecter au compte du site.

Ce fichier n’est pas destiné aux téléviseurs sous Roku TV ou à un autre système qui ne prend pas en charge les applications Android. Le modèle exact de la TCL n’a pas été identifié et l’application n’a pas encore été essayée dessus.

## Version 2.0.0 : une interface réservée à la télévision

L’APK ajoute son propre menu et sa présentation TV autour du contenu du site :

- Menu latéral permanent : Accueil, Films, Séries, Recherche, Collections, Historique et Plus.
- Suppression dans l’application de la barre mobile du bas, du menu PC d’origine et de la navigation de bas de page.
- Panneau de recherche TV dédié, relié à la recherche réelle du catalogue.
- Menu Plus avec TV en direct, demandes, VIP, assistance, profils et déconnexion. L’admin retrouve aussi les pages de gestion.
- Sélection visible à la télécommande, rangées d’affiches compactes et bannière d’accueil raccourcie.
- Masquage du menu de l’application pendant la lecture, les fenêtres du site et la sélection des profils.
- Retour depuis Films/Séries/Recherche/Collections vers l’accueil avant de quitter l’application.
- Mêmes comptes, règles VIP, quotas, données et lecteur que sur le site. Les boutons de filtre, la recherche et la déconnexion utilisent les fonctions du site au lieu de les dupliquer.

Les fichiers `assets/tv-shell.js`, `assets/tv-shell.css` et `assets/tv-layout.css` sont chargés localement par l’APK. Aucun fichier du site hébergé n’est modifié. La zone de mise en page reste adaptée à une largeur de 1 280 pixels, avec une échelle calculée pour l’écran ; environ sept affiches par rangée sont visibles à côté du menu.

Les liens du menu qui ouvrent une autre page rechargent cette page dans l’application, tout en gardant le stockage de connexion. L’APK ne crée pas de nouveau catalogue et n’ajoute pas de droits dans Supabase.

## Mettre à jour l’application

Installer **YAMONFILM-TV-2.1.0.apk par-dessus la version précédente**, sans la désinstaller. L’identifiant reste `app.yamonfim.tv`, la signature est conservée et le numéro de version Android passe à 3. Cette mise à jour est conçue pour préserver les données de l’application.

Les changements publiés sur le site sont récupérés au rechargement sans réinstaller l’APK. En revanche, les modifications propres à l’application Android nécessitent d’installer un nouvel APK ; il n’y a pas de mise à jour automatique de l’APK.

## Télécommande

| Touche | Action |
| --- | --- |
| Flèches | Passer entre les boutons et les titres, avec une bordure claire sur la sélection |
| OK, appui court | Ouvrir ou valider la sélection |
| OK, appui long | Ouvrir les commandes TV |
| Menu, si disponible | Ouvrir les mêmes commandes TV |
| Retour | Quitter le plein écran, fermer une fenêtre du site ou revenir à la page précédente |

Un écran d’aide apparaît au premier lancement. Les commandes TV permettent de revenir à l’accueil, de recharger la page, d’activer le pointeur et de relire l’aide.

### Lecteurs vidéo et mode pointeur

Les fournisseurs vidéo intégrés peuvent avoir leurs propres boutons, parfois difficiles à sélectionner avec les flèches. Dans ce cas :

1. Faire un appui long sur OK.
2. Choisir **Activer le mode pointeur**.
3. Déplacer le cercle avec les flèches et appuyer sur OK pour cliquer dans le lecteur.
4. Pour faire défiler la page, amener le cercle en haut ou en bas de l’écran, puis continuer dans cette direction.
5. Refaire un appui long sur OK pour revenir au mode sélection. Retour désactive aussi le pointeur lorsqu’aucune fenêtre du site n’est ouverte.

Si le lecteur est déjà en plein écran natif, Retour permet d’en sortir pour retrouver les commandes de l’application. Les commandes internes des lecteurs tiers et les touches multimédias dépendent du fournisseur.

Pour écrire, sélectionner un champ puis valider avec OK : le clavier de la télévision prend le relais.

## Comptes, VIP et données

L’application ouvre le site en ligne, avec son fonctionnement existant. Les comptes, profils, historiques et règles VIP/quotas sont ceux du site. Une connexion Internet est nécessaire ; l’APK ne contient pas les films. La connexion dans cette application est distincte de celle du navigateur ou de l’APK téléphone.

La navigation TV et le marquage visuel sont ajoutés localement dans l’application. Aucun fichier JavaScript ou CSS du site n’est changé. Aucun accès supplémentaire à Supabase n’est ajouté.

Les liens HTTPS externes sont ouverts dans un navigateur si la télévision en possède un. Si aucun navigateur n’est disponible pour le paiement, utiliser le site sur téléphone ou PC pour gérer l’abonnement du même compte.

## Reconstruire

```powershell
cd C:\Users\Admin\yamonfim\android-tv-apk
.\build-apk.ps1
```

Le script peut réutiliser en lecture seule les outils déjà téléchargés dans `../android-apk/.tools`. Il écrit ses fichiers de compilation, sa clé de signature et son APK uniquement dans `android-tv-apk`.

Si ce dossier est utilisé seul, télécharger les outils officiels localement avec :

```powershell
.\build-apk.ps1 -PrepareTools
```

Conserver une sauvegarde privée de `private` pour pouvoir signer les prochaines mises à jour avec la même clé. Ne partager que l’APK avec les utilisateurs.

Les sources sont dans `app/src/main`. L’adaptation de navigation TV est dans `assets/tv-navigation.js`. La bannière TV vectorielle est incluse dans les ressources ; son générateur est conservé dans `tools/MakeBanner.java`.

## Vérifications et limites

- Compilation Java et DEX Android.
- 16 tests de frontière entre le site et les liens externes.
- 10 tests des limites et déplacements du pointeur.
- 17 tests du script de navigation dans un environnement DOM simulé : directions, boutons indisponibles, champs de texte, confinement dans une fenêtre, fermeture et retour du plein écran.
- 17 tests de l’interface TV (menu, barre mobile masquée, recherche, catégories, fenêtres, déconnexion) et un test d’intégration avec React pour vérifier la recherche contrôlée et les filtres.
- Contrôle du manifeste final : entrée `LEANBACK_LAUNCHER`, bannière TV, mode paysage, écran tactile facultatif et prise en charge des reconnexions de télécommande.
- Signature RSA vérifiée avec les schémas Android v2 et v3, et contrôle de l’alignement de l’APK.
- Empreinte SHA-256 de l’APK dans `release/SHA256.txt`.
- Comparaison des fichiers de l’application téléphone et vérification Git du site pour confirmer leur préservation.

Pour relancer les tests JavaScript :

```powershell
node --test tests/tv-navigation.test.cjs tests/tv-shell.test.cjs tests/tv-shell-react.test.cjs
```

Les tests d’interface utilisent jsdom installé localement dans `.tools/dom-tests`. Pour les préparer sur un autre PC : `npm install --prefix .tools/dom-tests --no-audit --no-fund jsdom@26.1.0`.

La fixture `tests/remote-fixture.html` permet aussi un contrôle manuel des flèches dans un navigateur local. Les tests simulés ne remplacent pas un essai sur la télé : **aucune lecture vidéo, connexion réelle, saisie avec clavier TV ou installation sur TCL n’a été validée sur appareil réel ou émulateur**. La compatibilité des vidéos Moviez reste à essayer sur la télévision.

L’APK est signé pour une installation directe. Il n’a pas été publié sur Google Play.

Références : [applications Android TV](https://developer.android.com/training/tv/get-started/create), [navigation TV](https://developer.android.com/training/tv/get-started/navigation), [télécommandes](https://developer.android.com/training/tv/get-started/controllers).


## Version 2.1.0 : lecteur et performances TV

- La vid�o occupe tout l��cran. Les �pisodes ne prennent plus une colonne permanente.
- Fl�che Haut ou Retour pendant la lecture : afficher les commandes TV. Le bouton � �pisodes et saisons � ouvre la liste ; Retour la masque.
- La s�lection d�un �pisode passe par les boutons originaux : historique, VIP et quota restent g�r�s par le site.
- � Commandes du lecteur � donne le focus au lecteur externe. Ses fonctions d�pendent de sa propre prise en charge de la t�l�commande. Si n�cessaire, appui long OK puis � Activer le mode pointeur � permet de cliquer sur sa barre de progression. Retour quitte le pointeur.
- Appui long OK / Menu puis � Afficher les commandes du lecteur � permet de retrouver le menu TV depuis le lecteur externe.
- Les vid�os directes disposent de vraies commandes pause et �30 secondes. Aucun faux contr�le de progression n�est ajout� au lecteur externe.
- Animations, transitions, flous et effets de survol lourds retir�s sur les �crans dans l�APK uniquement.

Installer cette version par-dessus l�ancienne, sans la d�sinstaller. M�me identifiant et m�me signature.
Validation : tests automatiques de navigation, composants React et lecteur ; compilation et signature APK v�rifi�es. Pas de mesure de fluidit� ni de test sur une TV TCL r�elle : les commandes propres au lecteur externe restent � v�rifier sur la t�l�vision.


## Version 2.2.0 : navigation plus l�g�re

- Les positions des boutons sont r�utilis�es pendant les d�placements rapproch�s, puis recalcul�es lors du d�filement, d�un changement de disposition ou de contenu.
- Aucun d�filement suppl�mentaire lorsque la s�lection est d�j� dans la zone visible.
- Haut/Bas restent dans le menu lat�ral ; Droite retrouve le dernier �l�ment s�lectionn� dans le catalogue.
- La r�p�tition d�une fl�che maintenue est plafonn�e c�t� Android pour �viter d�accumuler des commandes. Les pressions individuelles restent imm�diates.
- Les changements d�affichage du menu du lecteur et de la liste d��pisodes invalident aussi les positions m�moris�es.
- Espacements harmonis�s pour l�historique, les demandes, les profils, la TV en direct et la page VIP. S�lection visible sans ombre � recalculer.

46 tests JavaScript et 26 v�rifications Java passent. La r�duction des calculs et des d�filements est v�rifi�e automatiquement ; aucun gain en images par seconde n�a �t� mesur� sur une t�l�vision r�elle.


## Version 2.3.0 : affiches progressives et m�moire des rubriques

- Les affiches non encore d�cod�es sont trait�es par petits groupes de 24. Celles �loign�es de l��cran attendent l�approche de la s�lection avant de charger ; une marge permet d�anticiper les d�placements.
- Les images TMDB trop grandes sont remplac�es par la taille w342 pour les affiches du catalogue et de l�historique. Les images d�j� charg�es, les petites images, les banni�res, le lecteur et les autres h�bergeurs gardent leur r�solution.
- Le d�codage des affiches est asynchrone. Leur pr�paration est suspendue pendant la lecture et lorsque la page est masqu�e. Les observateurs des menus �vitent des traitements inutiles derri�re le lecteur.
- La s�lection et le d�filement sont m�moris�s par rubrique et par profil dans la session. La restauration attend que le contenu original soit disponible et recherche le m�me titre si son ordre a chang�.
- Les positions anciennes de plus de 24 heures ne sont pas restaur�es.

Cette optimisation s�applique apr�s l�injection du mode TV : elle ne peut pas annuler les t�l�chargements que le site avait d�j� termin�s. Elle ne remplace pas les listes React par des listes Android natives. Le lecteur externe, l�authentification, le quota et l�historique de lecture conservent leur logique d�origine.
Validation : 54 tests JavaScript, 26 v�rifications Java, compilation et signature APK. Pas de mesure de performance sur TV r�elle.


## Version 2.4.0 : commandes du lecteur à la télécommande

- OK ou Haut pendant la lecture : retrouver les commandes TV même si le lecteur intégré a le focus. La touche Menu retrouve également les commandes TV ; l’appui long OK conserve le menu Android de secours.
- Bas lorsque les commandes sont masquées : ouvrir les épisodes.
- Épisode précédent et Épisode suivant : accès direct aux boutons originaux du site, sans changer la logique VIP, quota ou historique. Les boutons indisponibles restent désactivés. Pour changer de saison, utiliser Épisodes et saisons.
- Nouveau panneau TV : épisodes lisibles, boutons Saison précédente/Saison suivante et Retour à la vidéo. La sélection appelle les gestionnaires originaux du site.
- Vidéo externe : Avancer / reculer positionne directement le pointeur vers le bas du lecteur. Les flèches visent ses commandes, OK clique et Retour quitte le pointeur. Ce mode n’invente pas de temps de lecture : il dépend des commandes effectivement affichées par le fournisseur.
- Vidéo directe : commandes réelles de lecture/pause et ±30 secondes.

Le lecteur Moviez reste un lecteur externe. Les commandes personnalisées de recherche temporelle ne sont pas exposées dans sa documentation consultée ; l’application utilise donc ses propres commandes visibles via un vrai pointeur. Aucun gain ou comportement n’a été vérifié sur une TV physique.


### Accueil, inclus dans la version 2.4.0

- Les flèches de l’accueil ne passent plus par la vérification asynchrone des commandes réservées au lecteur.
- Gauche/Droite choisissent l’affiche voisine dans la rangée sans mesurer le catalogue entier. Haut/Bas mesurent les rangées puis seulement les affiches de la rangée de destination.
- La préparation des affiches attend 180 ms après le dernier appui sur une flèche. Les traitements reprennent par petits groupes.
- Vérifications sur une page simulée de 360 affiches : moins de 8 mesures de position pour un déplacement horizontal et moins de 60 pour un déplacement vertical. Ces mesures ne sont pas des mesures de fluidité sur une TV physique.

Validation finale de la version 2.4.0 : 63 tests JavaScript et 26 vérifications Java, compilation et signature vérifiées.
