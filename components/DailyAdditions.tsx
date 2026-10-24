'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface Added { id: string | number; title: string; type: 'movie' | 'series'; poster?: string; created_at: string }

// Start of the current day in Paris, as an absolute instant.
function parisMidnight(now: Date, daysAgo = 0) {
  const key = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  const day = new Date(`${key}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() - daysAgo);
  const offset = new Intl.DateTimeFormat('en', { timeZone: 'Europe/Paris', timeZoneName: 'longOffset' }).formatToParts(day).find(p => p.type === 'timeZoneName')?.value.match(/GMT([+-])(\d{2}):(\d{2})/);
  const minutes = offset ? (Number(offset[2]) * 60 + Number(offset[3])) * (offset[1] === '+' ? 1 : -1) : 0;
  return new Date(day.getTime() - minutes * 60_000);
}

// Side tab, like the TV one, that opens only when clicked.
export default function DailyAdditions() {
  const [items, setItems] = useState<Added[] | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let active = true;
    const since = parisMidnight(new Date(), 1).toISOString();
    supabase.from('media').select('id,title,type,poster,created_at').gte('created_at', since).order('created_at', { ascending: false })
      .then(({ data }) => { if (active) setItems((data ?? []) as Added[]); }, () => { if (active) setItems([]); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [open]);
  if (!items) return null;
  const todayStart = parisMidnight(new Date()).getTime();
  const today = items.filter(i => Date.parse(i.created_at) >= todayStart);
  const yesterday = items.length - today.length;
  const movies = today.filter(i => i.type === 'movie').length;
  const series = today.filter(i => i.type === 'series').length;

  return <>
    <button type="button" onClick={() => setOpen(true)} aria-label={`Nouveautés du jour : ${today.length} ajout${today.length > 1 ? 's' : ''}`} className="fixed right-0 top-[calc(58%-58px)] z-[60] flex items-center gap-2 rounded-l-2xl border border-r-0 border-white/10 bg-gradient-to-br from-[#1c1c24] to-[#121218] py-2 pl-2.5 pr-2 sm:py-2.5 sm:pl-3 sm:pr-3 text-white shadow-[0_10px_30px_-10px_rgba(0,0,0,.8)] transition hover:pr-4">
      <span aria-hidden="true" className="text-lg leading-none">✨</span>
      <span className="hidden text-[11px] font-bold sm:inline">Nouveautés</span>
      {today.length > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-red-600 px-1.5 text-[10px] font-black">{today.length}</span>}
    </button>
    {open && <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/75 p-4 backdrop-blur-md" onClick={() => setOpen(false)}>
      <section role="dialog" aria-modal="true" aria-labelledby="daily-additions-title" onClick={event => event.stopPropagation()} className="relative max-h-[85vh] w-full max-w-md overflow-y-auto rounded-3xl border border-white/10 bg-[#121214] p-6 text-white shadow-2xl">
        <button type="button" onClick={() => setOpen(false)} aria-label="Fermer" className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-white/5 text-lg text-zinc-400 hover:bg-white/10 hover:text-white">×</button>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-red-400">Aujourd’hui sur YAMONFIM</p>
        <h2 id="daily-additions-title" className="mt-2 text-2xl font-black tracking-tight">{today.length ? `${today.length} nouveauté${today.length > 1 ? 's' : ''}` : 'Pas encore de nouveauté'}</h2>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-white/[0.04] p-4"><p className="text-3xl font-black">{movies}</p><p className="text-xs text-zinc-400">film{movies > 1 ? 's' : ''} ajouté{movies > 1 ? 's' : ''}</p></div>
          <div className="rounded-2xl bg-white/[0.04] p-4"><p className="text-3xl font-black">{series}</p><p className="text-xs text-zinc-400">série{series > 1 ? 's' : ''} ajoutée{series > 1 ? 's' : ''}</p></div>
        </div>
        {today.length > 0 ? <ul className="mt-5 space-y-2">{today.map(item => <li key={item.id}><Link href={`/watch/${item.id}`} onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-xl p-2 hover:bg-white/5">
          <span className="h-14 w-10 shrink-0 overflow-hidden rounded-md bg-white/5">{item.poster && <img src={item.poster} alt="" className="h-full w-full object-cover" />}</span>
          <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{item.title}</span><span className="text-[11px] text-zinc-500">{item.type === 'movie' ? 'Film' : 'Série'} · ajouté à {new Date(item.created_at).toLocaleTimeString('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit' })}</span></span>
          <span aria-hidden="true" className="text-zinc-500">›</span>
        </Link></li>)}</ul> : <p className="mt-5 text-sm text-zinc-400">Reviens plus tard dans la journée{yesterday ? ` : ${yesterday} titre${yesterday > 1 ? 's ont' : ' a'} été ajouté${yesterday > 1 ? 's' : ''} hier.` : '.'}</p>}
      </section>
    </div>}
  </>;
}
