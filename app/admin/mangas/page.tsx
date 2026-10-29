'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import SectionNavigation from '@/components/SectionNavigation';
import { supabase } from '@/lib/supabase';
import { fetchCatalogueRows } from '@/lib/catalogue';
import { clearClientResources } from '@/lib/resource-cache';
import { withMangaGenre, withoutMangaGenre } from '@/lib/catalogue-categories';
import type { FamilyClassification } from '@/lib/tmdb-certification';

type Item = { id: string; title: string; type: string; poster: string; tmdb_id: string | null; genres: string[] | null; family_classification: FamilyClassification | null };
type Filter = 'review' | 'answered';

// Titles the TMDB analysis could not settle (Chinese or Korean animation, Japanese
// co-production, missing TMDB record). The admin's answer is kept by every later analysis.
export default function MangaReview() {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [filter, setFilter] = useState<Filter>('review');
  const [ready, setReady] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email !== 'lukas.leclerc312@gmail.com') { router.replace('/'); return; }
      if (!alive.current) return;
      setReady(true);
      const rows = await fetchCatalogueRows<Item>(supabase, 'id,title,type,poster,tmdb_id,genres,family_classification');
      if (alive.current) { setItems(rows.map(row => ({ ...row, id: String(row.id) }))); setLoaded(true); }
    })().catch(() => { if (alive.current) setError('Chargement impossible. Recharge la page.'); });
    return () => { alive.current = false; };
  }, [router]);
  const review = useMemo(() => items.filter(item => item.family_classification?.manga_review === true && typeof item.family_classification.manga_manual !== 'boolean'), [items]);
  const answered = useMemo(() => items.filter(item => typeof item.family_classification?.manga_manual === 'boolean'), [items]);
  const visible = filter === 'review' ? review : answered;

  async function answer(item: Item, manga: boolean) {
    const previous = item.family_classification;
    if (!previous || saving) return;
    setSaving(item.id); setError(''); setStatus('');
    const metadata: FamilyClassification = { ...previous, manga, manga_review: false, manga_manual: manga };
    const genres = manga ? withMangaGenre(item.genres, true) : withoutMangaGenre(item.genres);
    try {
      const result = await supabase.from('media').update({ genres, family_classification: metadata }).eq('id', item.id)
        .eq('family_classification', JSON.stringify(previous)).select('id').maybeSingle();
      if (result.error) throw result.error;
      if (!result.data) throw new Error('Ce titre a été modifié ailleurs. Recharge la page.');
      clearClientResources();
      if (alive.current) { setItems(rows => rows.map(row => row.id === item.id ? { ...row, genres, family_classification: metadata } : row)); setStatus(`« ${item.title} » ${manga ? 'est rangé dans Mangas' : 'n’est pas un manga'}.`); }
    } catch (cause) { if (alive.current) setError(cause instanceof Error && cause.message.startsWith('Ce titre') ? cause.message : 'Enregistrement impossible. Réessaie.'); }
    finally { if (alive.current) setSaving(''); }
  }

  if (!ready) return <main className="p-10">Vérification…{error}</main>;
  return <main className="min-h-screen px-4 py-6 sm:px-8">
    <SectionNavigation admin />
    <div className="mx-auto max-w-5xl space-y-7 pb-16">
      <header className="pt-6">
        <p className="text-xs font-bold uppercase tracking-[.2em] text-red-400">C’EST UN MANGA ?</p>
        <h1 className="mt-3 text-3xl font-bold sm:text-4xl">Mangas à vérifier</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-400">L’analyse TMDB (Admin → Kids & Junior → « Analyser et classer ») range seule l’animation japonaise dans Mangas. Les cas où elle hésite arrivent ici : animation chinoise ou coréenne, coproduction avec le Japon, titre d’animation sans fiche TMDB. Ta réponse est gardée par toutes les analyses suivantes.</p>
      </header>
      <div className="flex flex-wrap gap-2" aria-label="Filtrer">
        {([['review', 'À vérifier', review.length], ['answered', 'Mes réponses', answered.length]] as [Filter, string, number][]).map(([key, label, count]) =>
          <button key={key} aria-pressed={filter === key} onClick={() => setFilter(key)} className={`rounded-full border px-4 py-2 text-sm ${filter === key ? 'border-white bg-white text-black' : 'border-white/10 bg-white/5 text-zinc-300'}`}>{label} <span className="ml-1 opacity-60">{count}</span></button>)}
      </div>
      {error && <p role="alert" className="rounded-xl bg-red-950/40 p-4 text-sm text-red-200">{error}</p>}
      {status && <p role="status" className="text-sm text-zinc-300">{status}</p>}
      {!loaded && !error && <p role="status" className="text-zinc-400">Chargement du catalogue…</p>}
      {loaded && !visible.length && <div className="rounded-2xl border border-white/10 p-8 text-center text-zinc-400">{filter === 'review' ? 'Rien à vérifier pour le moment. Lance « Analyser et classer » sur tous les titres pour repérer les cas douteux.' : 'Tu n’as encore répondu à aucun titre.'}</div>}
      <div className="grid gap-4 sm:grid-cols-2">{visible.map((item, index) => {
        const metadata = item.family_classification!;
        const decided = typeof metadata.manga_manual === 'boolean';
        return <article key={item.id} className="yf-rise flex gap-4 rounded-2xl border border-white/10 bg-white/[.02] p-4" style={{ '--i': Math.min(index, 12) } as React.CSSProperties}>
          {item.poster ? <img alt="" loading="lazy" src={item.poster} className="h-36 w-24 shrink-0 rounded-xl object-cover" /> : <div className="h-36 w-24 shrink-0 rounded-xl bg-white/5" />}
          <div className="flex min-w-0 flex-1 flex-col">
            <h2 className="font-semibold leading-snug">{item.title}</h2>
            <p className="mt-1 text-xs text-zinc-500">{item.type === 'series' ? 'Série' : 'Film'}{metadata.tmdb_title && metadata.tmdb_title !== item.title ? ` · TMDB : ${metadata.tmdb_title}` : ''}{metadata.status === 'missing_id' || metadata.status === 'not_found' ? ' · sans fiche TMDB' : ''}</p>
            {decided && <p className={`mt-2 text-xs font-bold ${metadata.manga_manual ? 'text-emerald-300' : 'text-zinc-400'}`}>{metadata.manga_manual ? 'Rangé dans Mangas' : 'Pas un manga'}</p>}
            <a href={metadata.tmdb_id ? `https://www.themoviedb.org/${metadata.media_type}/${metadata.tmdb_id}` : `https://www.themoviedb.org/search?query=${encodeURIComponent(item.title)}`} target="_blank" rel="noreferrer" className="mt-2 text-xs text-zinc-400 underline">{metadata.tmdb_id ? 'Voir la fiche TMDB ↗' : 'Chercher sur TMDB ↗'}</a>
            <div className="mt-auto flex gap-2 pt-3">
              <button disabled={!!saving} onClick={() => void answer(item, true)} className={`flex-1 rounded-full px-4 py-2.5 text-sm font-bold transition disabled:opacity-40 ${decided && metadata.manga_manual ? 'bg-emerald-500 text-black' : 'bg-red-600 text-white hover:bg-red-500'}`}>{saving === item.id ? '…' : 'Oui, manga'}</button>
              <button disabled={!!saving} onClick={() => void answer(item, false)} className={`flex-1 rounded-full px-4 py-2.5 text-sm font-bold ring-1 ring-white/15 transition disabled:opacity-40 ${decided && !metadata.manga_manual ? 'bg-white text-black' : 'bg-white/5 text-white hover:bg-white/10'}`}>Non</button>
            </div>
          </div>
        </article>;
      })}</div>
    </div>
  </main>;
}
