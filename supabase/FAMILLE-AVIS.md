# Profils enfants et avis visiteurs

Avant de publier le site et l’APK 2.4.3, appliquer `migrations/20261028_family_feedback.sql` dans l’éditeur SQL du projet Supabase. Cette migration ajoute les colonnes utilisées par le catalogue et par les profils. Sans elle, le nouveau catalogue ne peut pas charger.

Dans `/admin/famille`, valider les films et séries pour Kids ou Junior et compléter leur année. Tous les titres existants restent Standard par défaut : aucun classement enfant n’est déduit du genre Animation. Kids voit uniquement Kids ; Junior voit Kids et Junior. Une année déjà placée à la fin du titre entre parenthèses est récupérée automatiquement. Les nouveaux imports restent Standard jusqu’à validation.

Dans `/profiles` ou l’application TV, créer ou modifier un profil et choisir Standard, Kids ou Junior. Il s’agit d’un univers de contenu, sans verrouillage par code : le changement de profil reste libre. Les contenus hors public sont retirés du catalogue et refusés à l’ouverture de leur fiche de lecture. Les pages annexes web non adaptées et le lancement TV en direct sont réservés aux profils Standard. Ce mode ne remplace pas un contrôle parental avec authentification du parent.

Le questionnaire apparaît à l’accueil après cinq minutes. Il reste différé sur les autres pages et pendant une lecture, puis apparaît au retour à l’accueil. Fermer ou envoyer reporte le prochain affichage de cinq minutes. Les profils enfants ne reçoivent pas le questionnaire. La note, la provenance et le commentaire facultatif sont stockés dans `site_feedback`, avec lecture réservée à l’administrateur par RLS. `/admin/avis` affiche les réponses par pages de 100 ; les statistiques concernent les réponses chargées.

L’APK 2.4.3 conserve la signature existante et augmente le code de version à 15. Le lecteur réessaie les flux en erreur, change de source résolue quand possible et reprend la position. Un chargement natif bloqué pendant 25 secondes déclenche une récupération, avec trois tentatives maximum. Sans repère de générique, la lecture suivante attend la fin réelle ; elle traverse les saisons vides et passe à la saison suivante. La compatibilité des codecs dépend toujours de l’appareil et du flux ; une validation sur téléviseur réel reste nécessaire.

## Vérifications locales

- `node --import ./scripts/test-typescript-resolver.mjs --experimental-strip-types --test lib/*.test.mjs`
- `npm ci --prefix outputs/dom-tests`, puis `node outputs/family-feedback-check.cjs`
- `npx tsc --noEmit` et `npx next build --webpack`
- `powershell -File android-native-tv/build-apk.ps1` (outils Android et clé existante requis).
