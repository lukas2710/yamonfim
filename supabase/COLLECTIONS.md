# Activer les collections

La page admin est disponible à `/admin/collections`, depuis le menu admin de l’accueil et la navigation de l’administration.

## Activation unique dans Supabase

Dans le projet Supabase du site, ouvrir **SQL Editor**, coller le contenu de `supabase/migrations/20261021_media_collections.sql`, puis l’exécuter. Actualiser ensuite la page admin des collections.

Cette migration crée uniquement la table `media_collections`, ses contraintes et ses règles de sécurité. Elle ne modifie ni ne supprime les films, les comptes, les quotas ou les historiques existants. Elle peut être relancée.

Les membres connectés lisent seulement les collections publiées. Seul le compte admin existant `lukas.leclerc312@gmail.com`, vérifié via le jeton Supabase, peut créer, modifier ou masquer les collections. Un membre ne peut pas contourner cette protection en appelant directement Supabase.

## Créer une collection

1. Donner un nom (ex. Fast & Furious ou Star Wars) et éventuellement une description et un lien de couverture.
2. Rechercher et sélectionner les films et séries déjà présents dans le catalogue. Les doublons sont évités.
3. Définir l’ordre des titres avec les flèches et l’ordre de la collection sur l’accueil (les petits nombres passent en premier).
4. Publier, ou décocher « Visible sur l’accueil » pour conserver un brouillon.

Sans couverture personnalisée, le premier titre fournit son image. Les titres supprimés du catalogue ne sont plus affichés ; une collection sans titre disponible reste cachée aux membres.

Sur l’accueil, une case ouvre la liste des titres dans l’ordre choisi. Le clic sur un titre utilise le parcours existant, y compris la promotion VIP si le quota gratuit est atteint. Les collections n’ajoutent aucune lecture au quota.

L’admin peut modifier ou masquer une collection sans toucher aux titres du catalogue. Le contenu n’est pas ajouté automatiquement à partir du nom de la saga : l’admin choisit exactement les films et séries disponibles à inclure.
