import Link from 'next/link';
import { LEGAL } from '@/lib/legal';

const pages = [
  { href: '/mentions-legales', label: 'Mentions légales' },
  { href: '/conditions', label: 'CGU & CGV' },
  { href: '/confidentialite', label: 'Confidentialité' },
];

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="space-y-3"><h2 className="text-lg font-bold text-white">{title}</h2><div className="space-y-3 text-sm leading-7 text-zinc-300 [&_a]:text-red-400 [&_a]:underline [&_li]:ml-5 [&_li]:list-disc [&_strong]:text-white">{children}</div></section>;
}

export default function LegalPage({ title, current, children }: { title: string; current: string; children: React.ReactNode }) {
  return <main className="yf-page min-h-screen bg-[#0a0a0b] px-4 pb-20 pt-8 text-white sm:px-10">
    <div className="mx-auto max-w-3xl">
      <Link href="/" className="text-lg font-black tracking-tight text-red-500">YAMON<span className="text-white">FILM</span></Link>
      <nav aria-label="Documents légaux" className="mt-8 flex flex-wrap gap-2">{pages.map(p => <Link key={p.href} href={p.href} aria-current={p.href === current ? 'page' : undefined} className={`rounded-full px-4 py-2 text-xs font-semibold ${p.href === current ? 'bg-red-600 text-white' : 'bg-white/5 text-zinc-400 hover:text-white'}`}>{p.label}</Link>)}</nav>
      <h1 className="mt-8 text-3xl font-black tracking-tight sm:text-4xl">{title}</h1>
      <p className="mt-2 text-xs text-zinc-500">Dernière mise à jour : {LEGAL.updatedAt}</p>
      <div className="mt-10 space-y-10">{children}</div>
    </div>
  </main>;
}
