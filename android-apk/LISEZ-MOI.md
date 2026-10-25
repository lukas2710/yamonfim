# YAMONFILM pour Android

Application séparée du site, créée dans ce dossier uniquement.

**Fichier à installer :** `release/YAMONFILM-1.0.0.apk`  
**Site utilisé :** https://yamonfim.vercel.app/  
**Compatibilité minimale :** Android 8.0 (API 26).  
**Identifiant Android :** `app.yamonfim.android`.

## Installation sur un téléphone

1. Transférer uniquement le fichier APK sur le téléphone Android, par câble ou par un moyen de partage de fichiers.
2. Ouvrir ce fichier sur le téléphone et suivre les étapes d’installation Android. Si Android le demande, autoriser cette installation pour l’application utilisée pour ouvrir le fichier.
3. Ouvrir **YAMONFILM** et se connecter avec son compte du site.

La connexion Android est distincte de celle du navigateur : il faut se connecter une première fois dans l’application. Les comptes, le VIP, les quotas et l’historique utilisent ensuite le même site et la même base Supabase. Internet reste nécessaire ; les films ne sont pas téléchargés dans l’APK.

## Ce que contient l’application

- Le site complet, sans barre d’adresse du navigateur.
- L’icône du site, copiée dans les ressources de l’application.
- La gestion du bouton Retour Android et du plein écran vidéo.
- Un écran de connexion indisponible avec un bouton Réessayer.
- La conservation du stockage web et des cookies de connexion.
- L’ouverture des liens HTTPS externes, notamment de paiement, dans le navigateur.
- La prise en charge du choix de fichiers lorsque le site le demande.

Les nouvelles pages publiées sur le site sont disponibles dans l’application sans reconstruire l’APK. Les changements propres à l’application Android, eux, nécessitent un nouvel APK.

## Reconstruire l’APK sur ce PC

Depuis PowerShell :

```powershell
cd C:\Users\Admin\yamonfim\android-apk
.\build-apk.ps1
```

Si les outils locaux ont été supprimés :

```powershell
.\build-apk.ps1 -PrepareTools
```

Le script utilise seulement les outils officiels Google Android SDK et Microsoft OpenJDK, placés dans `.tools`. Il ne lance pas de commande dans le site et ne change pas sa configuration. Les empreintes des téléchargements sont contrôlées. Les avis et licences des outils téléchargés sont présents dans leurs archives et répertoires d’installation.

Les sources Android sont dans `app/src/main`. L’adresse du site est définie dans `NavigationPolicy.java`. Pour préparer une nouvelle version, augmenter `versionCode` et `versionName` dans le manifeste et adapter le nom de l’APK dans le script de compilation.

## Conserver les futures mises à jour

Garder une sauvegarde privée du dossier **`private`** : il contient la clé et le mot de passe de signature. Ils permettent de signer les prochaines versions avec la même identité Android. Ne partager que l’APK avec les utilisateurs, pas ce dossier. Les outils, fichiers temporaires, APK et secrets de signature sont exclus de Git par le `.gitignore` de ce dossier.

## Vérifications réalisées

- Compilation des sources Java et conversion en DEX Android.
- 16 vérifications de navigation : domaine du site, liens externes et refus des URL non autorisées.
- Lecture du manifeste final : application lançable, version 1.0.0, Android 8 minimum, cible API 35.
- Vérification du contenu de l’archive APK et de l’alignement des ressources.
- Signature de diffusion locale RSA 3072, vérifiée avec les schémas Android v2 et v3.
- Empreinte de l’APK disponible dans `release/SHA256.txt`.
- Aucun fichier suivi du site modifié : seul le nouveau dossier `android-apk` a été ajouté.

L’APK n’a pas encore été lancé sur un téléphone réel ni dans un émulateur. La lecture des fournisseurs intégrés (notamment Moviez), le plein écran et les paiements restent à essayer sur le téléphone avant une diffusion large. Le site conserve sa logique existante ; un fournisseur peut avoir des restrictions particulières dans Android WebView.

Cet APK est destiné à l’installation directe. Aucune publication sur Google Play n’a été effectuée.

Documentation des outils : [Android WebView](https://developer.android.com/develop/ui/views/layout/webapps/webview), [AAPT2](https://developer.android.com/tools/aapt2), [D8](https://developer.android.com/tools/d8), [signature APK](https://developer.android.com/tools/apksigner), [Microsoft OpenJDK](https://learn.microsoft.com/en-us/java/openjdk/download).
