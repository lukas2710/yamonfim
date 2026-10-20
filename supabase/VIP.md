# Passages sur la page VIP et suivi administrateur

Exécuter `migrations/20261020_vip_page_visits.sql` dans Supabase → SQL Editor,
puis déployer/recharger le code du site.

La page `/vip` enregistre une première et une dernière visite par compte connecté.
Admin VIP (`/admin-vip`) propose un filtre « Passés sur /vip » et une colonne de
dernière visite. Les membres sont relus toutes les 10 secondes lorsque l’onglet
est visible. Si Realtime est déjà configuré et autorisé pour ces tables, leurs
événements déclenchent également une actualisation. Les saisies non enregistrées
de l’administrateur sont conservées pendant ces actualisations.

Une visite n’est pas une confirmation de paiement. Le statut VIP affiché dans
Admin VIP vient de `profiles.is_vip`. La page `/vip` consulte ce statut toutes
les 5 secondes ; elle ne donne plus le VIP par simple ouverture de l’URL et ne
modifie plus les métadonnées utilisateur pour s’autoattribuer un accès.

Le projet ne contient actuellement aucun webhook Stripe vérifiant les paiements.
Sans cette intégration, l’administrateur doit vérifier le paiement puis activer
le compte dans Admin VIP. Les liens Stripe sont conservés. Une activation
automatique après paiement devra être faite côté serveur à partir d’un événement
Stripe signé, avec les clés serveur correspondantes, jamais à partir d’une visite
ou d’un paramètre fourni par le navigateur.

Le suivi commence à l’installation : il ne peut pas reconstituer les anciennes
visites non enregistrées. Les VIP déjà présents dans `profiles` restent visibles
dans « Comptes VIP », même s’ils n’ont aucune visite conservée sur `/vip`.
