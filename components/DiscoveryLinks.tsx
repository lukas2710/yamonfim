import Link from 'next/link';

export default function DiscoveryLinks() {
  return <section className="yf-discovery"><div className="yf-discovery-heading"><p className="yf-eyebrow">BIENVENUE DANS TON CINÉMA</p><h2>Ce soir, on fait quoi ?</h2><p>Retrouve tes histoires. Propose les prochaines. Ou profite du VIP.</p></div><div className="yf-discovery-grid">{[
    { href: '/history', number: '01', label: 'LA SUITE T’ATTEND', title: 'Reprends le fil.', description: 'Retrouve les films et les épisodes de ton historique.', icon: '↺' },
    { href: '/requests', number: '02', label: 'À TOI DE PROGRAMMER', title: 'Fais-nous une envie.', description: 'Le titre que tu cherches manque à l’appel ? Propose-le.', icon: '+' },
    { href: '/abonnement', number: '03', label: 'LE PLAISIR SANS QUOTA', title: 'Passe au premier rang.', description: 'Découvre les formules VIP et choisis ton rythme.', icon: '✳' },
  ].map(item => <Link key={item.href} href={item.href} className="yf-discovery-card"><div><span>{item.number}</span><span aria-hidden="true">{item.icon}</span></div><p>{item.label}</p><h3>{item.title}</h3><span className="yf-discovery-description">{item.description}</span><span className="yf-discovery-bottom">Découvrir <span aria-hidden="true">↗</span></span></Link>)}</div></section>;
}
