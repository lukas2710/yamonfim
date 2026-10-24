import type { Metadata } from 'next';
import LegalPage, { Section } from '@/components/LegalPage';
import { LEGAL } from '@/lib/legal';

export const metadata: Metadata = { title: 'Mentions légales · YAMONFIM' };

export default function MentionsLegales() {
  return <LegalPage title="Mentions légales" current="/mentions-legales">
    <Section title="Éditeur du site">
      <p>Le site <strong>{LEGAL.siteName}</strong> ({LEGAL.siteUrl}) est édité par :</p>
      <ul><li>{LEGAL.publisher}</li><li>Statut : {LEGAL.status}</li><li>Adresse : {LEGAL.address}</li><li>SIRET : {LEGAL.siret}</li><li>TVA : {LEGAL.vat}</li><li>Contact : {LEGAL.email}</li></ul>
      <p>Directeur de la publication : {LEGAL.director}.</p>
    </Section>
    <Section title="Hébergement">
      <p>Le site est hébergé par {LEGAL.host}.</p>
      <p>Les données des comptes sont stockées par Supabase Inc. (supabase.com). Les paiements sont traités par Stripe Payments Europe, Ltd., Dublin, Irlande (stripe.com).</p>
    </Section>
    <Section title="Propriété intellectuelle">
      <p>La marque, le logo, la charte graphique et les textes propres à {LEGAL.siteName} sont protégés. Toute reproduction sans autorisation est interdite.</p>
      <p>Les affiches, titres et descriptions des films et séries appartiennent à leurs ayants droit respectifs. Certaines informations proviennent de l’API TMDB ; ce site utilise l’API TMDB mais n’est ni approuvé ni certifié par TMDB.</p>
    </Section>
    <Section title="Signaler un contenu">
      <p>Si vous êtes titulaire de droits et estimez qu’un contenu porte atteinte à vos droits, ou si vous souhaitez signaler un contenu illicite, écrivez à {LEGAL.email} en précisant : votre identité, le contenu concerné (adresse de la page), les droits invoqués et les motifs du retrait. Toute notification fondée entraîne le retrait rapide du contenu concerné.</p>
    </Section>
    <Section title="Responsabilité">
      <p>L’éditeur s’efforce d’assurer l’exactitude des informations et la disponibilité du site, sans pouvoir garantir l’absence d’interruption ou d’erreur. Les liens vers des sites tiers n’engagent pas la responsabilité de l’éditeur.</p>
    </Section>
    <Section title="Droit applicable">
      <p>Les présentes mentions sont régies par le droit français.</p>
    </Section>
  </LegalPage>;
}
