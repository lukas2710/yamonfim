'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import SectionNavigation from '@/components/SectionNavigation';
import { supabase } from '@/lib/supabase';
import { getPersistentSession } from '@/lib/auth-session';
import { fetchCatalogueRows } from '@/lib/catalogue';
import { parseCreditsTime } from '@/lib/credits-time';
import { creditsTmdb } from '@/lib/credits-identity';

type Series = { id: string; title: string; type: string; tmdb_id?: string | number; seasons?: { seasonNumber: number; episodes: { number: number; title?: string; embedUrl?: string }[] }[] };
type Marker = { episode_key: string; season: number; episode: number; duration_ms: number; start_sec: number | null; source: string; expires_at: string | null };
const identity = (key: string, season: number, episode: number) => `${key}/${season}/${episode}`;
const formatTime = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
const field = 'rounded-lg border border-white/15 bg-zinc-900 px-3 py-2 text-white';

export default function CreditsAdmin() {
  const [series, setSeries] = useState<Series[]>([]);
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [allowed, setAllowed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('missing');
  const [page, setPage] = useState(0);
  const [expandedSeries, setExpandedSeries] = useState<Record<string, boolean>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [scan, setScan] = useState<{ done: number; total: number; found: number; failed: number; current: string } | null>(null);
  const scanController = useRef<AbortController | null>(null);
  useEffect(() => () => scanController.current?.abort(), []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true); setError('');
      try {
        const { data: { session } } = await getPersistentSession();
        if (session?.user.email !== 'lukas.leclerc312@gmail.com') throw new Error('Connecte-toi avec le compte administrateur pour accéder à cette page.');
        setAllowed(true);
        const [catalogue, records] = await Promise.all([
          fetchCatalogueRows<Series>(supabase, 'id,title,type,tmdb_id,seasons'),
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
        if (!cancelled) { setSeries(catalogue.filter(item => item.type === 'series')); setMarkers(records); }
      } catch (cause) { if (!cancelled) setError(cause instanceof Error ? cause.message : 'Chargement impossible.'); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [revision]);

  const rows = useMemo(() => {
    const lookup = new Map<string, Marker[]>();
    for (const marker of markers) {
      const key = identity(marker.episode_key, marker.season, marker.episode);
      lookup.set(key, [...(lookup.get(key) || []), marker]);
    }
    return series.flatMap(item => (item.seasons || []).flatMap(season => season.episodes.map(episode => {
      const tmdb = creditsTmdb(item, episode.embedUrl);
      const key = tmdb ? `tmdb:${tmdb}` : `media:${item.id}`;
      const candidates = [...(lookup.get(identity(`media:${item.id}`, season.seasonNumber, episode.number)) || []), ...(lookup.get(identity(key, season.seasonNumber, episode.number)) || [])];
      const manual = candidates.find(record => record.source === 'admin');
      const automatic = candidates.find(record => record.start_sec !== null && record.source !== 'admin' && !!record.expires_at && Date.parse(record.expires_at) > Date.now());
      const missing = candidates.some(record => record.source === 'missing' && !!record.expires_at && Date.parse(record.expires_at) > Date.now());
      return { item, season: season.seasonNumber, episode: episode.number, title: episode.title, key, id: identity(key, season.seasonNumber, episode.number), manual, automatic, checked: candidates.length > 0, status: manual ? 'manual' : automatic ? 'automatic' : missing ? 'absent' : 'unknown' };
    })));
  }, [series, markers]);
  const coverage = new Map<string, { total: number; filled: number }>();
  for (const row of rows) {
    const count = coverage.get(String(row.item.id)) || { total: 0, filled: 0 };
    count.total++; if (row.manual || row.automatic) count.filled++;
    coverage.set(String(row.item.id), count);
  }
  const filtered = rows.filter(row => `${row.item.title} ${row.title || ''} s${row.season}e${row.episode}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()) && (
    filter === 'all' || filter === 'missing' && !row.manual && !row.automatic || filter === 'filled' && !!(row.manual || row.automatic)
    || filter === 'complete' && coverage.get(String(row.item.id))?.filled === coverage.get(String(row.item.id))?.total || row.status === filter
  ));
  const grouped = new Map<string, { item: Series; episodes: (typeof rows)[number][] }>();
  for (const row of filtered) {
    const key = String(row.item.id);
    if (!grouped.has(key)) grouped.set(key, { item: row.item, episodes: [] });
    grouped.get(key)!.episodes.push(row);
  }
  const groups = [...grouped.values()].sort((a, b) => a.item.title.localeCompare(b.item.title, 'fr', { sensitivity: 'base', numeric: true }));
  for (const group of groups) group.episodes.sort((a, b) => a.season - b.season || a.episode - b.episode);
  const pageCount = Math.max(1, Math.ceil(groups.length / 10));
  const currentPage = Math.min(page, pageCount - 1);
  const visible = groups.slice(currentPage * 10, (currentPage + 1) * 10);

  async function scanCatalogue(mediaId?: string) {
    if (scanController.current) return;
    const pending = rows.filter(row => (!mediaId || String(row.item.id) === String(mediaId)) && !row.manual && !row.automatic);
    if (!pending.length) { setMessage('Tous les épisodes sélectionnés disposent déjà d’un minutage.'); return; }
    const controller = new AbortController();
    scanController.current = controller;
    const progress = { done: 0, total: pending.length, found: 0, failed: 0, current: '' };
    setScan({ ...progress }); setError(''); setMessage('');
    try {
      for (const row of pending) {
        if (controller.signal.aborted) break;
        progress.current = `${row.item.title} · S${row.season} E${row.episode}`;
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
      setMessage(`${controller.signal.aborted ? 'Scan arrêté' : 'Scan terminé'} : ${progress.done}/${progress.total} épisodes, ${progress.found} minutages disponibles${progress.failed ? `, ${progress.failed} recherches à réessayer` : ''}. Les résultats enregistrés sont conservés.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Scan interrompu. Tu peux le reprendre.'); }
    finally { scanController.current = null; setScan(null); setRevision(value => value + 1); }
  }

  async function save(row: (typeof rows)[number]) {
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
      setMessage(text ? 'Minutage manuel enregistré pour tous les appareils.' : 'Valeur manuelle retirée : API disponible, sinon 30 secondes avant la fin.');
      try { localStorage.setItem('yamonfim_credits_updated', JSON.stringify([row.id, text, revision])); } catch {}
      setRevision(value => value + 1);
    } catch { setError('Enregistrement impossible. Vérifie ta session administrateur et la migration de la base.'); }
    finally { setSaving(null); }
  }

  return <main className="min-h-screen bg-[#0a0a0b] pb-16 text-white">
    <SectionNavigation admin />
    <div className="mx-auto max-w-6xl space-y-6 px-4 pt-10">
      <Link href="/admin" className="text-sm text-red-400">← Administration</Link>
      <h1 className="text-3xl font-bold">Génériques des épisodes</h1>
      <p className="max-w-3xl text-zinc-400">Saisis le début du générique (minutes:secondes). Le bouton apparaît à ce moment, puis la suite démarre après 5 secondes. Une valeur manuelle est prioritaire. Sans minutage exploitable, la suite démarre 30 secondes avant la fin.</p>
      <p className="text-sm text-zinc-400">Scanne le catalogue pour importer les minutages avant les visionnages. Les durées de référence des services sont enregistrées ; le lecteur vérifie leur compatibilité avec la vidéo. Les valeurs manuelles restent prioritaires.</p>
      {error && <p role="alert" className="rounded-xl border border-red-600/40 bg-red-950/30 p-4">{error} <button className="underline" onClick={() => setRevision(value => value + 1)}>Réessayer</button></p>}
      {message && <p role="status" className="rounded-xl bg-emerald-950/50 p-4 text-emerald-200">{message}</p>}
      {allowed && <>
        <div className="flex flex-wrap gap-3">
          <input aria-label="Rechercher une série ou un épisode" placeholder="Rechercher une série, un épisode…" className={`${field} min-w-0 grow`} value={search} onChange={event => { setSearch(event.target.value); setPage(0); }} />
          <select aria-label="Filtrer les minutages" className={field} value={filter} onChange={event => { setFilter(event.target.value); setPage(0); }}>
            <option value="missing">À compléter</option><option value="filled">Déjà remplis</option><option value="complete">Séries entièrement remplies</option><option value="absent">Vérifiés sans résultat</option><option value="unknown">Non vérifiés / à revérifier</option><option value="manual">Manuels</option><option value="automatic">Automatiques</option><option value="all">Tous les épisodes</option>
          </select>
          <button className={field} disabled={!!scan} onClick={() => setRevision(value => value + 1)}>Actualiser</button>
          <button disabled={loading || !!scan} className="rounded-lg bg-red-600 px-4 py-2 font-semibold disabled:opacity-50" onClick={() => void scanCatalogue()}>Scanner toutes les séries</button>
        </div>
        {scan && <div role="status" className="space-y-2 rounded-xl border border-red-500/30 bg-red-950/20 p-4"><p>Scan : {scan.done} / {scan.total} épisodes · {scan.found} minutages disponibles</p><p className="text-sm text-zinc-400">{scan.current}</p><progress className="h-2 w-full accent-red-600" value={scan.done} max={scan.total} /><p className="text-xs text-zinc-400">Garde cette page ouverte pendant le scan. Tu peux arrêter puis reprendre sans perdre les résultats.</p><button className={field} onClick={() => scanController.current?.abort()}>Arrêter le scan</button></div>}
        <p className="text-sm text-zinc-400">{loading ? 'Chargement…' : `${groups.length} séries · ${filtered.length} épisodes · ${rows.filter(row => row.manual).length} manuels · ${rows.filter(row => row.automatic).length} automatiques`}</p>
        <div className="space-y-4">{visible.map(group => <details key={group.item.id} open={!!expandedSeries[String(group.item.id)]} onToggle={event => {
          const open = event.currentTarget.open;
          setExpandedSeries(values => values[String(group.item.id)] === open ? values : { ...values, [String(group.item.id)]: open });
        }} className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
          <summary className="cursor-pointer px-5 py-5 marker:text-red-400"><span className="ml-2 text-lg font-semibold">{group.item.title}</span><span className="ml-3 text-sm text-zinc-400">{coverage.get(String(group.item.id))?.filled} / {coverage.get(String(group.item.id))?.total} épisodes remplis</span></summary>
          {expandedSeries[String(group.item.id)] && <div className="space-y-6 border-t border-white/10 p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-4"><Link href={`/watch/${group.item.id}`} className="inline-block text-sm text-red-400">Ouvrir la série →</Link><button disabled={loading || !!scan} className={`${field} text-sm disabled:opacity-50`} onClick={() => void scanCatalogue(String(group.item.id))}>Scanner cette série</button></div>
            {[...new Set(group.episodes.map(row => row.season))].map(season => <section key={season} aria-label={`${group.item.title}, saison ${season}`} className="space-y-3">
              <h2 className="text-base font-semibold text-zinc-200">Saison {season}</h2>
              {group.episodes.filter(row => row.season === season).map(row => <form key={row.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-black/20 p-4" onSubmit={event => { event.preventDefault(); void save(row); }}>
                <div className="min-w-48 flex-1"><strong className="text-sm">Épisode {row.episode} — {row.title || 'Épisode'}</strong><p className="mt-1 text-xs text-zinc-400">{row.manual ? `Manuel · ${formatTime(row.manual.start_sec!)}` : row.automatic ? `${row.automatic.source} · ${formatTime(row.automatic.start_sec!)}` : row.status === 'absent' ? 'Recherche sans minutage exploitable · secours 30 s' : row.checked ? 'À revérifier · secours 30 s' : 'Non vérifié · secours 30 s'}</p></div>
                <input aria-label={`Début du générique ${row.item.title} saison ${row.season} épisode ${row.episode}`} placeholder="42:15" className={`${field} w-28`} value={drafts[row.id] ?? (row.manual ? formatTime(row.manual.start_sec!) : '')} onChange={event => setDrafts(values => ({ ...values, [row.id]: event.target.value }))} />
                <button disabled={saving !== null || loading || !!scan} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold disabled:opacity-50">{saving === row.id ? 'Enregistrement…' : 'Enregistrer'}</button>
              </form>)}
            </section>)}
          </div>}
        </details>)}</div>
        {!loading && !visible.length && !error && <p>Aucun épisode pour ce filtre.</p>}
        <div className="flex items-center justify-between"><button className={field} disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Précédent</button><span>Page {currentPage + 1} / {pageCount}</span><button className={field} disabled={currentPage + 1 >= pageCount} onClick={() => setPage(currentPage + 1)}>Suivant</button></div>
        <p className="text-xs text-zinc-500">Sources : <a href="https://theintrodb.org" className="underline">TheIntroDB</a>, <a href="https://introdb.app" className="underline">IntroDB</a>, <a href="https://skipdb.tv" className="underline">SkipDB</a> (consultation seule).</p>
      </>}
    </div>
  </main>;
}
