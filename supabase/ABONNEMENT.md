# Activer le compte à rebours et les avis

Dans Supabase → SQL Editor, exécuter une fois
`migrations/20261020_subscription_experience.sql`, puis recharger le site.

Le script ajoute une échéance de quota gratuite à chaque compte et une fonction
qui renouvelle le quota expiré à la prochaine consultation du compte. L’accueil,
le lecteur et la page Abonnement utilisent cette fonction. La semaine se termine
le dimanche à 00 h, heure de Paris, avec prise en compte des changements d’heure.
Le renouvellement ne dépend donc pas d’un onglet resté ouvert. Le membre ne peut
pas modifier l’échéance par une mise à jour directe du profil.

Avant l’installation, les lectures de profil existantes continuent de fonctionner
et le compte à rebours affiche un horaire prévu. Il ne faut pas considérer ce
compte à rebours comme une preuve de remise à zéro tant que le script n’est pas
installé. Les prix, liens Stripe et règles de durée des forfaits sont conservés.

Les avis sont stockés dans `site_reviews`, sans témoignages prédéfinis. Un compte
connecté peut créer et modifier son propre avis (1 à 5 étoiles). Le pseudo et le
commentaire sont visibles par les membres, sans exposer l’adresse email dans les
cartes d’avis. Les notes basses sont acceptées. La moyenne indique explicitement
qu’elle porte sur les 12 derniers avis affichés, avec le nombre total à côté.
Les avis ne sont pas présentés comme des achats vérifiés : aucun contrôle de
paiement ne permet actuellement de justifier cette mention.

L’activation effective d’un abonnement reste celle du site existant. Cette
modification ne remplace pas le parcours Stripe ni son traitement après paiement.
