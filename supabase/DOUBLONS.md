# Empêcher les doublons

Les pages Demandes et Administration vérifient les données du serveur juste avant l’enregistrement, même si elles étaient déjà ouvertes avant un autre ajout. Un double clic est verrouillé, et les vérifications lisent toutes les pages du catalogue. L’API administrateur applique aussi le contrôle.

Un contenu est identifié par son type (film ou série) et son numéro TMDB. Si l’un des numéros manque, le titre normalisé sert de secours : casse, accents, ponctuation, espaces et année entre parenthèses à la fin sont ignorés. Deux remakes ayant des identifiants TMDB différents restent autorisés. Modifier sa propre fiche reste possible.

Une demande est refusée si le contenu est déjà au catalogue ou possède une demande non refusée. Une ancienne demande refusée peut être proposée de nouveau. Ajouter un titre pour satisfaire une demande existante reste permis.

## Protection des ajouts simultanés

Exécuter `migrations/20261020_prevent_content_duplicates.sql` dans l’éditeur SQL Supabase. Ce script est préparé localement ; il n’a pas été exécuté sur la base distante.

Les déclencheurs vérifient toutes les lignes, y compris celles masquées par les règles de lecture, et sérialisent les contrôles du catalogue et des demandes pour chaque type. Ils refusent les écritures en double et renvoient un message compris par le site. Les changements de statut et l’édition des épisodes restent possibles. Aucun ancien doublon n’est supprimé automatiquement et aucune règle de lecture n’est élargie.

Avant l’installation du script, les contrôles du site sont actifs, mais deux écritures réellement simultanées depuis des clients différents ne bénéficient pas encore de cette protection en base.
