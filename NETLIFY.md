# Déploiement Netlify

Connecter le dépôt GitHub `lukas2710/yamonfim`, branche `main`, avec le dossier racine du dépôt comme base. Le fichier `netlify.toml` configure la compilation Next.js. Netlify installe automatiquement son adaptateur OpenNext ; les routes API nécessitent cet adaptateur, sans export statique.

Définir les variables serveur dans Netlify, pour les fonctions et la compilation, avant le déploiement :

- `TMDB_API_KEY` : identifiants des séries et recherche de minutages.
- `SUPABASE_SERVICE_ROLE_KEY` : enregistrement des minutages et opérations administrateur. Ne jamais utiliser le préfixe `NEXT_PUBLIC_` pour cette clé.
- `STRIPE_SECRET_KEY` et les autres variables Stripe utilisées par les routes de paiement, si le paiement est activé.
- `UNSUBSCRIBE_SECRET`, si une clé distincte était utilisée pour les liens de désabonnement : conserver la même valeur pour préserver les liens existants.

La base Supabase existante reste la même ; aucune suppression ni migration de films n'est nécessaire. Ajouter le nouveau domaine dans les URL autorisées de Supabase Auth et vérifier les URL des webhooks Stripe.

Le site de production est https://yamonfi.netlify.app/. L'application Android TV 2.4.2 utilise cette adresse pour les flux, les minutages et les liens du site. Installer cette mise à jour sur les téléviseurs pour remplacer l'ancienne adresse Vercel.
