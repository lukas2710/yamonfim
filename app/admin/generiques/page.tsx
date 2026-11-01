'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import SectionNavigation from '@/components/SectionNavigation';
import { supabase } from '@/lib/supabase';
import { getPersistentSession } from '@/lib/auth-session';
import { parseCreditsTime } from '@/lib/credits-time';
import { creditsTmdb } from '@/lib/credits-identity';
import { seriesLengthKey, validCreditsLength } from '@/lib/episode-credits';

type Series = { id: string; title: string; tmdb_id?: string | number };
type Season = { seasonNumber: number; episodes: { number: number; title?: string; embedUrl?: string }[] };
type Marker = { episode_key: string; season: number; episode: number; duration_ms: number; start_sec: number | null; source: string; expires_at: string | null };
type Scan = { done: number; found: number; failed: number; current: string; seriesDone: number; seriesTotal: number };
const identity = (key: string, season: number, episode: number) => `${key}/${season}/${episode}`;
const formatTime = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
const field = 'rounded-lg border border-white/15 bg-zinc-900 px-3 py-2 text-white';
const valid = (record: Marker, now: number) => record.source === 'admin' || record.start_sec !== null && !!record.expires_at && Date.parse(record.expires_at) > now;

// Episode lists are loaded per series: all of them together weigh tens of megabytes.
function episodeRows(item: Series, seasons: Season[], lookup: Map<string, Marker[]>) {
  const now = Date.now();
  return seasons.flatMap(season => season.episodes.map(episode => {
    const tmdb = creditsTmdb(item, episode.embedUrl);
    const key = tmdb ? `tmdb:${tmdb}` : `media:${item.id}`;
    const candidates = [...(lookup.get(identity(`media:${item.id}`, season.seasonNumber, episode.number)) || []), ...(key === `media:${item.id}` ? [] : lookup.get(identity(key, season.seasonNumber, episode.number)) || [])];
    const manual = candidates.find(record => record.source === 'admin');
    const automatic = candidates.find(record => record.source !== 'admin' && valid(record, now));
    const missing = candidates.some(record => record.source === 'missing' && !!record.expires_at && Date.parse(record.expires_at) > now);
    return { item, season: season.seasonNumber, episode: episode.number, title: episode.title, key, id: identity(key, season.seasonNumber, episode.number), manual, automatic, checked: candidates.length > 0, status: manual ? 'manual' : automatic ? 'automatic' : missing ? 'absent' : 'unknown' };
  }));
}
type Row = ReturnType<typeof episodeRows>[number];
const validatedClass = 'mt-1 text-xs font-semibold text-emerald-400';
// Saved under the media id and, when known, the TMDB id the TV app sends.
function lengthKeys(item: Series, seasons: Season[]) {
  const tmdb = creditsTmdb(item, seasons.flatMap(season => season.episodes).find(episode => episode.embedUrl)?.embedUrl);
  return [...new Set([seriesLengthKey(`media:${item.id}`), ...(tmdb ? [seriesLengthKey(`tmdb:${tmdb}`)] : [])])];
}
// Saved timings per catalogue key, usable before a series' episodes are loaded.
function creditsSummary(markers: Marker[]) {
  const now = Date.now(), counts = new Map<string, Set<string>>();
  let manual = 0, automatic = 0;
  for (const marker of markers) if (valid(marker, now) && !marker.episode_key.startsWith('length:')) {
    if (marker.source === 'admin') manual++; else automatic++;
    const episodes = counts.get(marker.episode_key) || new Set<string>();
    episodes.add(`${marker.season}/${marker.episode}`); counts.set(marker.episode_key, episodes);
  }
  return { manual, automatic, count: (item: Series) => new Set([...(counts.get(`media:${item.id}`) || []), ...(item.tmdb_id ? counts.get(`tmdb:${item.tmdb_id}`) || [] : [])]).size };
}

export default function CreditsAdmin() {
  const [series, setSeries] = useState<Series[]>([]);
  const [seasons, setSeasons] = useState<Record<string, Season[]>>({});
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [allowed, setAllowed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState<Record<string, boolean>>({});
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('missing');
  const [page, setPage] = useState(0);
  const [expandedSeries, setExpandedSeries] = useState<Record<string, boolean>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [scan, setScan] = useState<Scan | null>(null);
  const scanController = useRef<AbortController | null>(null);
  const seasonsCache = useRef<Record<string, Season[]>>({});
  const markersRef = useRef<Marker[]>([]);
  useEffect(() => { markersRef.current = markers; }, [markers]);
  useEffect(() => () => scanController.current?.abort(), []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true); setError('');
      try {
        const { data: { session } } = await getPersistentSession();
        if (session?.user.email !== 'lukas.leclerc312@gmail.com') throw new Error('Connecte-toi avec le compte administrateur pour accéder à cette page.');
        setAllowed(true);
        const [list, records] = await Promise.all([
          (async () => {
            const all: Series[] = [];
            for (let offset = 0; ; offset += 1000) {
              const { data, error } = await supabase.from('media').select('id,title,tmdb_id').eq('type', 'series').order('id').range(offset, offset + 999);
              if (error) throw new Error('La liste des séries ne peut pas être chargée. Réessaie dans un instant.');
              all.push(...data); if (data.length < 1000) break;
            }
            return all;
          })(),
          (async () => {
            const all: Marker[] = [];
            for (let offset = 0; ; offset += 1000) {
              const { data, error } = await supabase.from('episode_credits').select('*').order('episode_key').order('season').order('episode').order('duration_ms').range(offset, offset + 999);
              if (error) throw new Error('La table des génériques est indisponible. Applique la migration Supabase 20261027_episode_credits.sql.');
              all.push(...data); if (data.length < 1000) break;
            }
            return all;
          })(),
        ]);
        if (!cancelled) { setSeries(list); setMarkers(records); }
      } catch (cause) { if (!cancelled) setError(cause instanceof Error ? cause.message : 'Chargement impossible.'); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [revision]);

  async function loadSeasons(id: string) {
    if (seasonsCache.current[id]) return seasonsCache.current[id];
    const { data, error } = await supabase.from('media').select('seasons').eq('id', id).single();
    if (error) throw new Error('Les épisodes de cette série ne peuvent pas être chargés. Réessaie.');
    const value = (data.seasons || []) as Season[];
    seasonsCache.current[id] = value;
    setSeasons(values => ({ ...values, [id]: value }));
    return value;
  }
  async function openSeries(id: string) {
    if (seasonsCache.current[id]) return;
    setOpening(values => ({ ...values, [id]: true }));
    try { await loadSeasons(id); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Chargement impossible.'); }
    finally { setOpening(values => ({ ...values, [id]: false })); }
  }

  const lookup = useMemo(() => {
    const map = new Map<string, Marker[]>();
    for (const marker of markers) {
      const key = identity(marker.episode_key, marker.season, marker.episode);
      map.set(key, [...(map.get(key) || []), marker]);
    }
    return map;
  }, [markers]);
  const summary = useMemo(() => creditsSummary(markers), [markers]);
  const lengths = useMemo(() => new Map(markers.filter(record => record.episode_key.startsWith('length:') && record.source === 'admin').map(record => [record.episode_key, record])), [markers]);
  const [view, setView] = useState<'todo' | 'validated'>('todo');
  const [justSaved, setJustSaved] = useState<Record<string, boolean>>({});
  // A length set for the whole series validates all of its episodes.
  const seriesLength = (item: Series, list?: Season[]) => {
    const keys = list ? lengthKeys(item, list) : [seriesLengthKey(`media:${item.id}`), ...(item.tmdb_id ? [seriesLengthKey(`tmdb:${item.tmdb_id}`)] : [])];
    for (const key of keys) if (lengths.has(key)) return lengths.get(key);
  };
  const covered = (row: Row, length?: Marker) => !!(row.manual || length || row.automatic);
  // An episode just saved stays in view so its validated state is visible.
  const matches = (row: Row, length?: Marker) => justSaved[row.id] || filter === 'all' || filter === 'missing' && !covered(row, length) || filter === 'filled' && covered(row, length) || row.status === filter;
  const query = search.trim().toLocaleLowerCase();
  // Validated: one length for the whole series, or a manual time on every episode.
  const validated = (item: Series) => {
    const list = seasons[String(item.id)];
    if (seriesLength(item, list)) return true;
    const rows = list ? episodeRows(item, list, lookup) : [];
    return rows.length > 0 && rows.every(row => row.manual);
  };
  const searched = series.filter(item => item.title.toLocaleLowerCase().includes(query));
  const validatedCount = searched.filter(validated).length;
  const groups = searched.filter(item => validated(item) === (view === 'validated')).sort((a, b) => a.title.localeCompare(b.title, 'fr', { sensitivity: 'base', numeric: true }));
  const pageCount = Math.max(1, Math.ceil(groups.length / 10));
  const currentPage = Math.min(page, pageCount - 1);
  const visible = groups.slice(currentPage * 10, (currentPage + 1) * 10);

  async function scanCatalogue(mediaId?: string) {
    if (scanController.current) return;
    const targets = mediaId ? series.filter(item => String(item.id) === String(mediaId)) : groups;
    const controller = new AbortController();
    scanController.current = controller;
    const progress: Scan = { done: 0, found: 0, failed: 0, current: '', seriesDone: 0, seriesTotal: targets.length };
    setScan({ ...progress }); setError(''); setMessage('');
    try {
      for (const item of targets) {
        if (controller.signal.aborted) break;
        progress.current = item.title; setScan({ ...progress });
        const current = new Map<string, Marker[]>();
        for (const marker of markersRef.current) {
          const key = identity(marker.episode_key, marker.season, marker.episode);
          current.set(key, [...(current.get(key) || []), marker]);
        }
        let pending: Row[] = [];
        try {
          const list = await loadSeasons(String(item.id));
          const keys = lengthKeys(item, list);
          if (!markersRef.current.some(record => keys.includes(record.episode_key) && record.source === 'admin')) pending = episodeRows(item, list, current).filter(row => !row.manual && !row.automatic);
        }
        catch { progress.failed++; }
        for (const row of pending) {
          if (controller.signal.aborted) break;
          progress.current = `${item.title} · S${row.season} E${row.episode}`;
          setScan({ ...progress });
          try {
            const { data: { session } } = await getPersistentSession();
            if (!session) throw new Error('Session expirée : reconnecte-toi pour reprendre le scan.');
            const response = await fetch('/api/episode-credits/scan', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ mediaId: row.item.id, season: row.season, episode: row.episode }), signal: controller.signal });
            const result = await response.json();
            if (response.status === 403) throw new Error('Session administrateur expirée. Reconnecte-toi.');
            if (response.ok && result.record) {
              const record = result.record as Marker;
              setMarkers(values => [...values.filter(value => !(value.episode_key === record.episode_key && value.season === record.season && value.episode === record.episode && value.duration_ms === record.duration_ms)), record]);
              if (record.start_sec !== null) progress.found++;
              if (result.incomplete && record.start_sec === null) progress.failed++;
            } else progress.failed++;
          } catch (cause) {
            if (controller.signal.aborted) break;
            if (cause instanceof Error && /[Ss]ession/.test(cause.message)) throw cause;
            progress.failed++;
          }
          progress.done++; setScan({ ...progress });
          // Keep comfortably below provider limits; only one episode at a time.
          await new Promise<void>(resolve => {
            const finish = () => { clearTimeout(timer); controller.signal.removeEventListener('abort', finish); resolve(); };
            const timer = setTimeout(finish, 750);
            controller.signal.addEventListener('abort', finish, { once: true });
            if (controller.signal.aborted) finish();
          });
        }
        if (!controller.signal.aborted) progress.seriesDone++;
      }
      setMessage(`${controller.signal.aborted ? 'Scan arrêté' : 'Scan terminé'} : ${progress.seriesDone}/${progress.seriesTotal} séries, ${progress.done} épisodes recherchés, ${progress.found} minutages disponibles${progress.failed ? `, ${progress.failed} recherches à réessayer` : ''}. Les résultats enregistrés sont conservés.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Scan interrompu. Tu peux le reprendre.'); }
    finally { scanController.current = null; setScan(null); setRevision(value => value + 1); }
  }

  async function save(row: Row) {
    const text = (drafts[row.id] ?? (row.manual ? formatTime(row.manual.start_sec!) : '')).trim();
    const seconds = text ? parseCreditsTime(text) : null;
    if (text && seconds === null) { setError('Saisis un temps valide, par exemple 42:15 ou 1:02:15 (maximum 8 heures).'); return; }
    setSaving(row.id); setError(''); setMessage('');
    try {
      // RLS permits writes only for the administrator, even outside this page.
      if (!text) {
        for (const key of new Set([row.key, `media:${row.item.id}`])) {
          const { error } = await supabase.from('episode_credits').delete().eq('episode_key', key).eq('season', row.season).eq('episode', row.episode).eq('source', 'admin');
          if (error) throw error;
        }
      } else {
        const { error } = await supabase.from('episode_credits').upsert({ episode_key: row.key, season: row.season, episode: row.episode, duration_ms: 0, start_sec: seconds, source: 'admin', checked_at: new Date().toISOString(), expires_at: null });
        if (error) throw error;
      }
      setJustSaved(values => ({ ...values, [row.id]: true }));
      setMessage(text ? `Épisode ${row.episode} validé : minutage manuel enregistré pour tous les appareils.` : 'Valeur manuelle retirée : API disponible, sinon 30 secondes avant la fin.');
      try { localStorage.setItem('yamonfim_credits_updated', JSON.stringify([row.id, text, revision])); } catch {}
      setRevision(value => value + 1);
    } catch { setError('Enregistrement impossible. Vérifie ta session administrateur et la migration de la base.'); }
    finally { setSaving(null); }
  }

  async function saveLength(item: Series, list: Season[]) {
    const id = `length:${item.id}`, keys = lengthKeys(item, list);
    const current = markers.find(record => keys.includes(record.episode_key) && record.source === 'admin');
    // « 0.05 » is accepted as 0:05.
    const text = (drafts[id] ?? (current ? formatTime(current.start_sec!) : '')).trim().replace('.', ':');
    const seconds = text ? parseCreditsTime(text) : null;
    if (text && (seconds === null || !validCreditsLength(seconds, Infinity, 1))) { setError('Saisis la durée du générique entre 0:01 et 5:00, par exemple 0:05 ou 1:00.'); return; }
    setSaving(id); setError(''); setMessage('');
    try {
      const { error } = text
        ? await supabase.from('episode_credits').upsert(keys.map(key => ({ episode_key: key, season: 1, episode: 1, duration_ms: 0, start_sec: seconds, source: 'admin', checked_at: new Date().toISOString(), expires_at: null })))
        : await supabase.from('episode_credits').delete().in('episode_key', keys).eq('source', 'admin');
      if (error) throw error;
      setMessage(text ? `${item.title} validée : tous les épisodes passent à la suite ${text} avant la fin.` : `Durée retirée pour ${item.title}.`);
      setRevision(value => value + 1);
    } catch { setError('Enregistrement impossible. Vérifie ta session administrateur.'); }
    finally { setSaving(null); }
  }

  return <main className="min-h-screen bg-[#0a0a0b] pb-16 text-white">
    <SectionNavigation admin />
    <div className="mx-auto max-w-6xl space-y-6 px-4 pt-10">
      <Link href="/admin" className="text-sm text-red-400">← Administration</Link>
      <h1 className="text-3xl font-bold">Génériques des épisodes</h1>
      <p className="max-w-3xl text-zinc-400">Saisis le début du générique (minutes:secondes). Le bouton apparaît à ce moment, puis la suite démarre après 5 secondes. Une valeur manuelle est prioritaire, puis la durée saisie pour toute la série, puis les services. Sans minutage pour un épisode, la durée mesurée sur ses autres épisodes est utilisée. Sinon, la suite démarre 30 secondes avant la fin.</p>
      <p className="text-sm text-zinc-400">Scanne une série pour importer ses minutages avant les visionnages. Les durées de référence des services sont enregistrées ; le lecteur vérifie leur compatibilité avec la vidéo. Les valeurs manuelles restent prioritaires.</p>
      {error && <p role="alert" className="rounded-xl border border-red-600/40 bg-red-950/30 p-4">{error} <button className="underline" onClick={() => setRevision(value => value + 1)}>Réessayer</button></p>}
      {message && <p role="status" className="rounded-xl bg-emerald-950/50 p-4 text-emerald-200">{message}</p>}
      {allowed && <>
        <nav aria-label="Pages des génériques" className="flex gap-2 border-b border-white/10">
          {([['todo', 'À faire', searched.length - validatedCount], ['validated', 'Validées', validatedCount]] as const).map(([value, label, count]) => <button key={value} aria-current={view === value ? 'page' : undefined} className={`-mb-px border-b-2 px-4 py-2 font-semibold ${view === value ? 'border-red-500 text-white' : 'border-transparent text-zinc-400 hover:text-white'}`} onClick={() => { setView(value); setPage(0); }}>{label} <span className="text-sm font-normal text-zinc-400">{loading ? '' : count}</span></button>)}
        </nav>
        <div className="flex flex-wrap gap-3">
          <input aria-label="Rechercher une série" placeholder="Rechercher une série…" className={`${field} min-w-0 grow`} value={search} onChange={event => { setSearch(event.target.value); setPage(0); }} />
          <select aria-label="Filtrer les épisodes affichés" className={field} value={filter} onChange={event => setFilter(event.target.value)}>
            <option value="missing">Épisodes à compléter</option><option value="filled">Déjà remplis</option><option value="absent">Vérifiés sans résultat</option><option value="unknown">Non vérifiés / à revérifier</option><option value="manual">Manuels</option><option value="automatic">Automatiques</option><option value="all">Tous les épisodes</option>
          </select>
          <button className={field} disabled={!!scan} onClick={() => setRevision(value => value + 1)}>Actualiser</button>
          {view === 'todo' && <button disabled={loading || !!scan || !groups.length} className="rounded-lg bg-red-600 px-4 py-2 font-semibold disabled:opacity-50" onClick={() => void scanCatalogue()}>{query ? `Scanner ces ${groups.length} séries` : 'Scanner toutes les séries'}</button>}
        </div>
        {scan && <div role="status" className="space-y-2 rounded-xl border border-red-500/30 bg-red-950/20 p-4"><p>Scan : {scan.seriesDone} / {scan.seriesTotal} séries · {scan.done} épisodes recherchés · {scan.found} minutages disponibles</p><p className="text-sm text-zinc-400">{scan.current}</p><progress className="h-2 w-full accent-red-600" value={scan.seriesDone} max={scan.seriesTotal} /><p className="text-xs text-zinc-400">Garde cette page ouverte pendant le scan. Tu peux arrêter puis reprendre sans perdre les résultats.</p><button className={field} onClick={() => scanController.current?.abort()}>Arrêter le scan</button></div>}
        <p className="text-sm text-zinc-400">{loading ? 'Chargement…' : `${groups.length} séries · ${summary.manual} minutages manuels · ${summary.automatic} automatiques`}</p>
        <div className="space-y-4">{visible.map(item => {
          const id = String(item.id), list = seasons[id];
          const rows = list ? episodeRows(item, list, lookup) : [];
          const length = seriesLength(item, list);
          const shown = rows.filter(row => matches(row, length));
          const filled = rows.filter(row => covered(row, length)).length;
          return <details key={id} open={!!expandedSeries[id]} onToggle={event => {
            const open = event.currentTarget.open;
            setExpandedSeries(values => values[id] === open ? values : { ...values, [id]: open });
            if (open) void openSeries(id);
          }} className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
            <summary className="cursor-pointer px-5 py-5 marker:text-red-400"><span className="ml-2 text-lg font-semibold">{item.title}</span>{length ? <span className="ml-3 text-sm font-semibold text-emerald-400">✓ Série validée · suite {formatTime(length.start_sec!)} avant la fin</span> : <span className="ml-3 text-sm text-zinc-400">{list ? `${filled} / ${rows.length} épisodes remplis` : `${summary.count(item)} minutages enregistrés`}</span>}</summary>
            {expandedSeries[id] && <div className="space-y-6 border-t border-white/10 p-4 sm:p-5">
              <div className="flex flex-wrap items-center gap-4"><Link href={`/watch/${item.id}`} className="inline-block text-sm text-red-400">Ouvrir la série →</Link><button disabled={loading || !!scan} className={`${field} text-sm disabled:opacity-50`} onClick={() => void scanCatalogue(id)}>Scanner cette série</button></div>
              {list && (() => {
                const current = length;
                const draftId = `length:${item.id}`;
                return <form className="flex flex-wrap items-center gap-3 rounded-xl border border-red-500/20 bg-red-950/10 p-4" onSubmit={event => { event.preventDefault(); void saveLength(item, list); }}>
                  <div className="min-w-48 flex-1"><strong className="text-sm">Générique de toute la série</strong>{current ? <p className={validatedClass}>✓ Série validée : tous les épisodes passent à la suite {formatTime(current.start_sec!)} avant la fin, sauf ceux avec une valeur manuelle.</p> : <p className="mt-1 text-xs text-zinc-400">Durée du générique de fin (ex. 1:00), appliquée à tous les épisodes de la série.</p>}</div>
                  <input aria-label={`Durée du générique de ${item.title}`} placeholder="0:45" className={`${field} w-28`} value={drafts[draftId] ?? (current ? formatTime(current.start_sec!) : '')} onChange={event => setDrafts(values => ({ ...values, [draftId]: event.target.value }))} />
                  <button disabled={saving !== null || loading || !!scan} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold disabled:opacity-50">{saving === draftId ? 'Enregistrement…' : 'Enregistrer'}</button>
                </form>;
              })()}
              {!list ? <p className="text-sm text-zinc-400">{opening[id] ? 'Chargement des épisodes…' : 'Épisodes indisponibles.'}</p>
                : !shown.length ? <p className="text-sm text-zinc-400">Aucun épisode pour ce filtre.</p>
                : [...new Set(shown.map(row => row.season))].map(season => <section key={season} aria-label={`${item.title}, saison ${season}`} className="space-y-3">
                <h2 className="text-base font-semibold text-zinc-200">Saison {season}</h2>
                {shown.filter(row => row.season === season).map(row => <form key={row.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-black/20 p-4" onSubmit={event => { event.preventDefault(); void save(row); }}>
                  <div className="min-w-48 flex-1"><strong className="text-sm">Épisode {row.episode} — {row.title || 'Épisode'}</strong>{row.manual ? <p className={validatedClass}>✓ Validé · manuel · {formatTime(row.manual.start_sec!)}</p> : length ? <p className={validatedClass}>✓ Validé · générique de la série, {formatTime(length.start_sec!)} avant la fin</p> : <p className="mt-1 text-xs text-zinc-400">{row.automatic ? `${row.automatic.source} · ${formatTime(row.automatic.start_sec!)}` : row.status === 'absent' ? 'Recherche sans minutage exploitable · estimation de la série ou secours 30 s' : row.checked ? 'À revérifier · estimation de la série ou secours 30 s' : 'Non vérifié · estimation de la série ou secours 30 s'}</p>}</div>
                  <input aria-label={`Début du générique ${row.item.title} saison ${row.season} épisode ${row.episode}`} placeholder="42:15" className={`${field} w-28`} value={drafts[row.id] ?? (row.manual ? formatTime(row.manual.start_sec!) : '')} onChange={event => setDrafts(values => ({ ...values, [row.id]: event.target.value }))} />
                  <button disabled={saving !== null || loading || !!scan} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold disabled:opacity-50">{saving === row.id ? 'Enregistrement…' : 'Enregistrer'}</button>
                </form>)}
              </section>)}
            </div>}
          </details>;
        })}</div>
        {!loading && !visible.length && !error && <p>{view === 'validated' ? 'Aucune série validée pour l’instant. Saisis la durée du générique d’une série pour la valider.' : 'Aucune série ne correspond à cette recherche.'}</p>}
        <div className="flex items-center justify-between"><button className={field} disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Précédent</button><span>Page {currentPage + 1} / {pageCount}</span><button className={field} disabled={currentPage + 1 >= pageCount} onClick={() => setPage(currentPage + 1)}>Suivant</button></div>
        <p className="text-xs text-zinc-500">Sources : <a href="https://theintrodb.org" className="underline">TheIntroDB</a>, <a href="https://introdb.app" className="underline">IntroDB</a>, <a href="https://skipdb.tv" className="underline">SkipDB</a> (consultation seule).</p>
      </>}
    </div>
  </main>;
}
