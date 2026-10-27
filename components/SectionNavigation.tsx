'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const MEMBER_LINKS = [
  { href: '/', label: 'Catalogue' },
  { href: '/history', label: 'Mon historique' },
  { href: '/requests', label: 'Demandes' },
  { href: '/tv', label: 'TV en direct' },
  { href: '/abonnement', label: 'Abonnement VIP' },
  { href: '/report', label: 'Assistance' },
];
const ADMIN_LINKS = [
  { href: '/admin', label: 'Catalogue' },
  { href: '/admin/accueil', label: 'Carrousel' },
  { href: '/admin/banners', label: 'Bannières' },
  { href: '/admin/collections', label: 'Collections' },
  { href: '/admin/generiques', label: 'Génériques' },
  { href: '/admin/promotions', label: 'Promotions' },
  { href: '/admin-vip', label: 'Membres & VIP' },
  { href: '/admin/stats', label: 'Statistiques' },
];

export default function SectionNavigation({ admin = false }: { admin?: boolean }) {
  const pathname = usePathname();
  return <nav className="yf-section-nav" aria-label={admin ? 'Sections de l’administration' : 'Sections du site'}>
    <div className="yf-section-nav-inner"><span className="yf-nav-context">{admin ? 'ESPACE ADMIN' : 'TON ESPACE'}</span><div>{(admin ? ADMIN_LINKS : MEMBER_LINKS).map(link => <Link key={link.href} href={link.href} aria-current={pathname === link.href ? 'page' : undefined}>{link.label}</Link>)}</div></div>
  </nav>;
}
