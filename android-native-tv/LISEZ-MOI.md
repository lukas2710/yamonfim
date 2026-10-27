# YAMONFILM TV — application native Android TV

## Mise à jour 2.2.0 de ton APK 2.1.0

Base vérifiée : `E:\YAMONFILM-TV-2.1.0.apk`, package `com.yamonfilm.tv`, versionCode 8.
Nouvelle version : `release/YAMONFILM-TV-2.2.0.apk`, même package et même certificat, versionCode 9.
Installer par-dessus la 2.1.0, sans désinstaller, pour conserver les données de connexion.

Les écrans, menus, icônes, polices et ressources de la version fournie sont conservés. Aucun changement au site n'est nécessaire pour cette mise à jour : le lecteur appelle son résolveur HLS déjà publié.

- Moviez est résolu au lancement par l'API authentifiée du site, puis lu par le lecteur Android natif. Les liens expirés sont renouvelés quand on relance la lecture.
- Reprise sur la position vidéo réelle, avec recherche précise Android ; sauvegarde à la pause, en quittant et toutes les dix secondes. L'historique reste partagé avec le site, à la seconde ; la précision en millisecondes est conservée localement lorsque la position correspond à celle de l'historique.
- Dans les 90 dernières secondes (maximum 10 % pour un épisode court), compte à rebours de huit secondes vers le suivant. C'est une estimation du générique. Retour annule ; la pause suspend le décompte. Le changement de saison et le quota passent toujours par le parcours existant.
- Commandes à la télécommande natives existantes conservées : OK pour pause/lecture, flèches et touches multimédias, barre de progression, épisodes et saisons.
- Choix des pistes audio disponibles depuis le bouton Langue. Français par défaut, puis préférence mémorisée ; aucune langue n'est inventée quand la vidéo n'en propose qu'une.

Sources de travail dans `android-native-tv`. Pour reconstruire : `./android-native-tv/build-apk.ps1` depuis le dossier du site. La clé native d'origine est lue dans `C:\Users\Admin\yamonfilm-tv\private`, sans être copiée ni recréée.

Vérification : 94 tests Java, compilation, alignement, signature v2/v3. Certificat identique à celui de l'APK fournie ; aucune ressource `res/` différente. Pas de test sur téléviseur ou émulateur réel : lecture et télécommande restent à confirmer sur ton appareil.

---

Documentation d'origine de la base 2.1.0 :

**APK :** `release/YAMONFILM-TV-1.0.0.apk` (identifiant `com.yamonfilm.tv`, Android 8 et plus).

C'est une vraie application TV, écrite de zéro pour la télécommande : elle n'affiche pas le site.
Elle reprend uniquement ses données et ses règles : même base Supabase, mêmes comptes,
profils, historique, épisodes vus, collections, demandes, chaînes TV et règles VIP.
Le dossier du site (`C:\Users\Admin\yamonfim`) n'a pas été modifié.

Elle s'installe à côté de l'ancienne application WebView (`app.yamonfim.tv`) sans la remplacer.

## Installer sur la TV

1. Copier l'APK sur une clé USB (ou via une application de transfert de fichiers).
2. Sur la TV, ouvrir le fichier avec le gestionnaire de fichiers et autoriser l'installation si Android le demande.
3. Lancer **YAMONFILM** depuis l'écran d'accueil de la TV, puis se connecter avec le compte du site.

## Ce que contient l'application

| Rubrique | Contenu |
| --- | --- |
| Accueil | Le fond et le résumé suivent la sélection. Rangées : Reprendre, Collections, Nouveautés, Films, Séries, genres. |
| Recherche | Clavier à l'écran, résultats instantanés (même recherche tolérante que le site : accents, pluriels, une faute de frappe). |
| Films / Séries | Grille de tout le catalogue avec filtres par genre. |
| Fiche | Regarder / Reprendre, Recommencer, marquer vu, saisons, épisodes (vus, en cours). |
| Collections | Les collections publiées par l'admin. |
| Historique | Progressions du profil, reprise, suppression. |
| TV en direct | Même liste de chaînes que le site, zapping avec Haut/Bas. |
| Demandes | Recherche TMDB et demande d'ajout, avec la même vérification des doublons. Statut des demandes. |
| Mon compte | Statut VIP, visions utilisées (x / 5), compte à rebours de la remise à zéro, explication pour passer VIP. |

## Règles reprises du site

- **Quota gratuit** : 5 visions par semaine, remise à zéro le dimanche à 00 h (heure de Paris), via `get_my_subscription_status`.
  Chaque lancement de lecture (y compris l'épisode suivant) réserve une vision par une mise à jour conditionnelle,
  comme `reserveAccountViewing` : deux appareils ne peuvent pas consommer la même dernière vision.
- **VIP et admin** : visionnage illimité, sans décompte.
- Quota atteint : la fenêtre VIP s'affiche (avec le compte à rebours) au lieu de la fiche, comme sur le site.
- **Historique** : `watch_history` par compte et profil ; un titre est marqué vu après 5 secondes de lecture ou à 95 %.
- **Paiement** : impossible sur la TV (aucun lien de paiement dans l'application). L'abonnement se prend sur le site,
  depuis un téléphone ou un ordinateur. Dès que le compte est VIP, la TV le détecte (actualisation automatique).
- **Présence** : la TV envoie la même présence que le site (toutes les 20 s), visible dans les statistiques admin.

## Télécommande

| Touche | Dans les menus | Pendant une vidéo directe / TV | Pendant le lecteur intégré (Moviez) |
| --- | --- | --- | --- |
| Flèches | Se déplacer | Gauche/Droite : reculer/avancer (accélère si maintenu). Haut : commandes. Bas : épisodes. En TV : Haut/Bas zappent | Déplacer le pointeur |
| OK | Ouvrir / valider | Pause / lecture | Cliquer à l'endroit du pointeur (pause, ±10 s, sous-titres…) |
| OK maintenu ou Menu | Options (retirer de Reprendre, marquer vu, modifier un profil…) | Afficher les commandes | Menu de lecture |
| Retour | Revenir en arrière ; depuis l'accueil, quitter (avec confirmation) | Masquer les commandes, puis quitter | Menu de lecture (Quitter, épisodes, recharger) |
| Touches multimédia | — | Lecture/pause, avance/retour rapide, piste suivante/précédente, chaînes +/- | Lecture/pause |

Le lecteur Moviez est un lecteur externe : l'application ne peut pas lire sa position. Il se pilote donc
avec le pointeur. Les vidéos directes (mp4, m3u8) et la TV en direct utilisent le lecteur natif d'Android.

## Fluidité

- Catalogue gardé en mémoire et sur la TV : l'accueil s'affiche immédiatement au lancement suivant, puis se met à jour.
- Grilles virtualisées (seules les affiches visibles existent), affiches chargées autour de la sélection,
  images réduites à la taille de l'écran, cache mémoire et disque (200 Mo maximum).
- Touches maintenues limitées à une cadence régulière : pas d'accumulation, pas de saut.
- Tout le réseau passe en arrière-plan ; l'interface ne se bloque jamais pendant un chargement.

## Reconstruire

```powershell
cd C:\Users\Admin\yamonfilm-tv
.\build-apk.ps1
```

Le script réutilise en lecture seule les outils Android déjà présents dans `C:\Users\Admin\yamonfim\android-apk\.tools`
(sinon : `.\build-apk.ps1 -PrepareTools` les télécharge depuis les sources officielles). Il compile, lance les tests
(76 vérifications des règles métier), signe et vérifie l'APK.

**Important :** garder une copie du dossier `private` (clé de signature). Sans elle, les prochaines versions
ne pourront pas être installées par-dessus celle-ci.

## Vérifications faites

- Compilation, conversion DEX, signature v2/v3 et alignement vérifiés.
- 76 vérifications Java reprenant les tests du site (recherche, quota, doublons, lecteur, remise à zéro du dimanche).
- Requêtes Supabase (pagination du catalogue, filtres) essayées sur la vraie base.

**Non vérifié :** l'application n'a pas encore tourné sur une TV ni sur un émulateur (espace disque insuffisant
sur ce PC pour l'émulateur). Connexion réelle, lecture Moviez et fluidité sont à confirmer sur la télévision.
