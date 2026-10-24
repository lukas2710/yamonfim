import type { Metadata } from 'next';
import LegalPage, { Section } from '@/components/LegalPage';
import { LEGAL } from '@/lib/legal';
import { PLANS, formatEuro } from '@/app/abonnement/plans';

export const metadata: Metadata = { title: 'Conditions générales · YAMONFIM' };

export default function Conditions() {
  return <LegalPage title="Conditions générales d’utilisation et de vente" current="/conditions">
    <Section title="1. Objet">
      <p>Les présentes conditions régissent l’utilisation du site {LEGAL.siteName} et la souscription de l’accès VIP, entre l’éditeur ({LEGAL.publisher}) et toute personne créant un compte (« le membre »). Créer un compte ou payer un accès VIP implique leur acceptation.</p>
    </Section>
    <Section title="2. Compte">
      <p>Le compte est personnel. Le membre fournit une adresse email valide, garde son mot de passe confidentiel et reste responsable de l’usage de son compte. Le partage ou la revente d’un accès est interdit.</p>
    </Section>
    <Section title="3. Accès gratuit">
      <p>Un compte gratuit donne droit à un nombre limité de visions par semaine, remis à zéro chaque dimanche à 00 h (heure de Paris). L’éditeur peut faire évoluer ce quota.</p>
    </Section>
    <Section title="4. Offres VIP et prix">
      <p>L’accès VIP supprime le quota de visionnage pendant la durée choisie :</p>
      <ul>{PLANS.map(plan => <li key={plan.id}>VIP {plan.name} : {formatEuro(plan.price)} TTC</li>)}</ul>
      <p>Le prix applicable est celui affiché au moment du paiement. Le montant exact est confirmé sur la page de paiement avant validation.</p>
    </Section>
    <Section title="5. Paiement et activation">
      <p>Le paiement s’effectue par carte via Stripe, prestataire sécurisé. L’accès VIP est activé sur le compte utilisé pour payer, en principe immédiatement et au plus tard sous 24 heures. En cas de souci d’activation, contactez {LEGAL.email} avec votre reçu.</p>
    </Section>
    <Section title="6. Droit de rétractation">
      <p>Conformément à l’article L221-28 13° du Code de la consommation, le droit de rétractation de 14 jours ne peut pas être exercé pour un contenu numérique fourni immédiatement, lorsque le membre a donné son accord exprès pour cette exécution immédiate et reconnu perdre son droit de rétractation. En validant son paiement, le membre demande l’accès immédiat à son VIP et renonce à ce droit. Avant cet accord, ou si l’accès n’a pas été activé, le membre peut demander le remboursement à {LEGAL.email}.</p>
    </Section>
    <Section title="7. Disponibilité">
      <p>L’éditeur fait ses meilleurs efforts pour que le site et les contenus soient accessibles, sans garantie de disponibilité permanente. Le catalogue peut évoluer : des titres peuvent être ajoutés ou retirés. En cas d’interruption totale du service de plus de 7 jours imputable à l’éditeur, la durée VIP est prolongée d’autant.</p>
    </Section>
    <Section title="8. Règles de la communauté">
      <p>Les avis, commentaires et demandes doivent rester respectueux. Sont interdits les propos injurieux, discriminatoires, illicites, la publicité et les données personnelles de tiers. L’éditeur peut supprimer tout contenu contraire et suspendre le compte concerné.</p>
    </Section>
    <Section title="9. Usage interdit">
      <p>Il est interdit de tenter de contourner le quota ou les protections du site, d’extraire massivement ses contenus, de l’attaquer ou d’en perturber le fonctionnement. Tout manquement peut entraîner la suspension du compte, sans remboursement, et des poursuites.</p>
    </Section>
    <Section title="10. Résiliation et suppression du compte">
      <p>Le membre peut demander la suppression de son compte à tout moment à {LEGAL.email}. La période VIP en cours n’est pas remboursée, sauf manquement de l’éditeur.</p>
    </Section>
    <Section title="11. Réclamations, médiation et droit applicable">
      <p>Toute réclamation est à adresser à {LEGAL.email}. En cas de litige non résolu, le membre consommateur peut recourir gratuitement à un médiateur de la consommation : À COMPLÉTER (nom et site du médiateur choisi). Les présentes conditions sont soumises au droit français.</p>
    </Section>
  </LegalPage>;
}
