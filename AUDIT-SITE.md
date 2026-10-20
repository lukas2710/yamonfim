# Revue du site — 20 octobre 2026

## Corrections

- Navigation d’accueil : suppression du chevauchement entre liens et boutons sur tablette ; recherche mobile sur sa propre ligne.
- Admin VIP : tableau transformé en fiches sur téléphone, chargement paginé des comptes et visites, disparition de l’erreur de suivi après une actualisation réussie.
- Profils : actions accessibles au toucher et au clavier, retour d’erreur, verrouillage pendant l’enregistrement, suppression du profil actif après changement de compte. Une annulation ou une erreur de suppression ne ferme plus le formulaire.
- Accès vidéo : la chaîne « false » reste un compte gratuit ; un échec de vérification de l’accès bloque la lecture avec un message ; exemption de quota cohérente pour l’administrateur. L’adresse du lecteur est conservée dans un état React.
- Promotions : programmation et expiration réévaluées automatiquement, compte à rebours sans différence entre le premier rendu serveur et navigateur.
- TV : erreurs de chargement visibles avec nouvelle tentative, filtre par catégorie, lecture intégrée sur mobile, nettoyage des lecteurs et des événements, fermeture avec Échap.
- Relais TV : résolution des chemins des segments, sous-listes et clés HLS ; transmission des segments en continu et des plages HTTP. Validation des destinations publiques, résolution DNS fixée pour la connexion, contrôle des redirections, limites de lecture des réponses texte et refus des pages HTML dans le relais.
- Extraction de lecteur : résolution des liens relatifs depuis l’adresse finale de la page et contrôle des destinations.
- Ancienne API catalogue : remplacement de la simulation en mémoire par Supabase, vérification de session et contrôle administrateur avant ajout.
- Erreurs de chargement désormais affichées dans les bannières, le catalogue administrateur, les demandes et les signalements.

## Contrôles

- TypeScript et compilation de production Next.js.
- 53 tests sur les statistiques, les offres et dates, la synchronisation VIP, les listes HLS, les adresses privées, les limites de réponse, les quotas de lecture, le suivi des épisodes, le chrono estimé avec pause/reprise et la détection des doublons. Le script anti-doublons a aussi passé 15 contrôles dans un PostgreSQL temporaire, sans accès aux données du site.
- Quota de lecture : les VIP ne consomment pas de visionnage gratuit. Un compte gratuit dispose de cinq lancements de films ou épisodes par période ; le sixième est refusé, y compris lors d’un changement d’épisode ou de lectures simultanées. La réservation utilise une mise à jour conditionnelle du compteur en base. La remise à zéro hebdomadaire existante dépend de la migration des abonnements.
- Contrôle des mises en page de 15 pages : accueil, connexion, profils, historique, demandes, signalements, TV, lecteur, abonnement, retour VIP, catalogue administrateur, Admin VIP, promotions, bannières et statistiques.
- Formats contrôlés : 320, 375, 768 et 1 440 pixels. Les vues réservées aux membres et administrateurs utilisent des données fictives, sans modifier de vrais comptes.

## Limites de validation

Cette revue ne garantit pas l’absence de tout défaut. Les paiements, les permissions Supabase, les migrations SQL déjà préparées et les lectures de tous les diffuseurs n’ont pas été validés en conditions réelles. Certains diffuseurs peuvent refuser le relais ou imposer une restriction géographique.

La base de code conserve des remarques de lint historiques sur le typage `any`, les textes JSX, les dépendances et conventions React. La compilation TypeScript ne remplace pas un contrôle complet de ces remarques. Aucun contournement global des règles de lint n’a été ajouté.
