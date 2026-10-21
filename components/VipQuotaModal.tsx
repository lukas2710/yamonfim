'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';

export default function VipQuotaModal({ onClose }: { onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab') return;
      const controls = closeRef.current?.closest('[role="dialog"]')?.querySelectorAll<HTMLElement>('button, a[href]');
      if (!controls?.length) return;
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', keydown);
    return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', keydown); if (previous instanceof HTMLElement) previous.focus(); };
  }, [onClose]);

  return <div className="fixed inset-0 z-[150] flex items-center justify-center overflow-y-auto bg-black/80 p-4 backdrop-blur-md" onClick={onClose}>
    <section role="dialog" aria-modal="true" aria-labelledby="vip-quota-title" aria-describedby="vip-quota-description" onClick={event => event.stopPropagation()} className="relative my-auto w-full max-w-md rounded-3xl border border-amber-500/25 bg-[#111113] p-7 text-center text-white shadow-2xl sm:p-9">
      <button ref={closeRef} onClick={onClose} aria-label="Fermer la promotion VIP" className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full bg-white/5 text-xl text-zinc-400 hover:bg-white/10">×</button>
      <div aria-hidden="true" className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-amber-500/15 text-amber-400"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-8 w-8"><path d="m3 7 4.5 4L12 4l4.5 7L21 7l-2 12H5L3 7Z" /></svg></div>
      <p className="mb-3 text-[10px] font-bold tracking-[.2em] text-amber-400">CONTINUE TA SÉANCE</p>
      <h2 id="vip-quota-title" className="text-2xl font-bold tracking-tight">Passe à l’expérience VIP</h2>
      <p id="vip-quota-description" className="mt-3 text-sm leading-7 text-zinc-400">Tu as utilisé tes <strong className="text-white">5 visions gratuites</strong>. Profite de tes films et séries sans limite avec le VIP.</p>
      <ul className="my-6 space-y-3 rounded-2xl bg-white/[.03] p-5 text-left text-sm text-zinc-300">{['Visionnage illimité', 'Tous les films et séries', 'Continue tes épisodes sans quota'].map(label => <li key={label} className="flex gap-3"><span aria-hidden="true" className="text-amber-400">✓</span>{label}</li>)}</ul>
      <Link href="/abonnement" className="block rounded-full bg-amber-400 px-6 py-4 text-sm font-bold text-zinc-950 transition hover:bg-amber-300">Découvrir les offres VIP</Link>
      <button onClick={onClose} className="mt-3 min-h-11 w-full text-sm text-zinc-400 hover:text-white">Plus tard</button>
    </section>
  </div>;
}
