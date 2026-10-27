# Activation depuis /vip

Comportement demandé : ouvrir `/vip` active gratuitement un an de VIP pour le compte connecté, sans vérifier un paiement Stripe. Une nouvelle ouverture relance la période d’un an, comme le prévoyait la page initiale.

Exécuter `migrations/20261027_vip_page_activation.sql` dans Supabase → SQL Editor, puis déployer le site. Cette migration ajoute uniquement la fonction `activate_my_vip()`. Elle ne modifie aucun compte au moment de son installation et conserve les politiques RLS existantes.

Lorsqu’un membre ouvre `/vip`, la fonction met à jour uniquement la ligne `profiles` correspondant à `auth.uid()` : `is_vip = true`, `vip_started_at = now()`, `vip_duration = '1y'`. Aucun identifiant de compte ni durée ne sont acceptés en paramètre. Les visiteurs non connectés ne peuvent pas appeler cette fonction.

La page vérifie ensuite le statut enregistré avant d’afficher le succès et de revenir à l’accueil. En cas de migration manquante, elle affiche une erreur explicite. Les quotas, les autres comptes et les profils de visionnage ne sont pas modifiés.

L’activation offerte par cette page est indépendante de Stripe. Les réglages de paiement et de webhook restent à vérifier séparément.
