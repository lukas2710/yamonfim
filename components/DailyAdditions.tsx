'use client';

import Link from 'next/link';
import { useEffect, useState, type CSSProperties } from 'react';
import { supabase } from '@/lib/supabase';
import { fetchDailyAdditions } from '@/lib/daily-additions';

// Counts up from zero when the panel opens; shows the value at once when motion is reduced.
function CountUp({ value }: { value: number }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let frame = 0;
    const start = performance.now(), length = reduced || value <= 0 ? 0 : Math.min(900, 300 + value * 60);
    const step = (now: number) => {
      const progress = length ? Math.min(1, (now - start) / length) : 1;
      setShown(Math.round(value * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return <>{shown}</>;
}

interface Added { id: string | number; title: string; type: 'movie' | 'series'; poster?: string; created_at: string }

// Side tab, like the TV one, that opens only when clicked.
export default function DailyAdditions() {
  const [items, setItems] = useState<Added[] | null>(null);
  const [counts, setCounts] = useState({ total: 0, movies: 0, series: 0, yesterday: 0 });
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let active = true;
    let busy = false;
    const refresh = async () => {
      if (busy || document.hidden) return;
      busy = true;
      try { const data = await fetchDailyAdditions(supabase); if (active) { setCounts(data); setItems(data.items as Added[]); } }
      catch { /* Keep the previous count during temporary network failures. */ }
      finally { busy = false; }
    };
    void refresh();
    const timer = setInterval(refresh, 180000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => { active = false; clearInterval(timer); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, []);
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [open]);
  if (!items) return null;
  const today = items;
  const { total, movies, series, yesterday } = counts;

  return <>
    <button type="button" onClick={() => setOpen(true)} aria-label={`Nouveautés du jour : ${total} ajout${total > 1 ? 's' : ''}`} className="yf-nudge fixed right-0 top-[calc(58%-58px)] z-[60] flex items-center gap-2 rounded-l-2xl border border-r-0 border-white/10 bg-gradient-to-br from-[#1c1c24] to-[#121218] py-2 pl-2.5 pr-2 sm:py-2.5 sm:pl-3 sm:pr-3 text-white shadow-[0_10px_30px_-10px_rgba(0,0,0,.8)] transition hover:pr-4">
      <span aria-hidden="true" className={`text-lg leading-none ${total > 0 ? 'yf-sparkle' : ''}`}>✨</span>
      <span className="hidden text-[11px] font-bold sm:inline">Nouveautés</span>
      {total > 0 && <span className="yf-ping grid h-5 min-w-5 place-items-center rounded-full bg-red-600 px-1.5 text-[10px] font-black">{total}</span>}
    </button>
    {open && <div className="yf-backdrop fixed inset-0 z-[200] flex items-center justify-center bg-black/75 p-4 backdrop-blur-md" onClick={() => setOpen(false)}>
      <section role="dialog" aria-modal="true" aria-labelledby="daily-additions-title" onClick={event => event.stopPropagation()} className="yf-pop relative max-h-[85vh] w-full max-w-md overflow-y-auto rounded-3xl border border-white/10 bg-[#121214] p-6 text-white shadow-2xl">
        <button type="button" onClick={() => setOpen(false)} aria-label="Fermer" className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-white/5 text-lg text-zinc-400 hover:bg-white/10 hover:text-white">×</button>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-red-400">Aujourd’hui sur YAMONFIM</p>
        <h2 id="daily-additions-title" className="mt-2 text-2xl font-black tracking-tight">{total ? `${total} nouveauté${total > 1 ? 's' : ''}` : 'Pas encore de nouveauté'}</h2>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-gradient-to-br from-red-500/15 to-white/[0.03] p-4 ring-1 ring-white/5"><p className="text-3xl font-black tabular-nums"><CountUp value={movies} /></p><p className="text-xs text-zinc-400">film{movies > 1 ? 's' : ''} ajouté{movies > 1 ? 's' : ''}</p></div>
          <div className="rounded-2xl bg-gradient-to-br from-sky-500/15 to-white/[0.03] p-4 ring-1 ring-white/5"><p className="text-3xl font-black tabular-nums"><CountUp value={series} /></p><p className="text-xs text-zinc-400">série{series > 1 ? 's' : ''} ajoutée{series > 1 ? 's' : ''}</p></div>
        </div>
        {total > today.length && <p className="mt-4 text-xs text-zinc-400">Les {today.length} derniers ajouts sur {total} aujourd’hui.</p>}
        {total > 0 ? <ul className="mt-5 space-y-2">{today.map((item, index) => <li key={item.id} className="yf-rise" style={{ '--i': index } as CSSProperties}><Link href={`/watch/${item.id}`} onClick={() => setOpen(false)} className="group flex items-center gap-3 rounded-xl p-2 transition hover:bg-white/5">
          <span className="h-14 w-10 shrink-0 overflow-hidden rounded-md bg-white/5">{item.poster && <img src={item.poster} alt="" loading="lazy" className="h-full w-full object-cover transition duration-300 group-hover:scale-110" />}</span>
          <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{item.title}</span><span className="text-[11px] text-zinc-500">{item.type === 'movie' ? 'Film' : 'Série'} · ajouté à {new Date(item.created_at).toLocaleTimeString('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit' })}</span></span>
          <span aria-hidden="true" className="text-zinc-500 transition group-hover:translate-x-1 group-hover:text-white">›</span>
        </Link></li>)}</ul> : <p className="mt-5 text-sm text-zinc-400">Reviens plus tard dans la journée{yesterday ? ` : ${yesterday} titre${yesterday > 1 ? 's ont' : ' a'} été ajouté${yesterday > 1 ? 's' : ''} hier.` : '.'}</p>}
      </section>
    </div>}
  </>;
}
