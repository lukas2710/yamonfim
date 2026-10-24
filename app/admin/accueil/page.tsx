'use client';

import { getPersistentSession } from '@/lib/auth-session';
import { fetchCatalogueCards } from '@/lib/client-catalogue';
import { clearClientResources } from '@/lib/resource-cache';
import { createSearchMatcher } from '@/lib/search';
import { parseHeroSetting, pickHeroItems, HERO_SIZE, type HeroMode, type HeroSetting } from '@/lib/home-hero';
import { parseBannerEntry, bannerEntry, type SeasonSummary } from '@/lib/banner-items';
import SectionNavigation from '@/components/SectionNavigation';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';

const ADMIN_EMAIL = 'lukas.leclerc312@gmail.com';
const SETUP_HINT = 'Exécute le script supabase/migrations/20261024_home_hero.sql dans le SQL Editor de Supabase, puis actualise.';
interface Card { id: string | number; title: string; type: 'movie' | 'series'; poster?: string; backdrop?: string }
interface TopRow { media_id: string; viewers: number; progressions: number }
const panel = 'rounded-2xl border border-white/[0.08] bg-[#121319] p-5 sm:p-6';
const modes: { value: HeroMode; label: string; hint: string }[] = [
  { value: 'top', label: 'Top 5 des plus regardés', hint: 'Mis à jour automatiquement selon les visionnages (statistiques).' },
  { value: 'custom', label: 'Ma sélection', hint: 'Tu choisis les 5 titres et leur ordre.' },
  { value: 'latest', label: 'Derniers ajouts', hint: 'Les 5 titres ajoutés le plus récemment (comportement actuel).' },
];

export default function AdminHeroPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [catalogue, setCatalogue] = useState<Card[]>([]);
  const [setting, setSetting] = useState<HeroSetting>(parseHeroSetting(null));
  const [top, setTop] = useState<TopRow[] | null>(null);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [seasonsById, setSeasonsById] = useState<Record<string, SeasonSummary[]>>({});

  useEffect(() => {
    void (async () => {
      const { data: { session } } = await getPersistentSession();
      if (session?.user.email !== ADMIN_EMAIL) { router.replace('/'); return; }
      setReady(true);
      fetchCatalogueCards<Card>(supabase).then(setCatalogue).catch(() => setError('Catalogue indisponible. Actualise la page.'));
      const { data, error: readError } = await supabase.from('site_settings').select('value').eq('key', 'home_hero').maybeSingle();
      if (readError) setError(readError.code === 'PGRST205' ? `Réglage pas encore installé. ${SETUP_HINT}` : readError.message);
      else setSetting(parseHeroSetting(data?.value));
    })();
  }, [router]);

  const loadTop = useCallback(async (days: number) => {
    setTop(null);
    const { data, error: rpcError } = await supabase.rpc('top_watched_media', { days, max_items: HERO_SIZE });
    if (rpcError) { setTop([]); setError(rpcError.code === 'PGRST202' ? `Top 5 pas encore installé. ${SETUP_HINT}` : rpcError.message); }
    else setTop((data ?? []) as TopRow[]);
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Refresh the ranking when the period changes.
    if (ready && setting.mode === 'top') void loadTop(setting.days);
  }, [ready, setting.mode, setting.days, loadTop]);

  // Season choices are loaded only for series placed in the selection.
  const loadSeasons = useCallback(async (mediaId: string) => {
    const { data } = await supabase.from('media').select('seasons').eq('id', mediaId).maybeSingle();
    setSeasonsById(previous => ({ ...previous, [mediaId]: Array.isArray(data?.seasons) ? data.seasons : [] }));
  }, []);
  const seriesInSelection = setting.media_ids.map(entry => parseBannerEntry(entry).mediaId).filter(id => catalogue.find(c => String(c.id) === id)?.type === 'series').join(',');
  const requestedSeasons = useRef(new Set<string>());
  useEffect(() => {
    for (const id of seriesInSelection.split(',').filter(Boolean)) {
      if (requestedSeasons.current.has(id)) continue;
      requestedSeasons.current.add(id);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Fetch the season list of each series added to the selection once.
      void loadSeasons(id);
    }
  }, [seriesInSelection, loadSeasons]);

  const byId = useMemo(() => new Map(catalogue.map(c => [String(c.id), c])), [catalogue]);
  const mediaIdOf = (entry: string) => parseBannerEntry(entry).mediaId;
  const previewIds = setting.mode === 'custom' ? setting.media_ids : setting.mode === 'top' ? (top ?? []).map(t => String(t.media_id)) : [];
  const preview = pickHeroItems(catalogue, previewIds);
  const viewers = new Map((top ?? []).map(t => [String(t.media_id), t.viewers]));
  const results = search.trim() ? catalogue.filter(c => createSearchMatcher(search)(c.title)).slice(0, 30) : [];

  const update = (patch: Partial<HeroSetting>) => { setSetting(previous => ({ ...previous, ...patch })); setMessage(''); };
  const add = (id: string) => { if (!setting.media_ids.some(e => mediaIdOf(e) === id) && setting.media_ids.length < HERO_SIZE) update({ media_ids: [...setting.media_ids, id] }); };
  const remove = (entry: string) => update({ media_ids: setting.media_ids.filter(x => x !== entry) });
  const chooseSeason = (entry: string, season: number | null) => update({ media_ids: setting.media_ids.map(x => x === entry ? bannerEntry(mediaIdOf(entry), season) : x) });
  const move = (index: number, delta: number) => {
    const ids = [...setting.media_ids]; const target = index + delta;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    update({ media_ids: ids });
  };
  const save = async () => {
    setSaving(true); setError(''); setMessage('');
    const { data, error: saveError } = await supabase.from('site_settings').upsert({ key: 'home_hero', value: setting, updated_at: new Date().toISOString() }).select('key');
    if (saveError) setError(saveError.code === 'PGRST205' ? SETUP_HINT : `Erreur : ${saveError.message}`);
    else if (!data?.length) setError('La base de données a refusé l’enregistrement. Vérifie les droits de la table « site_settings ».');
    else { clearClientResources(); setMessage('Carrousel enregistré : la page d’accueil est à jour.'); }
    setSaving(false);
  };

  if (!ready) return <main className="yf-page grid min-h-screen place-items-center bg-[#0b0c10] text-sm text-zinc-400">Vérification de ton accès administrateur…</main>;
  return <main className="yf-page min-h-screen bg-[#0b0c10] pb-16 text-zinc-100">
    <nav className="border-b border-white/[0.07] px-5 sm:px-10" aria-label="Administration"><div className="mx-auto flex max-w-[1200px] items-center justify-between gap-4 py-5"><Link href="/" className="text-lg font-black tracking-tight text-red-500">YAMON<span className="text-white">FIM</span><span className="ml-3 border-l border-white/20 pl-3 text-[9px] font-medium tracking-[0.18em] text-zinc-500">ACCUEIL</span></Link><Link href="/" className="text-xs text-zinc-400 hover:text-white">Voir le site ↗</Link></div></nav>
    <SectionNavigation admin />
    <div className="mx-auto max-w-[1200px] space-y-8 px-4 pt-8 sm:px-10">
      <header><h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Carrousel de l’accueil</h1><p className="mt-2 text-sm text-zinc-400">Les {HERO_SIZE} titres qui défilent en grand en haut de la page d’accueil.</p></header>
      {error && <p role="alert" className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">{error}</p>}
      {message && <p role="status" className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">{message}</p>}

      <section className={panel} aria-label="Mode">
        <h2 className="text-sm font-semibold">Comment choisir les titres ?</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">{modes.map(m => <label key={m.value} className={`cursor-pointer rounded-xl border p-4 transition ${setting.mode === m.value ? 'border-red-400 bg-red-500/10' : 'border-white/10 bg-white/[0.02] hover:border-white/25'}`}>
          <input type="radio" name="hero-mode" className="sr-only" checked={setting.mode === m.value} onChange={() => update({ mode: m.value })} />
          <span className="block text-sm font-semibold">{m.label}</span><span className="mt-1 block text-xs leading-5 text-zinc-400">{m.hint}</span>
        </label>)}</div>
        {setting.mode === 'top' && <div className="mt-5 flex flex-wrap items-center gap-2"><span className="mr-1 text-xs text-zinc-500">Période</span>{[7, 30, 90, 0].map(d => <button key={d} type="button" aria-pressed={setting.days === d} onClick={() => update({ days: d })} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${setting.days === d ? 'bg-red-500 text-white' : 'bg-white/5 text-zinc-400 hover:text-white'}`}>{d ? `${d} jours` : 'Depuis le début'}</button>)}<span className="text-[11px] text-zinc-500">Classement par nombre de spectateurs différents.</span></div>}
      </section>

      {setting.mode === 'custom' && <section className={panel} aria-label="Ma sélection">
        <div className="flex items-center justify-between"><h2 className="text-sm font-semibold">Ma sélection</h2><span className="text-xs text-zinc-500">{setting.media_ids.length} / {HERO_SIZE}</span></div>
        <ol className="mt-4 space-y-2">{setting.media_ids.map((entry, i) => { const { mediaId, season } = parseBannerEntry(entry); const c = byId.get(mediaId); const seasons = c?.type === 'series' ? seasonsById[mediaId] : undefined; return <li key={mediaId} className="flex flex-wrap items-center gap-2 rounded-xl bg-white/[0.03] p-2 sm:gap-3">
          <span className="w-5 text-center text-xs font-bold text-red-400">{i + 1}</span>
          <div className="h-12 w-8 shrink-0 overflow-hidden rounded bg-white/5">{c?.poster && <img src={c.poster} alt="" className="h-full w-full object-cover" />}</div>
          <span className="min-w-0 flex-1"><span className="line-clamp-2 text-sm leading-5">{c?.title ?? 'Titre introuvable'}</span>{season !== null && <span className="mt-1 inline-block rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-bold">Saison {season}</span>}</span>
          <button type="button" aria-label="Monter" disabled={i === 0} onClick={() => move(i, -1)} className="rounded-lg bg-white/5 px-2 py-1 text-xs disabled:opacity-30">↑</button>
          <button type="button" aria-label="Descendre" disabled={i === setting.media_ids.length - 1} onClick={() => move(i, 1)} className="rounded-lg bg-white/5 px-2 py-1 text-xs disabled:opacity-30">↓</button>
          <button type="button" aria-label={`Retirer ${c?.title ?? 'ce titre'}`} onClick={() => remove(entry)} className="rounded-lg bg-white/5 px-2 py-1 text-xs text-red-300"><span className="hidden sm:inline">Retirer</span><span aria-hidden="true" className="sm:hidden">✕</span></button>
          {c?.type === 'series' && <div className="flex basis-full flex-wrap gap-1.5 pl-7 sm:pl-8">
            <button type="button" aria-pressed={season === null} onClick={() => chooseSeason(entry, null)} className={`rounded-full px-3 py-1 text-[11px] font-semibold ${season === null ? 'bg-red-500 text-white' : 'bg-white/5 text-zinc-400 hover:text-white'}`}>Série complète</button>
            {!seasons ? <span className="text-[11px] text-zinc-500">Chargement des saisons…</span> : seasons.map((s, si) => { const n = s.seasonNumber ?? si + 1; return <button type="button" key={n} aria-pressed={season === n} onClick={() => chooseSeason(entry, n)} className={`rounded-full px-3 py-1 text-[11px] font-semibold ${season === n ? 'bg-red-500 text-white' : 'bg-white/5 text-zinc-400 hover:text-white'}`}>Saison {n}</button>; })}
          </div>}
        </li>; })}</ol>
        {setting.media_ids.length < HERO_SIZE && <>
          <input type="search" aria-label="Rechercher un titre" value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un film, une série à ajouter…" className="mt-4 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2.5 text-sm outline-none focus:border-red-400" />
          {results.length > 0 && <div className="mt-2 grid max-h-72 gap-2 overflow-y-auto sm:grid-cols-2">{results.map(c => { const id = String(c.id); const taken = setting.media_ids.some(e => mediaIdOf(e) === id); return <button key={id} type="button" disabled={taken} onClick={() => { add(id); setSearch(''); }} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-2 text-left hover:border-white/25 disabled:opacity-40">
            <div className="h-12 w-8 shrink-0 overflow-hidden rounded bg-white/5">{c.poster && <img src={c.poster} alt="" className="h-full w-full object-cover" />}</div>
            <span className="min-w-0 flex-1"><span className="block truncate text-sm">{c.title}</span><span className="text-[10px] uppercase text-zinc-500">{c.type === 'movie' ? 'Film' : 'Série'}</span></span><span className="text-red-300">{taken ? '✓' : '+'}</span>
          </button>; })}</div>}
        </>}
        <p className="mt-3 text-[11px] text-zinc-500">Pour une série, choisis la série complète ou une saison : le carrousel affichera « Saison N · Nouveau » et ouvrira la série sur cette saison. S’il manque des titres, les places libres sont complétées par les derniers ajouts.</p>
      </section>}

      <section className={panel} aria-label="Aperçu">
        <h2 className="text-sm font-semibold">Ce qui s’affichera, dans l’ordre</h2>
        {setting.mode === 'top' && top === null ? <p className="mt-4 text-sm text-zinc-500">Calcul du classement…</p> : <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">{preview.map(({ item: c, season }, i) => <figure key={String(c.id)} className="overflow-hidden rounded-xl border border-white/10 bg-black/20">
          <div className="relative aspect-video bg-white/5">{(c.backdrop || c.poster) && <img src={c.backdrop || c.poster} alt="" className="h-full w-full object-cover" />}<span className="absolute left-2 top-2 rounded-md bg-black/70 px-2 py-0.5 text-[10px] font-bold">{i + 1}</span></div>
          <figcaption className="p-2"><p className="truncate text-xs font-semibold">{c.title}{season !== null && <span className="ml-1 text-red-300">· Saison {season}</span>}</p>{setting.mode === 'top' && <p className="text-[10px] text-zinc-500">{viewers.has(String(c.id)) ? `${viewers.get(String(c.id))} spectateur(s)` : 'Complément : dernier ajout'}</p>}</figcaption>
        </figure>)}</div>}
      </section>

      <div className="flex justify-end"><button type="button" onClick={() => void save()} disabled={saving} className="rounded-xl bg-red-600 px-6 py-3 text-sm font-bold text-white hover:bg-red-500 disabled:opacity-50">{saving ? 'Enregistrement…' : 'Enregistrer le carrousel'}</button></div>
    </div>
  </main>;
}
