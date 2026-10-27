# Bibliothèque des avatars

Exécuter `migrations/20261027_profile_avatars.sql` dans le SQL Editor du projet Supabase avant de déployer. La migration crée la table, le bucket public WebP et les politiques réservant les écritures au compte administrateur existant. Aucune modification de user_profiles n’est nécessaire.

Ouvrir `/admin/avatars` depuis la navigation administrateur. Importer une image JPG, PNG ou WebP de 15 Mo maximum, régler le cadrage, renseigner un nom et une catégorie existante ou nouvelle, puis publier. Le navigateur produit un carré WebP 512 × 512. La bibliothèque est commune à tous les comptes. Les profils conservent l’URL HTTPS de l’avatar choisi.

Les avatars importés apparaissent dans `/profiles` lors de la création ou de la modification. Les anciens avatars sont conservés. En cas d’indisponibilité de la bibliothèque, le sélecteur affiche les avatars habituels et un message.

Android TV : recompiler et distribuer une nouvelle version de l’APK pour bénéficier du chargement de la bibliothèque et du sélecteur défilant. La compilation Java seule ne met pas à jour l’APK déjà distribué.

## Modification et suppression

Les boutons Modifier et Supprimer sont disponibles sous chaque avatar importé. Modifier permet de changer le nom, la catégorie et, facultativement, de remplacer l’image avec un nouveau cadrage. Supprimer demande une confirmation puis retire l’avatar de la bibliothèque.

Les fichiers précédents sont conservés dans le stockage : les profils déjà créés enregistrent l’URL de leur photo et la conservent après modification ou suppression d’un avatar. La nouvelle version est proposée aux prochaines sélections. Les politiques de la migration initiale autorisent déjà ces opérations pour l’administrateur ; aucun nouveau SQL n’est nécessaire.

## Créer des catégories sans image

Exécuter une fois `migrations/20261027_avatar_categories.sql` pour ajouter la table des catégories et ses règles administrateur. Aucune donnée existante n’est modifiée. Recharger `/admin/avatars`, saisir un nom dans « Catégories d’avatars », puis cliquer « Ajouter la catégorie ». Le nom est conservé même sans avatar et devient disponible pour les prochains imports. Les doublons de casse sont refusés. Les catégories des avatars déjà importés restent proposées.

Les sélecteurs des membres et de la TV affichent une catégorie dès qu’elle contient un avatar ; les catégories vides sont préparées dans l’administration.
