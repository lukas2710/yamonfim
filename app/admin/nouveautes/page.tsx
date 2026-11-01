'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import SectionNavigation from '@/components/SectionNavigation';
import { getPersistentSession } from '@/lib/auth-session';
import type { CatalogueNews } from '@/lib/catalogue-news';

const field = 'rounded-lg border border-white/15 bg-zinc-900 px-3 py-2 text-white';
const tag = 'rounded-md px-2 py-0.5 text-xs font-semibold';
const dayLabel = (date: string) => {
  const today = new Date().toISOString().slice(0, 10), yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (date === today) return 'Aujourd’hui';
  if (date === yesterday) return 'Hier';
  return new Date(`${date}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
};

export default function NewsAdmin() {
  const [news, setNews] = useState<CatalogueNews | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'series' | 'movies'>('series');
  const [filter, setFilter] = useState('all');
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true); setError('');
      try {
        const { data: { session } } = await getPersistentSession();
        if (session?.user.email !== 'lukas.leclerc312@gmail.com') throw new Error('Connecte-toi avec le compte administrateur pour accéder à cette page.');
        const response = await fetch('/api/catalogue-news', { signal: AbortSignal.timeout(40000) });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || 'Les nouveautés sont momentanément indisponibles.');
        if (!cancelled) setNews(body);
      } catch (cause) { if (!cancelled) setError(cause instanceof Error && cause.name !== 'TimeoutError' ? cause.message : 'Les nouveautés sont momentanément indisponibles.'); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [revision]);

  const series = (news?.series || []).filter(item => filter === 'all' || filter === 'season' && item.newSeason || filter === 'missing' && item.missingFrom !== null);
  const movies = (news?.movies || []).filter(item => filter === 'all' || filter === 'missing' && !item.mediaId);
  const days = [...new Set(series.map(item => item.airDate))];

  return <main className="min-h-screen bg-[#0a0a0b] pb-16 text-white">
    <SectionNavigation admin />
    <div className="mx-auto max-w-6xl space-y-6 px-4 pt-10">
      <Link href="/admin" className="text-sm text-red-400">← Administration</Link>
      <h1 className="text-3xl font-bold">Nouveautés</h1>
      <p className="max-w-3xl text-zinc-400">Les épisodes diffusés cette semaine pour les séries de ton site, et les films sortis en VOD ou en vidéo ces deux dernières semaines, d’après TMDB. Mis à jour toutes les 6 heures.</p>
      {error && <p role="alert" className="rounded-xl border border-red-600/40 bg-red-950/30 p-4">{error} <button className="underline" onClick={() => setRevision(value => value + 1)}>Réessayer</button></p>}
      {news && <>
        <nav aria-label="Types de nouveautés" className="flex gap-2 border-b border-white/10">
          {([['series', 'Séries', news.series.length], ['movies', 'Films', news.movies.length]] as const).map(([value, label, count]) => <button key={value} aria-current={view === value ? 'page' : undefined} className={`-mb-px border-b-2 px-4 py-2 font-semibold ${view === value ? 'border-red-500 text-white' : 'border-transparent text-zinc-400 hover:text-white'}`} onClick={() => { setView(value); setFilter('all'); }}>{label} <span className="text-sm font-normal text-zinc-400">{count}</span></button>)}
        </nav>
        <div className="flex flex-wrap items-center gap-3">
          <select aria-label="Filtrer les nouveautés" className={field} value={filter} onChange={event => setFilter(event.target.value)}>
            <option value="all">Toutes les nouveautés</option>
            {view === 'series' && <option value="season">Nouvelles saisons</option>}
            <option value="missing">Pas encore sur mon site</option>
          </select>
          <span className="text-sm text-zinc-400">Mis à jour le {new Date(news.at).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })}</span>
        </div>
        {view === 'series' ? <div className="space-y-8">
          {!series.length && <p className="text-zinc-400">Aucune série pour ce filtre.</p>}
          {days.map(date => <section key={date} aria-label={dayLabel(date)} className="space-y-3">
            <h2 className="text-lg font-semibold capitalize text-zinc-200">{dayLabel(date)}</h2>
            <div className="grid gap-3 sm:grid-cols-2">{series.filter(item => item.airDate === date).map(item => <Link key={item.tmdb} href={`/watch/${item.mediaId}`} className="flex gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-3 hover:border-white/25">
              {item.poster ? <img src={item.poster} alt="" loading="lazy" className="h-24 w-16 shrink-0 rounded-md object-cover" /> : <span className="h-24 w-16 shrink-0 rounded-md bg-zinc-800" />}
              <div className="min-w-0 space-y-2"><strong className="block truncate">{item.title}</strong>
                <p className="text-sm text-zinc-300">Saison {item.season} · épisode {item.episode}</p>
                <div className="flex flex-wrap gap-2">{item.newSeason && <span className={`${tag} bg-red-600`}>Nouvelle saison</span>}{item.missingFrom !== null ? <span className={`${tag} bg-amber-500/20 text-amber-300`}>Manquant sur ton site dès l’épisode {item.missingFrom}</span> : <span className={`${tag} bg-emerald-500/15 text-emerald-300`}>Déjà sur ton site ✓</span>}</div>
              </div>
            </Link>)}</div>
          </section>)}
        </div> : <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-5">
          {!movies.length && <p className="col-span-full text-zinc-400">Aucun film pour ce filtre.</p>}
          {movies.map(item => {
            const card = <>
              {item.poster ? <img src={item.poster} alt="" loading="lazy" className="aspect-[2/3] w-full rounded-lg object-cover" /> : <span className="block aspect-[2/3] w-full rounded-lg bg-zinc-800" />}
              <strong className="mt-2 block text-sm leading-snug">{item.title}</strong>
              {item.releaseDate && <span className="block text-xs text-zinc-400">Sortie {new Date(`${item.releaseDate}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
              <span className={`${tag} mt-2 inline-block ${item.mediaId ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}`}>{item.mediaId ? 'Déjà sur ton site ✓' : 'Pas encore sur ton site'}</span>
            </>;
            return item.mediaId ? <Link key={item.tmdb} href={`/watch/${item.mediaId}`} className="block">{card}</Link> : <div key={item.tmdb}>{card}</div>;
          })}
        </div>}
      </>}
      {loading && !news && !error && <p className="text-zinc-400">Chargement des nouveautés…</p>}
    </div>
  </main>;
}
