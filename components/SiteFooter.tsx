'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function SiteFooter() {
  const pathname = usePathname();
  if (['/login', '/profiles', '/vip', '/abonnement', '/admin/banners', '/admin/stats'].includes(pathname) || pathname.startsWith('/watch/')) return null;
  return <footer className="yf-site-footer"><div><Link href="/" className="yf-wordmark">YAMON<span>FIM</span></Link><p>Ton prochain film. Ta prochaine série.<br />Ta prochaine bonne soirée.</p></div><nav aria-label="Navigation de bas de page"><Link href="/">Catalogue</Link><Link href="/requests">Faire une demande</Link><Link href="/abonnement">Découvrir le VIP</Link><Link href="/report">Besoin d’aide ?</Link></nav><nav aria-label="Informations légales" className="yf-footer-legal flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-zinc-500"><Link href="/mentions-legales">Mentions légales</Link><Link href="/conditions">CGU & CGV</Link><Link href="/confidentialite">Confidentialité</Link></nav><span className="yf-footer-signature">LE CINÉMA, À TA FAÇON.</span></footer>;
}
