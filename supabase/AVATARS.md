# Bibliothèque des avatars

Exécuter `migrations/20261027_profile_avatars.sql` dans le SQL Editor du projet Supabase avant de déployer. La migration crée la table, le bucket public WebP et les politiques réservant les écritures au compte administrateur existant. Aucune modification de user_profiles n’est nécessaire.

Ouvrir `/admin/avatars` depuis la navigation administrateur. Importer une image JPG, PNG ou WebP de 15 Mo maximum, régler le cadrage, renseigner un nom et une catégorie existante ou nouvelle, puis publier. Le navigateur produit un carré WebP 512 × 512. La bibliothèque est commune à tous les comptes. Les profils conservent l’URL HTTPS de l’avatar choisi.

Les avatars importés apparaissent dans `/profiles` lors de la création ou de la modification. Les anciens avatars sont conservés. En cas d’indisponibilité de la bibliothèque, le sélecteur affiche les avatars habituels et un message.

Android TV : recompiler et distribuer une nouvelle version de l’APK pour bénéficier du chargement de la bibliothèque et du sélecteur défilant. La compilation Java seule ne met pas à jour l’APK déjà distribué.
