# Activer les connectés uniques par jour

1. Dans le projet Supabase du site, ouvrir **SQL Editor**.
2. Copier le contenu de `migrations/20261020_daily_activity.sql` et l’exécuter.
3. Exécuter ensuite `migrations/20261020_sync_presence_daily.sql`. Ce correctif
   est également nécessaire si le premier script avait déjà été installé.
4. Recharger le site avec un compte connecté, puis ouvrir `/admin/stats`.

Ce script crée la table `user_daily_activity` et la fonction `record_daily_presence`.
Le suivi exact commence après installation. Il ne reconstitue pas les connexions passées.
Il ne change pas les tables existantes. Il peut être relancé.

Chaque compte authentifié présent sur un onglet visible est compté une seule fois
par jour civil à Paris, même avec plusieurs profils, appareils ou onglets. Les
visiteurs non connectés ne sont pas comptés. La présence inclut l’administrateur.
La date et l’identité sont déterminées côté serveur. La sécurité par ligne permet
à un membre d’enregistrer uniquement sa présence du jour et à l’administrateur
de consulter les données de tous les comptes.

Le compteur du jour et la présence récente sont relus toutes les 15 secondes
tant que la page est visible et l’actualisation automatique activée. Le site
envoie ses signaux de présence toutes les 20 secondes : ce n’est pas instantané.

Le correctif crée un déclencheur sur `user_presence` : chaque signal enregistre
aussi la présence quotidienne côté serveur, y compris pour les anciens clients.
Il récupère également les comptes déjà présents aujourd’hui. L’identité est
dédupliquée par compte et jour : une personne déjà enregistrée n’est pas ajoutée
une seconde fois.

Le tableau de bord rapproche les présences connues du jour et les enregistrements
quotidiens, en faisant l’union des identifiants des comptes. Il conserve aussi
les comptes observés pendant l’ouverture de la page pour que le total ne baisse
pas entre deux relevés. Si le stockage quotidien est indisponible, le symbole
« ≥ » signale un minimum documenté. Le déclencheur reste nécessaire pour
conserver toutes les présences après fermeture du tableau de bord.

La section « Connexions retrouvées depuis les premières traces » fonctionne
aussi avec les anciennes données. Elle regroupe, par compte et jour à Paris,
les dates conservées dans `watch_history` (`created_at`, `updated_at`, `watched_at`)
et la dernière présence de `user_presence`. Elle ne compte pas les dates de
création des médias ou des comptes comme des connexions. Elle montre des nombres
minimums et ne produit pas de zéro pour les jours sans trace. L’export CSV de cette
section respecte la période sélectionnée et inclut toutes les dates documentées.
Le bouton « Depuis la première trace » permet de remonter au plus ancien relevé
disponible. Cela ne garantit pas de remonter au lancement du site : les traces
effacées ou écrasées ne sont pas reconstituables avec les tables actuelles.

Le tableau de bord charge toutes les pages de résultats et signale les erreurs
de lecture. Les autres tables doivent déjà autoriser l’administrateur à les lire
via leurs règles Supabase. Le script ne modifie pas leurs autorisations.

L’historique du lecteur met à jour une seule ligne par compte/profil/titre.
Ses statistiques décrivent les progressions conservées et leurs dernières dates,
pas le nombre de vues, les visites du site ni le temps réel de visionnage. Pour
les séries, le pourcentage concerne l’épisode actuellement sauvegardé.

Les connexions quotidiennes sont indépendantes du filtre films/séries. Les
exports CSV respectent la sélection ; l’export JSON contient les données chargées
et indique les éventuelles sources indisponibles. Ce n’est pas une sauvegarde
complète du projet Supabase.

Vérification locale des calculs :

```text
node --experimental-strip-types --test app/admin/stats/analytics.test.mjs
```
