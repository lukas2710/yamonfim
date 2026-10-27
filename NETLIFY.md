# Déploiement Netlify

Connecter le dépôt GitHub `lukas2710/yamonfim`, branche `main`, avec le dossier racine du dépôt comme base. Le fichier `netlify.toml` configure la compilation Next.js. Netlify installe automatiquement son adaptateur OpenNext ; les routes API nécessitent cet adaptateur, sans export statique.

Définir les variables serveur dans Netlify, pour les fonctions et la compilation, avant le déploiement :

- `TMDB_API_KEY` : identifiants des séries et recherche de minutages.
- `SUPABASE_SERVICE_ROLE_KEY` : enregistrement des minutages et opérations administrateur. Ne jamais utiliser le préfixe `NEXT_PUBLIC_` pour cette clé.
- `STRIPE_SECRET_KEY` et les autres variables Stripe utilisées par les routes de paiement, si le paiement est activé.
- `UNSUBSCRIBE_SECRET`, si une clé distincte était utilisée pour les liens de désabonnement : conserver la même valeur pour préserver les liens existants.

La base Supabase existante reste la même ; aucune suppression ni migration de films n'est nécessaire. Ajouter le nouveau domaine dans les URL autorisées de Supabase Auth et vérifier les URL des webhooks Stripe.

L'application Android TV actuelle contient encore l'adresse Vercel. Dès que le domaine Netlify définitif est connu, remplacer les adresses du site et les contrôles d'hôte dans les sources Android, reconstruire l'APK avec la clé de signature existante, puis publier la mise à jour.
