'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface Episode {
  number: number;
  title: string;
  embedUrl: string;
  still_path?: string;
  runtime?: number;
}

interface Season {
  seasonNumber: number;
  episodes: Episode[];
  poster_path?: string;
}

interface MediaItem {
  id: any;
  title: string;
  type: 'movie' | 'series';
  poster: string;
  backdrop?: string;
  seasons?: Season[];
}

interface HistoryRow {
  media_id: string;
  season_idx: number | null;
  episode_idx: number | null;
  season_number: number | null;
  episode_number: number | null;
  updated_at: string;
}

const MOVIE_KEY = 'movie_main';
const DEFAULT_MOVIE_MIN = 120;
const DEFAULT_EPISODE_MIN = 45;

/* ------------------------------------------------------------------ */
/* Utilitaires                                                         */
/* ------------------------------------------------------------------ */

const timeAgo = (iso?: string) => {
  if (!iso) return '';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (!Number.isFinite(diff)) return '';
  if (diff < 60) return "à l'instant";
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`;
  if (diff < 86400 * 7) return `il y a ${Math.floor(diff / 86400)} j`;
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
};

const formatDuration = (minutes: number) => {
  if (minutes < 60) return { value: String(minutes), unit: 'min' };
  const h = minutes / 60;
  return { value: h >= 10 ? Math.round(h).toString() : h.toFixed(1).replace('.', ','), unit: 'h' };
};

/* ------------------------------------------------------------------ */
/* Icônes                                                              */
/* ------------------------------------------------------------------ */

type IconName =
  | 'back' | 'play' | 'film' | 'tv' | 'clock' | 'check' | 'close' | 'trash'
  | 'search' | 'history' | 'list';

const ICONS: Record<IconName, React.ReactNode> = {
  back: <path d="M19 12H5m6-7-7 7 7 7" />,
  play: <path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5Z" fill="currentColor" stroke="none" />,
  film: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M7 4v16M17 4v16M3 9h4m10 0h4M3 15h4m10 0h4" /></>,
  tv: <><rect x="3" y="6" width="18" height="13" rx="2" /><path d="m8 2 4 4 4-4" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  close: <path d="M18 6 6 18M6 6l12 12" />,
  trash: <><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  history: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5M12 7v5l3 2" /></>,
  list: <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />,
};

function Icon({ name, className = 'w-4 h-4' }: { name: IconName; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function HistoryPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [mediaById, setMediaById] = useState<Record<string, MediaItem>>({});
  // Vus de CE compte : { [media_id]: { [ep_key]: date } }
  const [watched, setWatched] = useState<Record<string, Record<string, string>>>({});
  const [history, setHistory] = useState<HistoryRow[]>([]);

  const [tab, setTab] = useState<'all' | 'movie' | 'series'>('all');
  const [query, setQuery] = useState('');
  const [selectedSeriesId, setSelectedSeriesId] = useState<string | null>(null);
  const [activeSeasonIdx, setActiveSeasonIdx] = useState(0);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [tableMissing, setTableMissing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  /* ---------------- Chargement ---------------- */

  useEffect(() => {
    async function load() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.push('/login');
          return;
        }
        const uid = session.user.id;
        setUserId(uid);

        const [watchedRes, historyRes] = await Promise.all([
          supabase.from('user_watched').select('media_id, ep_key, watched_at').eq('user_id', uid),
          supabase.from('watch_history').select('*').eq('user_id', uid).order('updated_at', { ascending: false }),
        ]);

        if (watchedRes.error) {
          console.error('Erreur user_watched :', watchedRes.error);
          setTableMissing(true); // le script SQL n'a pas encore été lancé
        }

        const w: Record<string, Record<string, string>> = {};
        (watchedRes.data || []).forEach((r: any) => {
          const mid = String(r.media_id);
          if (!w[mid]) w[mid] = {};
          w[mid][r.ep_key] = r.watched_at;
        });

        const h: HistoryRow[] = (historyRes.data || []).map((r: any) => ({ ...r, media_id: String(r.media_id) }));

        const ids = Array.from(new Set([...Object.keys(w), ...h.map(r => r.media_id)]));
        const byId: Record<string, MediaItem> = {};
        if (ids.length > 0) {
          const { data: mediaData } = await supabase
            .from('media')
            .select('id, title, type, poster, backdrop, seasons')
            .in('id', ids);
          (mediaData || []).forEach((m: any) => { byId[String(m.id)] = m; });
        }

        setWatched(w);
        setHistory(h);
        setMediaById(byId);
      } catch (err) {
        console.error('Erreur historique :', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  /* ---------------- Actions (propres au compte) ---------------- */

  const toggleWatched = async (mediaId: string, key: string) => {
    if (!userId) return;
    const isWatched = !!watched[mediaId]?.[key];

    // Mise à jour immédiate de l'écran
    setWatched(prev => {
      const next = { ...prev, [mediaId]: { ...(prev[mediaId] || {}) } };
      if (isWatched) delete next[mediaId][key];
      else next[mediaId][key] = new Date().toISOString();
      return next;
    });

    if (isWatched) {
      await supabase.from('user_watched').delete()
        .eq('user_id', userId).eq('media_id', mediaId).eq('ep_key', key);
    } else {
      await supabase.from('user_watched').upsert(
        { user_id: userId, media_id: mediaId, ep_key: key, watched_at: new Date().toISOString() },
        { onConflict: 'user_id,media_id,ep_key' }
      );
    }
  };

  const markSeasonWatched = async (mediaId: string, seasonIdx: number, value: boolean) => {
    if (!userId) return;
    const season = mediaById[mediaId]?.seasons?.[seasonIdx];
    if (!season) return;
    const keys = season.episodes.map((_, eIdx) => `s${seasonIdx}_e${eIdx}`);
    const now = new Date().toISOString();

    setWatched(prev => {
      const next = { ...prev, [mediaId]: { ...(prev[mediaId] || {}) } };
      keys.forEach(k => { if (value) next[mediaId][k] = now; else delete next[mediaId][k]; });
      return next;
    });

    if (value) {
      await supabase.from('user_watched').upsert(
        keys.map(k => ({ user_id: userId, media_id: mediaId, ep_key: k, watched_at: now })),
        { onConflict: 'user_id,media_id,ep_key' }
      );
    } else {
      await supabase.from('user_watched').delete()
        .eq('user_id', userId).eq('media_id', mediaId).in('ep_key', keys);
    }
  };

  // Ajoute/retire une liste d'épisodes en une seule fois
  const setManyWatched = async (mediaId: string, keys: string[], value: boolean) => {
    if (!userId || keys.length === 0) return;
    const now = new Date().toISOString();
    setWatched(prev => {
      const next = { ...prev, [mediaId]: { ...(prev[mediaId] || {}) } };
      keys.forEach(k => { if (value) next[mediaId][k] = now; else delete next[mediaId][k]; });
      return next;
    });
    if (value) {
      await supabase.from('user_watched').upsert(
        keys.map(k => ({ user_id: userId, media_id: mediaId, ep_key: k, watched_at: now })),
        { onConflict: 'user_id,media_id,ep_key' }
      );
    } else {
      await supabase.from('user_watched').delete()
        .eq('user_id', userId).eq('media_id', mediaId).in('ep_key', keys);
    }
  };

  // Tous les épisodes d'une série (ou jusqu'à un épisode précis, inclus)
  const episodeKeys = (mediaId: string, upTo?: { s: number; e: number }) => {
    const seasons = mediaById[mediaId]?.seasons || [];
    const keys: string[] = [];
    seasons.forEach((season, sIdx) => {
      season.episodes.forEach((_, eIdx) => {
        if (!upTo || sIdx < upTo.s || (sIdx === upTo.s && eIdx <= upTo.e)) keys.push(`s${sIdx}_e${eIdx}`);
      });
    });
    return keys;
  };

  const markUpTo = async (mediaId: string, s: number, e: number) => {
    await setManyWatched(mediaId, episodeKeys(mediaId, { s, e }), true);
    setToast(`Épisodes marqués comme vus jusqu'à S${mediaById[mediaId]?.seasons?.[s]?.seasonNumber ?? s + 1} · É${e + 1}`);
  };

  const markWholeSeries = async (mediaId: string, value: boolean) => {
    await setManyWatched(mediaId, episodeKeys(mediaId), value);
    setToast(value ? 'Série marquée comme vue' : 'Tous les épisodes décochés');
  };

  const clearAll = async () => {
    if (!userId) return;
    setConfirmClearAll(false);
    setWatched({});
    setHistory([]);
    await Promise.all([
      supabase.from('user_watched').delete().eq('user_id', userId),
      supabase.from('watch_history').delete().eq('user_id', userId),
    ]);
    setToast('Historique effacé');
  };

  const removeFromHistory = async (mediaId: string) => {
    if (!userId) return;
    setConfirmRemoveId(null);
    setWatched(prev => { const n = { ...prev }; delete n[mediaId]; return n; });
    setHistory(prev => prev.filter(r => r.media_id !== mediaId));
    if (selectedSeriesId === mediaId) setSelectedSeriesId(null);

    await Promise.all([
      supabase.from('user_watched').delete().eq('user_id', userId).eq('media_id', mediaId),
      supabase.from('watch_history').delete().eq('user_id', userId).eq('media_id', mediaId),
    ]);
  };

  /* ---------------- Données dérivées ---------------- */

  const entries = useMemo(() => {
    const ids = Array.from(new Set([...Object.keys(watched), ...history.map(r => r.media_id)]));
    return ids
      .map(id => {
        const media = mediaById[id];
        if (!media) return null;
        const w = watched[id] || {};
        const h = history.find(r => r.media_id === id);
        const total = media.type === 'series'
          ? (media.seasons || []).reduce((n, s) => n + (s.episodes?.length || 0), 0)
          : 1;
        const seen = media.type === 'series'
          ? Object.keys(w).filter(k => k !== MOVIE_KEY).length
          : (w[MOVIE_KEY] ? 1 : 0);
        const lastWatched = Object.values(w).sort().pop();
        const lastActivity = [h?.updated_at, lastWatched].filter(Boolean).sort().pop() || '';
        return { id, media, history: h, total, seen, lastActivity };
      })
      .filter((e): e is NonNullable<typeof e> => !!e)
      .sort((a, b) => (b.lastActivity || '').localeCompare(a.lastActivity || ''));
  }, [watched, history, mediaById]);

  const stats = useMemo(() => {
    let minutes = 0;
    let movies = 0;
    let episodes = 0;
    Object.entries(watched).forEach(([id, keys]) => {
      const media = mediaById[id];
      if (!media) return;
      Object.keys(keys).forEach(k => {
        if (k === MOVIE_KEY) {
          movies++;
          minutes += DEFAULT_MOVIE_MIN;
        } else {
          const m = /^s(\d+)_e(\d+)$/.exec(k);
          if (!m) return;
          episodes++;
          const ep = media.seasons?.[Number(m[1])]?.episodes?.[Number(m[2])];
          minutes += ep?.runtime || DEFAULT_EPISODE_MIN;
        }
      });
    });
    return { minutes, movies, episodes };
  }, [watched, mediaById]);

  // "Reprendre" : séries pas encore terminées + films commencés
  const continueList = entries
    .filter(e => e.history && (e.media.type === 'movie' || e.seen < e.total))
    .slice(0, 10);

  const q = query.trim().toLowerCase();
  const visible = entries.filter(e =>
    (tab === 'all' || e.media.type === tab) &&
    (!q || (e.media.title || '').toLowerCase().includes(q))
  );

  const selected = selectedSeriesId ? mediaById[selectedSeriesId] : null;
  const duration = formatDuration(stats.minutes);

  const openWatch = (e: (typeof entries)[number]) => {
    const h = e.history;
    if (e.media.type === 'series' && h) {
      router.push(`/watch/${e.id}?s=${h.season_idx ?? 0}&e=${h.episode_idx ?? 0}`);
    } else {
      router.push(`/watch/${e.id}`);
    }
  };

  /* ---------------- Chargement ---------------- */

  if (loading) {
    return (
      <main className="min-h-screen bg-[#0a0a0b] text-white">
        <div className="h-16 border-b border-white/5" />
        <div className="mx-auto max-w-6xl space-y-6 px-4 pt-10 sm:px-8">
          <div className="h-10 w-56 animate-pulse rounded-xl bg-zinc-800" />
          <div className="grid grid-cols-3 gap-3">
            {[0, 1, 2].map(i => <div key={i} className="h-24 animate-pulse rounded-2xl bg-zinc-900" />)}
          </div>
          <div className="flex gap-4 overflow-hidden">
            {[0, 1, 2, 3].map(i => <div key={i} className="aspect-video w-64 shrink-0 animate-pulse rounded-2xl bg-zinc-900" />)}
          </div>
        </div>
      </main>
    );
  }

  /* ---------------- Rendu ---------------- */

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[#0a0a0b] pb-24 font-sans text-white antialiased selection:bg-red-600 selection:text-white">
      <div className="pointer-events-none absolute -top-56 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-red-600/10 blur-[140px]" />

      {/* ================= Header ================= */}
      <header className="sticky top-0 z-40 border-b border-white/5 bg-[#0a0a0b]/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-8">
          <button
            onClick={() => router.push('/')}
            className="group inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 py-2 pl-3 pr-4 text-sm font-medium text-zinc-200 transition hover:bg-white/10 hover:text-white"
          >
            <Icon name="back" className="h-4 w-4 transition group-hover:-translate-x-0.5" /> Accueil
          </button>
          <span className="select-none text-lg font-black tracking-[0.2em] text-red-600">
            YAMON<span className="text-white">FIM</span>
          </span>
          <span className="hidden w-[100px] sm:block" />
        </div>
      </header>

      <div className="relative mx-auto max-w-6xl space-y-12 px-4 pt-10 sm:px-8">

        {/* ================= Titre + stats ================= */}
        <section>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-red-500">Mon historique</p>
              <h1 className="text-3xl font-black tracking-tight sm:text-5xl">Ce que tu as regardé</h1>
            </div>
            {entries.length > 0 && (
              confirmClearAll ? (
                <div className="flex items-center gap-2 rounded-full bg-red-600/10 py-1 pl-4 pr-1 ring-1 ring-red-500/30">
                  <span className="text-xs text-red-200">Tout effacer ?</span>
                  <button onClick={clearAll} className="rounded-full bg-red-600 px-3 py-1.5 text-xs font-bold hover:bg-red-500">Oui</button>
                  <button onClick={() => setConfirmClearAll(false)} className="rounded-full px-3 py-1.5 text-xs text-zinc-300 hover:text-white">Non</button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmClearAll(true)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-4 py-2 text-xs font-semibold text-zinc-400 ring-1 ring-white/10 transition hover:bg-red-600/15 hover:text-red-300"
                >
                  <Icon name="trash" className="h-3.5 w-3.5" /> Tout effacer
                </button>
              )
            )}
          </div>

          {tableMissing && (
            <div className="mt-6 flex items-start gap-3 rounded-2xl bg-amber-500/10 px-4 py-3 ring-1 ring-amber-500/30">
              <Icon name="clock" className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
              <p className="text-sm text-amber-100">
                Le suivi des épisodes vus n'est pas encore activé. Lance le script <span className="font-mono text-xs">supabase-historique-par-compte.sql</span> dans Supabase.
              </p>
            </div>
          )}

          <div className="mt-8 grid grid-cols-3 gap-3 sm:gap-4">
            <div className="rounded-2xl bg-gradient-to-br from-red-600/20 to-red-600/5 p-4 ring-1 ring-red-500/30 sm:p-5">
              <div className="flex items-center justify-between text-red-300">
                <span className="text-[11px] font-semibold uppercase tracking-wider sm:text-xs">Temps</span>
                <Icon name="clock" className="h-4 w-4" />
              </div>
              <p className="mt-2 text-2xl font-black tabular-nums sm:text-4xl">
                {duration.value}<span className="ml-1 text-sm font-semibold text-red-300 sm:text-base">{duration.unit}</span>
              </p>
            </div>
            <div className="rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/10 sm:p-5">
              <div className="flex items-center justify-between text-zinc-500">
                <span className="text-[11px] font-semibold uppercase tracking-wider sm:text-xs">Films</span>
                <Icon name="film" className="h-4 w-4" />
              </div>
              <p className="mt-2 text-2xl font-black tabular-nums sm:text-4xl">{stats.movies}</p>
            </div>
            <div className="rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/10 sm:p-5">
              <div className="flex items-center justify-between text-zinc-500">
                <span className="text-[11px] font-semibold uppercase tracking-wider sm:text-xs">Épisodes</span>
                <Icon name="tv" className="h-4 w-4" />
              </div>
              <p className="mt-2 text-2xl font-black tabular-nums sm:text-4xl">{stats.episodes}</p>
            </div>
          </div>
        </section>

        {entries.length === 0 ? (
          <section className="flex flex-col items-center justify-center gap-4 rounded-3xl border border-dashed border-white/10 py-20 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 text-zinc-500">
              <Icon name="history" className="h-6 w-6" />
            </span>
            <div>
              <p className="text-lg font-semibold">Ton historique est vide</p>
              <p className="mt-1 text-sm text-zinc-500">Les films et épisodes que tu regardes apparaîtront ici.</p>
            </div>
            <button
              onClick={() => router.push('/')}
              className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-bold text-black transition hover:bg-zinc-200"
            >
              <Icon name="play" /> Découvrir le catalogue
            </button>
          </section>
        ) : (
          <>
            {/* ================= Reprendre ================= */}
            {continueList.length > 0 && (
              <section>
                <h2 className="mb-4 flex items-center gap-2 text-xl font-bold tracking-tight">
                  <Icon name="play" className="h-4 w-4 text-red-600" /> Reprendre
                </h2>
                <div className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:-mx-8 sm:px-8 [&::-webkit-scrollbar]:hidden">
                  {continueList.map(e => {
                    const pct = e.total ? Math.round((e.seen / e.total) * 100) : 0;
                    return (
                      <button
                        key={e.id}
                        onClick={() => openWatch(e)}
                        className="group relative aspect-video w-[260px] shrink-0 snap-start overflow-hidden rounded-2xl bg-zinc-900 text-left ring-1 ring-white/10 transition hover:-translate-y-1 hover:ring-white/25 sm:w-[300px]"
                      >
                        {(e.media.backdrop || e.media.poster) && (
                          <img
                            src={e.media.backdrop || e.media.poster}
                            alt=""
                            loading="lazy"
                            className={`absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105 ${e.media.backdrop ? '' : 'object-[center_20%]'}`}
                          />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
                        <span className="absolute left-1/2 top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-black opacity-0 shadow-xl transition group-hover:opacity-100">
                          <Icon name="play" className="h-5 w-5 translate-x-[1px]" />
                        </span>
                        <div className="absolute inset-x-0 bottom-0 p-3.5">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-red-500">
                            {e.media.type === 'series' && e.history
                              ? `S${e.history.season_number ?? 1} · É${e.history.episode_number ?? 1}`
                              : 'Film'}
                            <span className="ml-2 font-medium normal-case tracking-normal text-zinc-400">{timeAgo(e.lastActivity)}</span>
                          </p>
                          <p className="truncate text-sm font-bold">{e.media.title}</p>
                          {e.media.type === 'series' && (
                            <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/15">
                              <div className="h-full rounded-full bg-red-600" style={{ width: `${pct}%` }} />
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            {/* ================= Tout l'historique ================= */}
            <section>
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <h2 className="text-xl font-bold tracking-tight">Tout mon historique</h2>
                <div className="relative w-full sm:w-64">
                  <Icon name="search" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                  <input
                    type="text"
                    value={query}
                    onChange={ev => setQuery(ev.target.value)}
                    placeholder="Rechercher…"
                    className="w-full rounded-full border border-white/10 bg-black/30 py-2.5 pl-10 pr-4 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-red-600/70 focus:ring-4 focus:ring-red-600/15"
                  />
                </div>
              </div>

              <div className="mb-5 flex gap-2">
                {([
                  { key: 'all', label: 'Tout' },
                  { key: 'movie', label: 'Films' },
                  { key: 'series', label: 'Séries' },
                ] as const).map(t => (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                      tab === t.key ? 'bg-white text-black' : 'bg-white/5 text-zinc-400 ring-1 ring-white/10 hover:text-white'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {visible.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-white/10 py-10 text-center text-sm text-zinc-500">
                  Rien à afficher.
                </p>
              ) : (
                <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {visible.map(e => {
                    const isSeries = e.media.type === 'series';
                    const pct = e.total ? Math.round((e.seen / e.total) * 100) : 0;
                    const done = isSeries ? e.total > 0 && e.seen >= e.total : e.seen === 1;
                    return (
                      <li key={e.id} className="flex flex-col rounded-2xl bg-white/[0.03] p-3 ring-1 ring-white/10 transition hover:bg-white/[0.05]">
                        <div className="flex gap-3">
                          <button
                            onClick={() => openWatch(e)}
                            className="group relative h-24 w-16 shrink-0 overflow-hidden rounded-xl bg-zinc-900"
                            aria-label={`Regarder ${e.media.title}`}
                          >
                            {e.media.poster && <img src={e.media.poster} alt="" loading="lazy" className="h-full w-full object-cover" />}
                            <span className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition group-hover:opacity-100">
                              <Icon name="play" className="h-5 w-5" />
                            </span>
                          </button>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-300">
                                {isSeries ? 'Série' : 'Film'}
                              </span>
                              {done && (
                                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                                  <Icon name="check" className="h-3 w-3" /> {isSeries ? 'Terminée' : 'Vu'}
                                </span>
                              )}
                            </div>
                            <p className="mt-1 truncate text-sm font-bold">{e.media.title}</p>
                            <p className="text-xs text-zinc-500">{timeAgo(e.lastActivity)}</p>
                            {isSeries && (
                              <>
                                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                                  <div className={`h-full rounded-full ${done ? 'bg-emerald-500' : 'bg-red-600'}`} style={{ width: `${pct}%` }} />
                                </div>
                                <p className="mt-1 text-[11px] text-zinc-500">{e.seen} / {e.total} épisodes</p>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="mt-3 flex items-center gap-2 border-t border-white/5 pt-3">
                          {confirmRemoveId === e.id ? (
                            <>
                              <span className="flex-1 text-xs text-zinc-400">Retirer de l'historique ?</span>
                              <button onClick={() => removeFromHistory(e.id)} className="rounded-full bg-red-600 px-3 py-1.5 text-xs font-bold hover:bg-red-500">Oui</button>
                              <button onClick={() => setConfirmRemoveId(null)} className="rounded-full px-3 py-1.5 text-xs text-zinc-400 hover:text-white">Non</button>
                            </>
                          ) : (
                            <>
                              {isSeries ? (
                                <button
                                  onClick={() => { setSelectedSeriesId(e.id); setActiveSeasonIdx(0); }}
                                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-white/10 py-2 text-xs font-semibold transition hover:bg-white/15"
                                >
                                  <Icon name="list" className="h-3.5 w-3.5" /> Gérer les épisodes
                                </button>
                              ) : (
                                <button
                                  onClick={() => toggleWatched(e.id, MOVIE_KEY)}
                                  className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-xs font-semibold transition ${
                                    e.seen ? 'bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25' : 'bg-white/10 hover:bg-white/15'
                                  }`}
                                >
                                  <Icon name="check" className="h-3.5 w-3.5" /> {e.seen ? 'Vu' : 'Marquer comme vu'}
                                </button>
                              )}
                              <button
                                onClick={() => openWatch(e)}
                                className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-xs font-bold text-black transition hover:bg-zinc-200"
                              >
                                <Icon name="play" className="h-3.5 w-3.5" /> {e.history ? 'Reprendre' : 'Regarder'}
                              </button>
                              <button
                                onClick={() => setConfirmRemoveId(e.id)}
                                aria-label="Retirer de l'historique"
                                className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-500 transition hover:bg-red-600/15 hover:text-red-400"
                              >
                                <Icon name="trash" className="h-3.5 w-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </>
        )}
      </div>

      {/* ================= Notification ================= */}
      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex justify-center px-4">
          <div className="flex items-center gap-2 rounded-full bg-[#111113]/95 px-4 py-2.5 text-sm shadow-2xl ring-1 ring-emerald-500/30 backdrop-blur-xl">
            <Icon name="check" className="h-4 w-4 text-emerald-400" /> {toast}
          </div>
        </div>
      )}

      {/* ================= Gestion des épisodes ================= */}
      {selected && selectedSeriesId && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 p-0 backdrop-blur-md sm:items-center sm:p-4"
          onClick={() => setSelectedSeriesId(null)}
        >
          <div
            onClick={ev => ev.stopPropagation()}
            className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-[#111113] shadow-2xl sm:rounded-3xl"
          >
            <div className="relative shrink-0 overflow-hidden">
              {(selected.backdrop || selected.poster) && (
                <img src={selected.backdrop || selected.poster} alt="" className="absolute inset-0 h-full w-full object-cover opacity-30" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-[#111113] to-[#111113]/40" />
              <div className="relative flex items-start justify-between gap-3 p-5">
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-red-500">Mes épisodes vus</p>
                  <h3 className="truncate text-lg font-bold">{selected.title}</h3>
                </div>
                <button
                  onClick={() => setSelectedSeriesId(null)}
                  aria-label="Fermer"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 transition hover:bg-white/15"
                >
                  <Icon name="close" />
                </button>
              </div>

              {selected.seasons && selected.seasons.length > 1 && (
                <div className="relative flex gap-2 overflow-x-auto px-5 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {selected.seasons.map((season, sIdx) => (
                    <button
                      key={sIdx}
                      onClick={() => setActiveSeasonIdx(sIdx)}
                      className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                        activeSeasonIdx === sIdx ? 'bg-white text-black' : 'bg-white/10 text-zinc-300 hover:bg-white/15'
                      }`}
                    >
                      Saison {season.seasonNumber}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {(() => {
              const season = selected.seasons?.[activeSeasonIdx];
              if (!season) return <p className="p-5 text-sm text-zinc-500">Aucun épisode.</p>;
              const w = watched[selectedSeriesId] || {};
              const seenInSeason = season.episodes.filter((_, eIdx) => !!w[`s${activeSeasonIdx}_e${eIdx}`]).length;
              const allSeen = seenInSeason === season.episodes.length && season.episodes.length > 0;

              const allKeys = episodeKeys(selectedSeriesId);
              const seenTotal = allKeys.filter(k => !!w[k]).length;
              const seriesDone = allKeys.length > 0 && seenTotal === allKeys.length;

              // Position actuelle (Reprendre) → proposer de cocher tous les épisodes d'avant
              const h = history.find(r => r.media_id === selectedSeriesId);
              let prevPos: { s: number; e: number } | null = null;
              if (h) {
                const s = h.season_idx ?? 0;
                const e = h.episode_idx ?? 0;
                if (e > 0) prevPos = { s, e: e - 1 };
                else if (s > 0) {
                  const prevLen = selected.seasons?.[s - 1]?.episodes?.length || 0;
                  if (prevLen > 0) prevPos = { s: s - 1, e: prevLen - 1 };
                }
              }
              const prevKeys = prevPos ? episodeKeys(selectedSeriesId, prevPos) : [];
              const prevAllSeen = prevKeys.length > 0 && prevKeys.every(k => !!w[k]);

              return (
                <>
                  {/* Progression globale + actions rapides */}
                  <div className="shrink-0 space-y-3 border-y border-white/5 px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                        <div
                          className={`h-full rounded-full transition-all ${seriesDone ? 'bg-emerald-500' : 'bg-red-600'}`}
                          style={{ width: `${allKeys.length ? (seenTotal / allKeys.length) * 100 : 0}%` }}
                        />
                      </div>
                      <span className="text-xs tabular-nums text-zinc-400">{seenTotal} / {allKeys.length}</span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {h && prevPos && !prevAllSeen && (
                        <button
                          onClick={() => markUpTo(selectedSeriesId, prevPos!.s, prevPos!.e)}
                          className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-500"
                        >
                          <Icon name="check" className="h-3.5 w-3.5" />
                          J'ai vu tout avant S{h.season_number ?? (h.season_idx ?? 0) + 1} · É{h.episode_number ?? (h.episode_idx ?? 0) + 1}
                        </button>
                      )}
                      <button
                        onClick={() => markSeasonWatched(selectedSeriesId, activeSeasonIdx, !allSeen)}
                        className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold transition hover:bg-white/15"
                      >
                        {allSeen ? `Décocher la saison ${season.seasonNumber}` : `Saison ${season.seasonNumber} vue`}
                      </button>
                      <button
                        onClick={() => markWholeSeries(selectedSeriesId, !seriesDone)}
                        className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold transition hover:bg-white/15"
                      >
                        {seriesDone ? 'Tout décocher' : 'Série entière vue'}
                      </button>
                    </div>
                  </div>

                  {/* Épisodes : clic = vu / pas vu · « Jusqu'ici » = coche tous les épisodes avant celui-ci */}
                  <div className="flex-1 space-y-2 overflow-y-auto p-4">
                    {season.episodes.map((ep, eIdx) => {
                      const key = `s${activeSeasonIdx}_e${eIdx}`;
                      const isWatched = !!w[key];
                      const isCurrent = h && (h.season_idx ?? 0) === activeSeasonIdx && (h.episode_idx ?? 0) === eIdx;
                      return (
                        <div
                          key={eIdx}
                          className={`group flex items-center gap-3 rounded-2xl p-2.5 ring-1 transition ${
                            isWatched ? 'bg-emerald-500/10 ring-emerald-500/30' : 'bg-white/[0.03] ring-white/10 hover:bg-white/[0.06]'
                          }`}
                        >
                          <button
                            onClick={() => toggleWatched(selectedSeriesId, key)}
                            className="flex min-w-0 flex-1 items-center gap-3 text-left"
                            aria-pressed={isWatched}
                          >
                            <div className="relative aspect-video w-24 shrink-0 overflow-hidden rounded-lg bg-zinc-900">
                              {(ep.still_path || season.poster_path) && (
                                <img src={ep.still_path || season.poster_path} alt="" loading="lazy" className={`h-full w-full object-cover ${isWatched ? 'opacity-60' : ''}`} />
                              )}
                              {isCurrent && (
                                <span className="absolute left-1 top-1 rounded bg-red-600 px-1 py-0.5 text-[9px] font-bold uppercase">En cours</span>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-[11px] font-semibold text-zinc-500">
                                Épisode {ep.number}{ep.runtime ? ` · ${ep.runtime} min` : ''}
                              </p>
                              <p className="truncate text-sm font-medium">{ep.title || `Épisode ${ep.number}`}</p>
                            </div>
                          </button>

                          {!isWatched && (eIdx > 0 || activeSeasonIdx > 0) && (
                            <button
                              onClick={() => markUpTo(selectedSeriesId, activeSeasonIdx, eIdx)}
                              title="Marquer cet épisode et tous ceux d'avant comme vus"
                              className="hidden shrink-0 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-zinc-300 transition hover:bg-white/15 hover:text-white group-hover:inline-flex sm:inline-flex"
                            >
                              Jusqu'ici
                            </button>
                          )}

                          <button
                            onClick={() => toggleWatched(selectedSeriesId, key)}
                            aria-label={isWatched ? 'Marquer comme non vu' : 'Marquer comme vu'}
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-2 transition ${
                              isWatched ? 'bg-emerald-500 text-white ring-emerald-500' : 'text-transparent ring-white/20 hover:text-white/40'
                            }`}
                          >
                            <Icon name="check" className="h-4 w-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </main>
  );
}
