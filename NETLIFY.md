# Déploiement Netlify

Connecter le dépôt GitHub `lukas2710/yamonfim`, branche `main`, avec le dossier racine du dépôt comme base. Le fichier `netlify.toml` configure la compilation Next.js. Netlify installe automatiquement son adaptateur OpenNext ; les routes API nécessitent cet adaptateur, sans export statique.

Définir les variables serveur dans Netlify, pour les fonctions et la compilation, avant le déploiement :

- `TMDB_API_KEY` : identifiants des séries et recherche de minutages.
- `SUPABASE_SERVICE_ROLE_KEY` : enregistrement des minutages et opérations administrateur. Ne jamais utiliser le préfixe `NEXT_PUBLIC_` pour cette clé.
- `STRIPE_SECRET_KEY` et les autres variables Stripe utilisées par les routes de paiement, si le paiement est activé.
- `UNSUBSCRIBE_SECRET`, si une clé distincte était utilisée pour les liens de désabonnement : conserver la même valeur pour préserver les liens existants.

La base Supabase existante reste la même ; aucune suppression ni migration de films n'est nécessaire. Ajouter le nouveau domaine dans les URL autorisées de Supabase Auth et vérifier les URL des webhooks Stripe.

Le site de production est https://yamonfi.netlify.app/. L'application Android TV 2.4.2 utilise cette adresse pour les flux, les minutages et les liens du site. Installer cette mise à jour sur les téléviseurs pour remplacer l'ancienne adresse Vercel.


## Vérification des paiements après changement de domaine

Les retours du Checkout intégré utilisent le domaine de la requête et s’adaptent à la nouvelle adresse. Les Payment Links Stripe restent des liens externes ; leur redirection et leur configuration se vérifient dans Stripe.

Dans Netlify, vérifier les variables serveur `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` et `SUPABASE_SERVICE_ROLE_KEY`. `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` active le paiement intégré et doit être disponible pendant la compilation ; son changement nécessite un nouveau déploiement.

Dans Stripe, vérifier une destination webhook active vers `https://yamonfi.netlify.app/api/stripe/webhook`, pour `checkout.session.completed` et `checkout.session.async_payment_succeeded`. Le secret de signature de cette destination doit correspondre à `STRIPE_WEBHOOK_SECRET`. Une redirection depuis l’ancien domaine ne suffit pas pour les webhooks Stripe.

Vérifier séparément le paiement reçu dans Stripe et l’activation effective du VIP dans Supabase. Le code seul ne permet pas de certifier la configuration distante ni un paiement réel. Le retour du Checkout intégré propose également une confirmation serveur ; les Payment Links doivent être vérifiés séparément.
