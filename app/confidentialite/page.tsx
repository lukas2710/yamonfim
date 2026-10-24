import type { Metadata } from 'next';
import LegalPage, { Section } from '@/components/LegalPage';
import { LEGAL } from '@/lib/legal';

export const metadata: Metadata = { title: 'Politique de confidentialité · YAMONFIM' };

export default function Confidentialite() {
  return <LegalPage title="Politique de confidentialité" current="/confidentialite">
    <Section title="Responsable du traitement">
      <p>{LEGAL.publisher}, {LEGAL.address}. Contact pour toute question sur vos données : {LEGAL.email}.</p>
    </Section>
    <Section title="Données collectées et pourquoi">
      <ul>
        <li><strong>Compte</strong> : adresse email, mot de passe chiffré, date d’inscription — pour créer et sécuriser votre compte (exécution du contrat).</li>
        <li><strong>Profils de visionnage</strong> : nom et avatar choisis — pour personnaliser votre espace (contrat).</li>
        <li><strong>Activité</strong> : titres regardés, progression, épisodes vus, nombre de visions gratuites — pour reprendre la lecture et appliquer le quota (contrat).</li>
        <li><strong>Présence</strong> : dernière activité sur le site — pour la sécurité et des statistiques de fréquentation agrégées (intérêt légitime).</li>
        <li><strong>Contributions</strong> : avis, commentaires, demandes de contenus et signalements, avec le pseudo ou l’adresse affichés — pour la vie de la communauté (contrat).</li>
        <li><strong>Abonnement VIP</strong> : formule, dates de début et de fin. Le paiement est réalisé chez Stripe : {LEGAL.siteName} ne reçoit jamais vos coordonnées bancaires (contrat, obligations comptables).</li>
      </ul>
    </Section>
    <Section title="Emails de nouveautés et d’offres">
      <ul>
        <li><strong>Membres</strong> : vous ne recevez nos nouveautés et offres par email que si vous l’avez accepté (case à l’inscription, invitation sur le site ou page Mon abonnement). Ce choix est facultatif et sans effet sur votre compte (consentement).</li>
        <li><strong>Clients VIP</strong> : après un achat, nous pouvons vous proposer par email des offres VIP similaires, sauf si vous vous y opposez (intérêt légitime, article L34-5 du Code des postes et des communications électroniques).</li>
      </ul>
      <p>Chaque email contient un lien de désinscription immédiate. Vous pouvez aussi changer d’avis à tout moment depuis la page Mon abonnement ou en écrivant à {LEGAL.email}. Votre adresse n’est jamais vendue ni transmise à des tiers pour leur propre prospection. Sans réponse à nos emails pendant 3 ans, nous cessons de vous écrire.</p>
    </Section>
    <Section title="Destinataires et sous-traitants">
      <p>Vos données ne sont ni vendues ni louées. Elles sont accessibles à l’éditeur et à ses prestataires techniques : Supabase (base de données et authentification), Vercel (hébergement et mesure d’audience anonyme), Stripe (paiement). Certains prestataires sont situés hors de l’Union européenne ; les transferts sont encadrés par les clauses contractuelles types de la Commission européenne ou le cadre de protection des données UE–États-Unis.</p>
    </Section>
    <Section title="Durées de conservation">
      <ul>
        <li>Compte et activité : tant que le compte est actif, puis suppression dans les 3 ans suivant la dernière connexion.</li>
        <li>Données de facturation : 10 ans (obligation légale comptable).</li>
        <li>Présence quotidienne : 13 mois maximum.</li>
      </ul>
    </Section>
    <Section title="Cookies et stockage local">
      <p>Le site utilise uniquement des éléments nécessaires à son fonctionnement : maintien de la connexion, profil choisi, préférences d’affichage (stockage local du navigateur). La mesure d’audience Vercel Analytics ne dépose pas de cookie et ne vous identifie pas. Aucun cookie publicitaire n’est utilisé, aucun consentement n’est donc requis.</p>
    </Section>
    <Section title="Vos droits">
      <p>Vous pouvez accéder à vos données, les rectifier, les supprimer, vous opposer à certains traitements, en demander la limitation ou la portabilité, et définir des directives après votre décès. Écrivez à {LEGAL.email} depuis l’adresse de votre compte ; une réponse vous sera apportée sous un mois.</p>
      <p>Si vous estimez que vos droits ne sont pas respectés, vous pouvez saisir la CNIL (cnil.fr, 3 place de Fontenoy, 75007 Paris).</p>
    </Section>
    <Section title="Sécurité">
      <p>Les échanges sont chiffrés (HTTPS), les mots de passe ne sont jamais stockés en clair et l’accès aux données de chaque compte est limité à son titulaire et à l’administrateur.</p>
    </Section>
  </LegalPage>;
}
