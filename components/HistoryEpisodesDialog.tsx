'use client';
import { useEffect, useRef } from 'react';

type Season = { seasonNumber: number; episodes: { number: number; title?: string }[] };
type Props = {
  title: string; seasons: Season[]; watched: Record<string, string>; seasonIndex: number; busy: boolean; error: string;
  onSeason: (index: number) => void; onToggle: (key: string) => void; onMarkSeason: (index: number, value: boolean) => void;
  onMarkSeries: (value: boolean) => void; onMarkThrough: (season: number, episode: number) => void; onClose: () => void;
};
export default function HistoryEpisodesDialog({ title, seasons, watched, seasonIndex, busy, error, onSeason, onToggle, onMarkSeason, onMarkSeries, onMarkThrough, onClose }: Props) {
  const panel = useRef<HTMLDivElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previous = document.activeElement, overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden'; close.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); }
      if (event.key !== 'Tab') return;
      const controls = panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled)');
      if (!controls?.length) return;
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', keydown);
    return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', keydown); if (previous instanceof HTMLElement) previous.focus(); };
  }, [onClose]);
  const season = seasons[seasonIndex];
  const button = 'min-h-11 rounded-full border border-white/15 px-4 py-2 text-xs font-semibold hover:bg-white/10 disabled:opacity-40';
  return <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm sm:p-6" onClick={onClose}>
    <div ref={panel} role="dialog" aria-modal="true" aria-labelledby="history-episodes-title" className="flex max-h-[88svh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#111114] text-white shadow-2xl" onClick={event => event.stopPropagation()}>
      <header className="flex items-start justify-between gap-4 border-b border-white/10 p-5"><div><p className="text-xs font-bold uppercase tracking-wider text-red-400">Gérer les épisodes</p><h2 id="history-episodes-title" className="mt-1 text-xl font-bold">{title}</h2></div><button ref={close} onClick={onClose} aria-label="Fermer la gestion des épisodes" className={button}>✕</button></header>
      <div className="space-y-4 overflow-y-auto p-5">
        {error && <p role="alert" className="rounded-xl bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
        <div className="flex flex-wrap gap-2"><button className={button} disabled={busy || !seasons.length} onClick={() => onMarkSeries(true)}>Toute la série vue</button><button className={button} disabled={busy || !seasons.length} onClick={() => onMarkSeries(false)}>Toute la série non vue</button></div>
        <nav aria-label="Saisons de la série" className="flex gap-2 overflow-x-auto pb-2">{seasons.map((item, index) => <button key={index} aria-pressed={index === seasonIndex} onClick={() => onSeason(index)} className={`${button} shrink-0 ${index === seasonIndex ? 'bg-white/15' : ''}`}>Saison {item.seasonNumber ?? index + 1}</button>)}</nav>
        {!season ? <p className="text-sm text-zinc-400">Les épisodes de cette série ne sont pas disponibles.</p> : <>
          <div className="flex flex-wrap items-center gap-2"><span className="mr-auto text-sm text-zinc-400">{season.episodes.filter((_, index) => watched[`s${seasonIndex}_e${index}`]).length} / {season.episodes.length} épisodes vus</span><button className={button} disabled={busy || !season.episodes.length} onClick={() => onMarkSeason(seasonIndex, true)}>Saison vue</button><button className={button} disabled={busy || !season.episodes.length} onClick={() => onMarkSeason(seasonIndex, false)}>Saison non vue</button></div>
          <ul className="divide-y divide-white/5">{season.episodes.map((episode, index) => { const key = `s${seasonIndex}_e${index}`, seen = !!watched[key]; return <li key={key} className="flex flex-wrap items-center gap-3 py-3"><label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3"><input type="checkbox" checked={seen} disabled={busy} onChange={() => onToggle(key)} aria-label={`Épisode ${episode.number ?? index + 1} vu`} className="h-5 w-5 accent-emerald-500" /><span className="min-w-0 text-sm"><strong>Épisode {episode.number ?? index + 1}</strong>{episode.title && <span className="ml-2 text-zinc-400">{episode.title}</span>}{seen && <span className="ml-2 text-xs font-semibold text-emerald-400">✓ Vu</span>}</span></label><button className={button} disabled={busy} onClick={() => onMarkThrough(seasonIndex, index)}>Vu jusqu’ici</button></li>; })}</ul>
        </>}
        {busy && <p role="status" className="text-sm text-zinc-400">Enregistrement…</p>}
      </div>
    </div>
  </div>;
}
