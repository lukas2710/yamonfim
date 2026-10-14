'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

/* ------------------------------------------------------------------ */
/* Types (inchangés)                                                   */
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
  url: string;
  embedUrl?: string;
  description: string;
  seasons?: Season[];
  watched?: Record<string, boolean>;
}

const MAX_FREE_LIMIT = 5;
const VIP_URL = 'https://buy.stripe.com/eVq6oGeqBbBvbYrbWOf3a0m';

/* ------------------------------------------------------------------ */
/* Utilitaires                                                         */
/* ------------------------------------------------------------------ */

// Empêche un index invalide (?s=99, ?e=abc…) de faire planter la page
const clampIndex = (value: number, length: number) => {
  if (!Number.isFinite(value) || length <= 0) return 0;
  return Math.min(Math.max(0, Math.trunc(value)), length - 1);
};

/* ------------------------------------------------------------------ */
/* Icônes SVG (aucune dépendance à installer)                          */
/* ------------------------------------------------------------------ */

type IconName =
  | 'play' | 'back' | 'close' | 'next' | 'reload' | 'check'
  | 'crown' | 'alert' | 'chevronLeft' | 'chevronRight' | 'clock' | 'lock';

const ICONS: Record<IconName, React.ReactNode> = {
  play: <path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5Z" fill="currentColor" stroke="none" />,
  back: <path d="M19 12H5m6-7-7 7 7 7" />,
  close: <path d="M18 6 6 18M6 6l12 12" />,
  next: <><path d="M5 4.5v15l11-7.5-11-7.5Z" fill="currentColor" stroke="none" /><path d="M19 5v14" /></>,
  reload: <><path d="M21 12a9 9 0 1 1-2.64-6.36" /><path d="M21 3v6h-6" /></>,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  crown: <path d="m3 7 4.5 4L12 4l4.5 7L21 7l-2 12H5L3 7Z" />,
  alert: <><path d="M12 9v4m0 4h.01" /><path d="M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.7 3.86a2 2 0 0 0-3.4 0Z" /></>,
  chevronLeft: <path d="m15 18-6-6 6-6" />,
  chevronRight: <path d="m9 18 6-6-6-6" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  lock: <><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>,
};

function Icon({ name, className = 'w-4 h-4' }: { name: IconName; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {ICONS[name]}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function WatchPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { id } = params;

  const [media, setMedia] = useState<MediaItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showAdPopup, setShowAdPopup] = useState(true);

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [playerKey, setPlayerKey] = useState(0);
  const [iframeLoaded, setIframeLoaded] = useState(false);

  const [showVipModal, setShowVipModal] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const [selectedSeasonIdx, setSelectedSeasonIdx] = useState(0);
  const [selectedEpisodeIdx, setSelectedEpisodeIdx] = useState(0);
  const [audioLang, setAudioLang] = useState<'VF' | 'VO'>('VF');

  // Référence toujours à jour du média (évite d'écraser des "vu" avec un état périmé)
  const mediaRef = useRef<MediaItem | null>(null);
  useEffect(() => {
    mediaRef.current = media;
  }, [media]);

  // Le lecteur affiche un loader à chaque (re)chargement de l'iframe
  useEffect(() => {
    setIframeLoaded(false);
  }, [playerKey, audioLang, selectedSeasonIdx, selectedEpisodeIdx]);

  // Bloque le scroll de la page + touche Échap pour fermer le lecteur
  useEffect(() => {
    if (!isPlaying && !showVipModal) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isPlaying) {
        setIsPlaying(false);
        setShowAdPopup(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isPlaying, showVipModal]);

  // Message temporaire (ex : non connecté)
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  /* ---------------- Chargement du média + historique ---------------- */

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    async function fetchMediaAndHistory() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const user = session?.user;

        const { data: mediaData, error } = await supabase
          .from('media')
          .select('*')
          .eq('id', id)
          .single();

        if (cancelled || error || !mediaData) return;

        const item = mediaData as MediaItem;
        setMedia(item);

        let sIdx = 0;
        let eIdx = 0;

        const sParam = searchParams.get('s');
        const eParam = searchParams.get('e');

        if (sParam !== null && eParam !== null) {
          sIdx = parseInt(sParam, 10);
          eIdx = parseInt(eParam, 10);
        } else if (user) {
          const { data: userHistory } = await supabase
            .from('watch_history')
            .select('*')
            .eq('user_id', user.id)
            .eq('media_id', String(id))
            .maybeSingle();

          if (cancelled) return;
          if (userHistory) {
            sIdx = userHistory.season_idx || 0;
            eIdx = userHistory.episode_idx || 0;
          }
        }

        const seasons = item.seasons || [];
        const safeSeason = clampIndex(sIdx, seasons.length);
        const safeEpisode = clampIndex(eIdx, seasons[safeSeason]?.episodes?.length || 0);
        setSelectedSeasonIdx(safeSeason);
        setSelectedEpisodeIdx(safeEpisode);
      } catch (err) {
        console.error('Erreur chargement:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchMediaAndHistory();
    return () => {
      cancelled = true;
    };
  }, [id, searchParams]);

  /* ---------------- Logique (identique, bugs corrigés) ---------------- */

  const saveWatchHistory = async (sIdx: number, eIdx: number) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const current = mediaRef.current;
      if (!session || !current) return;

      const user = session.user;
      const currentSeason = current.seasons?.[sIdx];

      const payload = {
        user_id: user.id,
        media_id: String(current.id),
        type: current.type,
        season_idx: sIdx,
        episode_idx: eIdx,
        season_number: currentSeason?.seasonNumber || 1,
        episode_number: currentSeason?.episodes?.[eIdx]?.number || 1,
        updated_at: new Date().toISOString(),
      };

      await supabase
        .from('watch_history')
        .upsert(payload, { onConflict: 'user_id,media_id' });
    } catch (err) {
      console.error('Erreur saveWatchHistory:', err);
    }
  };

  const checkAndIncrementWatch = async (): Promise<boolean> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setNotice('Connectez-vous pour lancer la lecture.');
      return false;
    }

    const user = session.user;
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_vip, watch_count')
      .eq('id', user.id)
      .single();

    if (profile) {
      if (!profile.is_vip && (profile.watch_count || 0) >= MAX_FREE_LIMIT) {
        setShowVipModal(true);
        setIsPlaying(false);
        return false;
      }

      if (!profile.is_vip) {
        const newCount = (profile.watch_count || 0) + 1;
        await supabase
          .from('profiles')
          .update({ watch_count: newCount })
          .eq('id', user.id);
      }
    }
    return true;
  };

  const markAsWatched = async (key: string) => {
    const current = mediaRef.current;
    if (!current) return;
    const currentWatched = current.watched || {};
    if (currentWatched[key]) return;

    const updatedWatched = { ...currentWatched, [key]: true };
    const updatedMedia = { ...current, watched: updatedWatched };
    mediaRef.current = updatedMedia;
    setMedia(updatedMedia);

    await supabase
      .from('media')
      .update({ watched: updatedWatched })
      .eq('id', current.id);
  };

  const startPlaying = async (sIdx = selectedSeasonIdx, eIdx = selectedEpisodeIdx) => {
    if (isStarting) return; // évite le double-clic qui consommait 2 visions
    setIsStarting(true);
    try {
      const canPlay = await checkAndIncrementWatch();
      if (!canPlay) return;

      setPlayerKey(prev => prev + 1);
      await saveWatchHistory(sIdx, eIdx);
      setShowAdPopup(true);
      setIsPlaying(true);
    } finally {
      setIsStarting(false);
    }
  };

  const getNextPosition = () => {
    const seasons = media?.seasons;
    if (!seasons) return null;
    const season = seasons[selectedSeasonIdx];
    if (!season) return null;
    if (selectedEpisodeIdx < season.episodes.length - 1) {
      return { s: selectedSeasonIdx, e: selectedEpisodeIdx + 1 };
    }
    if (selectedSeasonIdx < seasons.length - 1 && seasons[selectedSeasonIdx + 1]?.episodes?.length) {
      return { s: selectedSeasonIdx + 1, e: 0 };
    }
    return null;
  };

  const handleAutoNextEpisode = async () => {
    if (!media || media.type !== 'series' || !media.seasons || isStarting) return;

    // Bug corrigé : on ne consomme plus une vision s'il n'y a pas d'épisode suivant
    const next = getNextPosition();
    if (!next) {
      setIsPlaying(false);
      return;
    }

    setIsStarting(true);
    try {
      const canPlay = await checkAndIncrementWatch();
      if (!canPlay) return;

      setSelectedSeasonIdx(next.s);
      setSelectedEpisodeIdx(next.e);
      markAsWatched(`s${next.s}_e${next.e}`);
      await saveWatchHistory(next.s, next.e);
      setPlayerKey(prev => prev + 1);
      setShowAdPopup(true);
      setIsPlaying(true);
    } finally {
      setIsStarting(false);
    }
  };

  const closePlayer = () => {
    setIsPlaying(false);
    setShowAdPopup(true);
  };

  const selectEpisode = (idx: number) => {
    setSelectedEpisodeIdx(idx);
    markAsWatched(`s${selectedSeasonIdx}_e${idx}`);
  };

  const getCleanEmbedUrl = (rawUrl?: string) => {
    if (!rawUrl) return '';
    let clean = rawUrl.trim();

    if (clean.includes('<iframe')) {
      try {
        const doc = new DOMParser().parseFromString(clean, 'text/html');
        const iframe = doc.querySelector('iframe');
        clean = iframe ? iframe.getAttribute('src') || '' : '';
      } catch {
        clean = '';
      }
    }
    if (!clean) return '';

    const lang = audioLang.toLowerCase();
    try {
      // Bug corrigé : l'ancienne regex pouvait modifier d'autres paramètres (ex: "slang=")
      const url = new URL(clean, window.location.origin);
      url.searchParams.set('lang', lang);
      return url.toString();
    } catch {
      if (/([?&])lang=[a-z]+/i.test(clean)) {
        return clean.replace(/([?&])lang=[a-z]+/i, `$1lang=${lang}`);
      }
      return clean + (clean.includes('?') ? '&' : '?') + `lang=${lang}`;
    }
  };

  /* ---------------- États de chargement ---------------- */

  if (loading) {
    return (
      <main className="min-h-screen bg-[#0a0a0b] text-white">
        <div className="h-[60vh] w-full bg-gradient-to-b from-zinc-900 to-[#0a0a0b] animate-pulse" />
        <div className="max-w-7xl mx-auto px-6 sm:px-12 -mt-32 space-y-4">
          <div className="h-5 w-24 rounded-full bg-zinc-800 animate-pulse" />
          <div className="h-12 w-2/3 max-w-lg rounded-xl bg-zinc-800 animate-pulse" />
          <div className="h-4 w-full max-w-2xl rounded bg-zinc-900 animate-pulse" />
          <div className="h-4 w-4/5 max-w-xl rounded bg-zinc-900 animate-pulse" />
          <div className="h-12 w-40 rounded-full bg-zinc-800 animate-pulse" />
        </div>
      </main>
    );
  }

  if (!media) {
    return (
      <main className="min-h-screen bg-[#0a0a0b] text-white flex flex-col items-center justify-center gap-5 p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-white/10 flex items-center justify-center text-zinc-500">
          <Icon name="alert" className="w-7 h-7" />
        </div>
        <div className="space-y-1">
          <h1 className="text-lg font-bold">Média introuvable</h1>
          <p className="text-sm text-zinc-400">Ce contenu n'existe pas ou n'est plus disponible.</p>
        </div>
        <button
          onClick={() => router.push('/')}
          className="inline-flex items-center gap-2 bg-white text-black hover:bg-zinc-200 px-5 py-2.5 rounded-full text-sm font-semibold transition cursor-pointer"
        >
          <Icon name="back" /> Retour à l'accueil
        </button>
      </main>
    );
  }

  /* ---------------- Valeurs dérivées ---------------- */

  const isSeries = media.type === 'series' && !!media.seasons && media.seasons.length > 0;
  const currentKey = media.type === 'movie' ? 'movie_main' : `s${selectedSeasonIdx}_e${selectedEpisodeIdx}`;

  const currentSeason = media.seasons?.[selectedSeasonIdx] || media.seasons?.[0];
  const currentEpisode = currentSeason?.episodes?.[selectedEpisodeIdx] || currentSeason?.episodes?.[0];

  const currentEmbedRaw = isSeries
    ? currentEpisode?.embedUrl || ''
    : media.embedUrl || media.url || '';

  const finalEmbedUrl = getCleanEmbedUrl(currentEmbedRaw);
  const bgImage = media.backdrop && media.backdrop.trim() !== '' ? media.backdrop : media.poster;
  const isCurrentWatched = media.watched ? !!media.watched[currentKey] : false;
  const hasNext = !!getNextPosition();
  const episodesCount = currentSeason?.episodes?.length || 0;

  const playLabel = isSeries
    ? `Lecture S${currentSeason?.seasonNumber || 1} · É${currentEpisode?.number || 1}`
    : 'Regarder';

  const handleMainPlay = () => {
    if (media.type === 'series') {
      markAsWatched(`s${selectedSeasonIdx}_e${selectedEpisodeIdx}`);
      startPlaying(selectedSeasonIdx, selectedEpisodeIdx);
    } else {
      markAsWatched('movie_main');
      startPlaying();
    }
  };

  /* ---------------- Rendu ---------------- */

  return (
    <main className="min-h-screen bg-[#0a0a0b] text-white font-sans pb-24 antialiased selection:bg-red-600 selection:text-white">

      {/* Notification */}
      {notice && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[60] px-4 w-full max-w-sm">
          <div className="flex items-center gap-3 bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-2xl px-4 py-3 shadow-2xl">
            <span className="text-red-500"><Icon name="lock" /></span>
            <p className="text-sm text-zinc-200">{notice}</p>
          </div>
        </div>
      )}

      {/* Modal VIP */}
      {showVipModal && (
        <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-amber-500/20 bg-[#111113] shadow-[0_0_80px_-20px_rgba(245,158,11,0.35)]">
            <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-amber-500/15 to-transparent pointer-events-none" />
            <div className="relative p-8 text-center">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-zinc-950 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-amber-500/30">
                <Icon name="crown" className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold tracking-tight mb-2">Passez au VIP</h3>
              <p className="text-sm text-zinc-400 leading-relaxed mb-6">
                Vous avez utilisé vos <span className="text-white font-semibold">{MAX_FREE_LIMIT} visions gratuites</span>.
                Débloquez un accès illimité à tout le catalogue.
              </p>

              <ul className="text-left space-y-2.5 mb-7">
                {['Visionnage illimité', 'Films et séries complets', 'Accès immédiat'].map(item => (
                  <li key={item} className="flex items-center gap-3 text-sm text-zinc-300">
                    <span className="w-5 h-5 rounded-full bg-amber-500/15 text-amber-400 flex items-center justify-center shrink-0">
                      <Icon name="check" className="w-3 h-3" />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => (window.location.href = VIP_URL)}
                className="w-full bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-zinc-950 font-bold py-3.5 rounded-full text-sm transition cursor-pointer shadow-lg shadow-amber-500/20"
              >
                Devenir membre VIP
              </button>
              <button
                onClick={() => router.push('/')}
                className="mt-3 w-full py-2.5 text-sm text-zinc-400 hover:text-white transition cursor-pointer"
              >
                Retour à l'accueil
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="fixed top-0 inset-x-0 z-40 bg-gradient-to-b from-black/80 via-black/40 to-transparent">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 sm:px-12 py-4">
          <button
            onClick={() => router.push('/')}
            className="group inline-flex items-center gap-2 text-sm font-medium text-zinc-200 hover:text-white bg-white/5 hover:bg-white/10 backdrop-blur-md border border-white/10 pl-3 pr-4 py-2 rounded-full transition cursor-pointer"
          >
            <Icon name="back" className="w-4 h-4 transition group-hover:-translate-x-0.5" />
            Retour
          </button>
          <span className="font-black text-lg tracking-[0.2em] text-red-600 select-none">
            YAMON<span className="text-white">FIM</span>
          </span>
        </div>
      </header>

      {/* Lecteur plein écran */}
      {isPlaying && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col">
          {showAdPopup ? (
            <div className="flex-1 flex items-center justify-center p-4 bg-[radial-gradient(ellipse_at_center,rgba(220,38,38,0.12),transparent_60%)]">
              <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-[#111113] p-8 text-center shadow-2xl">
                <div className="w-14 h-14 rounded-2xl bg-red-600/10 border border-red-500/20 text-red-500 flex items-center justify-center mx-auto mb-5">
                  <Icon name="alert" className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold tracking-tight mb-2">Prêt à lancer la vidéo</h3>
                <p className="text-sm text-zinc-400 leading-relaxed mb-7">
                  Si une page publicitaire s'ouvre dans un nouvel onglet,{' '}
                  <strong className="text-white font-semibold">fermez-la immédiatement</strong> et revenez ici.
                </p>
                <button
                  onClick={() => setShowAdPopup(false)}
                  className="w-full inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 text-white font-semibold py-3.5 rounded-full text-sm transition shadow-lg shadow-red-600/30 cursor-pointer active:scale-[0.98]"
                >
                  <Icon name="play" className="w-4 h-4" /> Lancer la vidéo
                </button>
                <button
                  onClick={closePlayer}
                  className="mt-3 w-full py-2.5 text-sm text-zinc-500 hover:text-white transition cursor-pointer"
                >
                  Annuler
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Barre de contrôle */}
              <div className="shrink-0 border-b border-white/5 bg-[#0a0a0b]/95 backdrop-blur-xl">
                <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3">
                  <div className="min-w-0 flex items-center gap-3">
                    <button
                      onClick={closePlayer}
                      aria-label="Fermer le lecteur"
                      className="w-9 h-9 shrink-0 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center transition cursor-pointer"
                    >
                      <Icon name="back" />
                    </button>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{media.title}</p>
                      {isSeries && (
                        <p className="text-xs text-zinc-400 truncate">
                          Saison {currentSeason?.seasonNumber} · Épisode {currentEpisode?.number}
                          {currentEpisode?.title ? ` — ${currentEpisode.title}` : ''}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex bg-white/5 border border-white/10 rounded-full p-1" role="group" aria-label="Langue audio">
                      {(['VF', 'VO'] as const).map(lang => (
                        <button
                          key={lang}
                          onClick={() => setAudioLang(lang)}
                          className={`px-3.5 py-1 rounded-full text-xs font-bold transition cursor-pointer ${
                            audioLang === lang ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'
                          }`}
                        >
                          {lang}
                        </button>
                      ))}
                    </div>

                    <button
                      onClick={() => setPlayerKey(prev => prev + 1)}
                      title="Recharger le lecteur (écran noir)"
                      aria-label="Recharger le lecteur"
                      className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-zinc-300 hover:text-white transition cursor-pointer"
                    >
                      <Icon name="reload" />
                    </button>

                    {isSeries && (
                      <button
                        onClick={handleAutoNextEpisode}
                        disabled={!hasNext || isStarting}
                        className="hidden sm:inline-flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-100 px-4 py-2 rounded-full text-xs font-semibold transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Suivant <Icon name="next" className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <button
                      onClick={closePlayer}
                      className="inline-flex items-center gap-1.5 bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-full text-xs font-semibold transition cursor-pointer"
                    >
                      <Icon name="close" className="w-3.5 h-3.5" /> Fermer
                    </button>
                  </div>
                </div>
              </div>

              {/* Vidéo */}
              <div className="flex-1 flex items-center justify-center p-2 sm:p-6 min-h-0">
                <div className="w-full max-w-6xl max-h-full aspect-video bg-black rounded-xl sm:rounded-2xl overflow-hidden ring-1 ring-white/10 shadow-[0_0_120px_-30px_rgba(220,38,38,0.35)] relative">
                  {finalEmbedUrl ? (
                    <>
                      {!iframeLoaded && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-zinc-500 pointer-events-none">
                          <div className="w-10 h-10 rounded-full border-2 border-white/10 border-t-red-600 animate-spin" />
                          <span className="text-xs">Chargement du lecteur…</span>
                        </div>
                      )}
                      <iframe
                        ref={iframeRef}
                        key={`player-${playerKey}-${audioLang}`}
                        src={finalEmbedUrl}
                        onLoad={() => setIframeLoaded(true)}
                        className="relative w-full h-full border-0"
                        allow="fullscreen; accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        title={media.title}
                      />
                    </>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-zinc-500">
                      <Icon name="alert" className="w-6 h-6" />
                      <span className="text-sm">Aucun flux vidéo disponible.</span>
                    </div>
                  )}
                </div>
              </div>

              {isSeries && (
                <div className="sm:hidden shrink-0 p-3 border-t border-white/5">
                  <button
                    onClick={handleAutoNextEpisode}
                    disabled={!hasNext || isStarting}
                    className="w-full inline-flex items-center justify-center gap-2 bg-white/5 border border-white/10 text-zinc-100 py-3 rounded-full text-sm font-semibold transition disabled:opacity-40"
                  >
                    Épisode suivant <Icon name="next" className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Hero */}
      <section className="relative w-full">
        <div className="relative h-[70vh] min-h-[460px] w-full overflow-hidden">
          {bgImage && (
            <img
              src={bgImage}
              alt=""
              className="absolute inset-0 w-full h-full object-cover object-center scale-105"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0b] via-[#0a0a0b]/70 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0b] via-[#0a0a0b]/30 to-black/40" />
        </div>

        <div className="absolute inset-x-0 bottom-0">
          <div className="max-w-7xl mx-auto px-6 sm:px-12 pb-10 flex items-end gap-8">
            {media.poster && (
              <img
                src={media.poster}
                alt={media.title}
                className="hidden md:block w-48 lg:w-56 aspect-[2/3] object-cover rounded-2xl ring-1 ring-white/10 shadow-2xl shadow-black/60"
              />
            )}

            <div className="flex-1 min-w-0 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] uppercase tracking-wider font-semibold text-white bg-red-600 px-2.5 py-1 rounded-md">
                  {media.type === 'movie' ? 'Film' : 'Série'}
                </span>
                {isSeries && (
                  <span className="text-[11px] uppercase tracking-wider font-semibold text-zinc-300 bg-white/10 backdrop-blur px-2.5 py-1 rounded-md">
                    {media.seasons!.length} saison{media.seasons!.length > 1 ? 's' : ''}
                  </span>
                )}
                {isCurrentWatched && (
                  <span className="inline-flex items-center gap-1 text-[11px] uppercase tracking-wider font-semibold text-emerald-300 bg-emerald-500/15 border border-emerald-500/25 px-2.5 py-1 rounded-md">
                    <Icon name="check" className="w-3 h-3" /> Vu
                  </span>
                )}
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.05] drop-shadow-lg">
                {media.title}
              </h1>

              {media.description && (
                <p className="text-sm sm:text-base text-zinc-300 max-w-2xl line-clamp-3 leading-relaxed">
                  {media.description}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  onClick={handleMainPlay}
                  disabled={isStarting}
                  className="inline-flex items-center gap-2.5 bg-white hover:bg-zinc-200 text-black font-bold py-3.5 pl-6 pr-7 rounded-full text-sm transition shadow-xl shadow-black/40 cursor-pointer active:scale-[0.97] disabled:opacity-60 disabled:cursor-wait"
                >
                  {isStarting ? (
                    <span className="w-4 h-4 rounded-full border-2 border-black/20 border-t-black animate-spin" />
                  ) : (
                    <Icon name="play" className="w-5 h-5" />
                  )}
                  {playLabel}
                </button>

                {isSeries && currentEpisode?.title && (
                  <span className="text-sm text-zinc-400 truncate max-w-xs">
                    {currentEpisode.title}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Épisodes */}
      {isSeries && currentSeason && (
        <section className="max-w-7xl mx-auto px-6 sm:px-12 mt-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold tracking-tight">Épisodes</h2>
              <p className="text-sm text-zinc-500 mt-0.5">
                Saison {currentSeason.seasonNumber} · {episodesCount} épisode{episodesCount > 1 ? 's' : ''}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => selectedEpisodeIdx > 0 && setSelectedEpisodeIdx(selectedEpisodeIdx - 1)}
                disabled={selectedEpisodeIdx === 0}
                aria-label="Épisode précédent"
                className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <Icon name="chevronLeft" />
              </button>
              <button
                onClick={() =>
                  selectedEpisodeIdx < episodesCount - 1 && setSelectedEpisodeIdx(selectedEpisodeIdx + 1)
                }
                disabled={selectedEpisodeIdx >= episodesCount - 1}
                aria-label="Épisode suivant"
                className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <Icon name="chevronRight" />
              </button>
            </div>
          </div>

          {/* Saisons */}
          {media.seasons!.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {media.seasons!.map((season, sIdx) => {
                const isSelected = selectedSeasonIdx === sIdx;
                return (
                  <button
                    key={sIdx}
                    onClick={() => {
                      setSelectedSeasonIdx(sIdx);
                      setSelectedEpisodeIdx(0);
                    }}
                    className={`shrink-0 px-5 py-2 rounded-full text-sm font-semibold transition cursor-pointer ${
                      isSelected
                        ? 'bg-white text-black'
                        : 'bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 border border-white/10'
                    }`}
                  >
                    Saison {season.seasonNumber}
                  </button>
                );
              })}
            </div>
          )}

          {/* Liste des épisodes */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {currentSeason.episodes.map((ep, eIdx) => {
              const isSelected = eIdx === selectedEpisodeIdx;
              const isWatched = !!media.watched?.[`s${selectedSeasonIdx}_e${eIdx}`];
              const thumb = ep.still_path || currentSeason.poster_path || media.poster;

              return (
                <button
                  key={eIdx}
                  onClick={() => selectEpisode(eIdx)}
                  className={`group text-left flex gap-4 p-3 rounded-2xl border transition cursor-pointer ${
                    isSelected
                      ? 'bg-red-600/10 border-red-600/50 ring-1 ring-red-600/30'
                      : 'bg-white/[0.03] border-white/5 hover:bg-white/[0.06] hover:border-white/15'
                  }`}
                >
                  <div className="relative w-36 shrink-0 aspect-video rounded-xl overflow-hidden bg-zinc-900">
                    {thumb && (
                      <img
                        src={thumb}
                        alt=""
                        loading="lazy"
                        className={`w-full h-full object-cover transition duration-300 group-hover:scale-105 ${isWatched && !isSelected ? 'opacity-60' : ''}`}
                      />
                    )}
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                      <span className="w-9 h-9 rounded-full bg-white/90 text-black flex items-center justify-center">
                        <Icon name="play" className="w-4 h-4" />
                      </span>
                    </div>
                    {isWatched && (
                      <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow">
                        <Icon name="check" className="w-3 h-3" />
                      </span>
                    )}
                    {isSelected && <span className="absolute bottom-0 inset-x-0 h-1 bg-red-600" />}
                  </div>

                  <div className="min-w-0 py-1 space-y-1">
                    <p className={`text-[11px] font-semibold uppercase tracking-wider ${isSelected ? 'text-red-500' : 'text-zinc-500'}`}>
                      {isSelected ? 'Sélectionné' : `Épisode ${ep.number}`}
                    </p>
                    <p className="text-sm font-semibold text-white line-clamp-2 leading-snug">
                      {isSelected ? `${ep.number}. ` : ''}{ep.title || `Épisode ${ep.number}`}
                    </p>
                    {ep.runtime ? (
                      <p className="inline-flex items-center gap-1 text-xs text-zinc-500">
                        <Icon name="clock" className="w-3 h-3" /> {ep.runtime} min
                      </p>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}
    </main>
  );
}
