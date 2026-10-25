# Catalogue films et séries vers VLC / IPTV

La table `media_streams` est séparée de `media`. Le script parcourt tout le catalogue existant, y compris chaque épisode, extrait les URL des iframes et récupère les flux Moviez. Il vérifie la durée de la sous-playlist par rapport à celle annoncée pour éviter d'enregistrer une courte publicité comme le film. Les liens vidéo directs sont également acceptés.

## Installation

1. Exécuter `migrations/20261025_media_streams.sql` dans le SQL Editor du projet Supabase.
2. Ajouter `SUPABASE_SERVICE_ROLE_KEY` à `.env.local` côté serveur/local uniquement. Ne jamais utiliser de préfixe `NEXT_PUBLIC_` pour cette clé. `NEXT_PUBLIC_SUPABASE_URL` doit aussi être défini.
3. Depuis la racine du projet, lancer avec Node 24 :

```powershell
node --env-file=.env.local scripts/sync-media-streams.mjs
```

Le processus récupère automatiquement tous les liens, remplit la table et crée `exports/catalogue.m3u`. Il recommence 30 minutes après la fin de chaque passage, tant qu'il reste lancé. Pour un seul passage, ajouter `--once`. Pour fonctionner en continu, le lancer sur un serveur persistant ; ce n'est pas une tâche de fond Vercel. `M3U_REFRESH_MINUTES` ajuste l'intervalle, `M3U_OUTPUT` le fichier de sortie.

## Limites à connaître

- Les liens Moviez expirent. Le fichier M3U contient des liens temporaires : le régénérer puis le recharger dans le lecteur. Ce fichier local n'est pas une URL IPTV permanente.
- `status = ready` signifie que la playlist ou réponse vidéo a été vérifiée, pas que tous les segments et pistes ont été lus par VLC. Certains fournisseurs peuvent lier leurs flux à une IP ; vérifier sur l'appareil cible.
- `status = error` et `error_message` indiquent les liens absents, lecteurs non pris en charge ou flux refusés. Ils sont retentés au passage suivant, sans être ajoutés à l'export.
- La récupération utilise la requête normale du lecteur Moviez, sans exécuter son JavaScript. Les playlists sont demandées sans l'ancien en-tête Referer IPTV incorrect, qui provoquait une playlist de remplacement. Un refus du fournisseur ou une durée incompatible produit une erreur, sans export. Les autres pages de lecteur sont signalées comme non vidéo.
- Sur un très grand catalogue, le premier passage peut durer longtemps et les premiers flux peuvent expirer avant sa fin ; les flux expirés sont exclus de l'export. Un lien IPTV permanent nécessiterait un service qui renouvelle le flux à chaque lecture.
- La table est réservée au serveur avec la clé service role. Aucun flux n'est rendu public dans le site.
