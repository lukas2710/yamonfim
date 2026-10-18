'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

interface Episode {
  number: number;
  title: string;
  embedUrl: string;
  still_path?: string;
  runtime?: number;
  tmdb_id?: number | string;
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
  runtime?: number;
  seasons?: Season[];
  watched?: Record<string, boolean>;
}

interface CommentItem {
  id: string;
  user_id: string;
  user_email: string;
  content: string;
  created_at: string;
}

type Position = { s: number; e: number };

const MAX_FREE_LIMIT = 5;
const ADMIN_EMAIL = 'lukas.leclerc312@gmail.com';
const AUTOPLAY_STORAGE_KEY = 'yf_autoplay';

const clampIndex = (value: number, length: number) => {
  if (!Number.isFinite(value) || length <= 0) return 0;
  return Math.min(Math.max(0, Math.trunc(value)), length - 1);
};

const hasText = (v?: string) => !!v && v.trim() !== '';

const epKey = (s: number, e: number) => `s${s}_e${e}`;

const nextPositionOf = (seasons: Season[] | undefined, pos: Position): Position | null => {
  if (!seasons) return null;
  const season = seasons[pos.s];
  if (!season) return null;
  if (pos.e < season.episodes.length - 1) return { s: pos.s, e: pos.e + 1 };
  for (let s = pos.s + 1; s < seasons.length; s++) {
    if (seasons[s]?.episodes?.length) return { s, e: 0 };
  }
  return null;
};

const maskEmail = (email?: string) => {
  if (!email || !email.includes('@')) return email || 'Utilisateur';
  const [name, domain] = email.split('@');
  return `${name.slice(0, 2)}***@${domain}`;
};

const timeAgo = (iso: string) => {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (!Number.isFinite(diff)) return '';
  if (diff < 60) return "à l'instant";
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`;
  return `il y a ${Math.floor(diff / 86400)} j`;
};

type IconName =
  | 'play' | 'back' | 'close' | 'next' | 'reload' | 'check' | 'restart'
  | 'crown' | 'alert' | 'chevronLeft' | 'chevronRight' | 'clock' | 'lock' | 'eye' | 'send' | 'trash' | 'pause' | 'plus' | 'minus' | 'maximize';

const ICONS: Record<IconName, React.ReactNode> = {
  play: <path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5Z" fill="currentColor" stroke="none" />,
  pause: <><rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none" /><rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none" /></>,
  back: <path d="M19 12H5m6-7-7 7 7 7" />,
  close: <path d="M18 6 6 18M6 6l12 12" />,
  next: <><path d="M5 4.5v15l11-7.5-11-7.5Z" fill="currentColor" stroke="none" /><path d="M19 5v14" /></>,
  reload: <><path d="M21 12a9 9 0 1 1-2.64-6.36" /><path d="M21 3v6h-6" /></>,
  restart: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></>,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  crown: <path d="m3 7 4.5 4L12 4l4.5 7L21 7l-2 12H5L3 7Z" />,
  alert: <><path d="M12 9v4m0 4h.01" /><path d="M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.7 3.86a2 2 0 0 0-3.4 0Z" /></>,
  chevronLeft: <path d="m15 18-6-6 6-6" />,
  chevronRight: <path d="m9 18 6-6-6-6" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  lock: <><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>,
  eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
  send: <path d="m22 2-7 20-4-9-9-4Z" />,
  trash: <><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  maximize: <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />,
};

function Icon({ name, className = 'w-4 h-4' }: { name: IconName; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}

export default function WatchPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { id } = params;

  const [media, setMedia] = useState<MediaItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showAdPopup, setShowAdPopup] = useState(true);

  const [isPlayerPaused, setIsPlayerPaused] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const playerWrapperRef = useRef<HTMLDivElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [playerKey, setPlayerKey] = useState(0);
  const [iframeLoaded, setIframeLoaded] = useState(false);

  const [showVipModal, setShowVipModal] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const [selectedSeasonIdx, setSelectedSeasonIdx] = useState(0);
  const [selectedEpisodeIdx, setSelectedEpisodeIdx] = useState(0);

  const [isVipUser, setIsVipUser] = useState(false);
  const [remainingFree, setRemainingFree] = useState<number | null>(null);

  const [resumePos, setResumePos] = useState<Position | null>(null);
  const [hasMovieHistory, setHasMovieHistory] = useState(false);

  const [autoPlayEnabled, setAutoPlayEnabled] = useState(true);

  const [comments, setComments] = useState<CommentItem[]>([]);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  const mediaRef = useRef<MediaItem | null>(null);
  const posRef = useRef<Position>({ s: 0, e: 0 });
  const busyRef = useRef(false);
  const episodeListRef = useRef<HTMLDivElement>(null);
  const userIdRef = useRef<string | null>(null);

  const currentProgressRef = useRef<{ currentTime: number; duration: number }>({ currentTime: 0, duration: 0 });

  useEffect(() => { mediaRef.current = media; }, [media]);
  useEffect(() => { posRef.current = { s: selectedSeasonIdx, e: selectedEpisodeIdx }; }, [selectedSeasonIdx, selectedEpisodeIdx]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(AUTOPLAY_STORAGE_KEY);
      if (saved !== null) setAutoPlayEnabled(saved === '1');
    } catch {}
  }, []);

  useEffect(() => {
    setIframeLoaded(false);
  }, [playerKey, selectedSeasonIdx, selectedEpisodeIdx]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isPlaying) closePlayer();
    };
    if (isPlaying) window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isPlaying]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4500);
    return () => clearTimeout(t);
  }, [notice]);

  const clearTimer = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  };

  const initTimer = (durationMinutes?: number) => {
    clearTimer();
    if (!autoPlayEnabled) return;

    const mins = durationMinutes && durationMinutes > 0 ? durationMinutes : 21;
    setRemainingSeconds(mins * 60);
    setIsPlayerPaused(false);

    timerIntervalRef.current = setInterval(() => {
      if (isPlayerPaused) return;

      setRemainingSeconds(prev => {
        if (prev <= 1) {
          clearTimer();
          handleTimerFinished();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const togglePauseTimer = () => {
    setIsPlayerPaused(prev => !prev);
  };

  const addTime = (seconds: number) => {
    setRemainingSeconds(prev => Math.max(0, prev + seconds));
  };

  const formatTimerDisplay = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const requestFullscreenPlayer = () => {
    if (playerWrapperRef.current && !document.fullscreenElement) {
      playerWrapperRef.current.requestFullscreen().catch(() => {});
    }
  };

  const handleTimerFinished = async () => {
    const current = mediaRef.current;
    if (!current) return;

    const from = posRef.current;
    if (current.type === 'series') {
      await markAsWatched(epKey(from.s, from.e));
      await saveWatchHistory(from.s, from.e, currentProgressRef.current.currentTime, currentProgressRef.current.duration);

      const next = nextPositionOf(current.seasons, from);
      if (!next) {
        setNotice('Épisode validé. Tu as atteint la fin de la série 🎉');
        return;
      }

      // Met uniquement à jour la position courante et le titre affiché en haut, sans recharger l'iframe
      setSelectedSeasonIdx(next.s);
      setSelectedEpisodeIdx(next.e);
      posRef.current = next;
      setResumePos(next);

      const nextEpObj = current.seasons?.[next.s]?.episodes?.[next.e];
      initTimer(nextEpObj?.runtime || current.runtime || 21);

      setNotice("Épisode validé, passage de l'indicateur au suivant !");
    } else {
      await markAsWatched('movie_main');
      setNotice('Film validé comme vu !');
    }
  };

  const fetchComments = async (mediaId: string) => {
    const { data, error } = await supabase
      .from('comments')
      .select('*')
      .eq('media_id', mediaId)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setComments(data);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || submittingComment || !currentUser || !id) return;

    setSubmittingComment(true);
    const { error } = await supabase.from('comments').insert([
      {
        media_id: String(id),
        user_id: currentUser.id,
        user_email: currentUser.email || 'Utilisateur',
        content: newComment.trim(),
      },
    ]);

    if (!error) {
      setNewComment('');
      fetchComments(String(id));
    } else {
      setNotice('Erreur lors de l\'envoi du commentaire.');
    }
    setSubmittingComment(false);
  };

  const handleDeleteComment = async (commentId: string) => {
    const { error } = await supabase.from('comments').delete().eq('id', commentId);
    if (!error && id) {
      fetchComments(String(id));
    }
  };

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    async function fetchMediaAndHistory() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const user = session?.user;
        setCurrentUser(user || null);
        userIdRef.current = user?.id || null;

        const { data: mediaData, error } = await supabase
          .from('media')
          .select('*')
          .eq('id', id)
          .single();

        if (cancelled || error || !mediaData) return;

        fetchComments(String(id));

        const userWatched: Record<string, boolean> = {};
        if (user) {
          const { data: watchedRows, error: watchedError } = await supabase
            .from('user_watched')
            .select('ep_key')
            .eq('user_id', user.id)
            .eq('media_id', String(mediaData.id));
          if (watchedError) console.error('Erreur user_watched :', watchedError);
          (watchedRows || []).forEach((r: any) => { userWatched[r.ep_key] = true; });
        }
        if (cancelled) return;

        const item: MediaItem = { ...(mediaData as MediaItem), watched: userWatched };
        setMedia(item);

        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('is_vip, watch_count')
            .eq('id', user.id)
            .maybeSingle();

          if (cancelled) return;
          const vip = user.email === ADMIN_EMAIL || !!profile?.is_vip;
          setIsVipUser(vip);
          setRemainingFree(vip ? null : Math.max(0, MAX_FREE_LIMIT - (profile?.watch_count || 0)));
        }

        let sIdx = 0;
        let eIdx = 0;
        let fromHistory = false;

        const sParam = searchParams.get('s');
        const eParam = searchParams.get('e');

        if (sParam !== null && eParam !== null) {
          sIdx = parseInt(sParam, 10);
          eIdx = parseInt(eParam, 10);
          fromHistory = true;
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
            fromHistory = true;
            if (item.type === 'movie') setHasMovieHistory(true);
          }
        }

        const seasons = item.seasons || [];
        const safeSeason = clampIndex(sIdx, seasons.length);
        const safeEpisode = clampIndex(eIdx, seasons[safeSeason]?.episodes?.length || 0);
        setSelectedSeasonIdx(safeSeason);
        setSelectedEpisodeIdx(safeEpisode);
        if (fromHistory && item.type === 'series') setResumePos({ s: safeSeason, e: safeEpisode });
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

  useEffect(() => {
    if (loading || !resumePos) return;
    const t = setTimeout(() => {
      episodeListRef.current
        ?.querySelector<HTMLElement>(`[data-ep="${resumePos.s}-${resumePos.e}"]`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }, 300);
    return () => clearTimeout(t);
  }, [loading, resumePos]);

  const saveWatchHistory = async (sIdx: number, eIdx: number, currentTime = 0, duration = 0) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const current = mediaRef.current;
      if (!session || !current) return;

      const user = session.user;
      const currentSeason = current.seasons?.[sIdx];
      const epRuntime = currentSeason?.episodes?.[eIdx]?.runtime;
      const defaultDuration = duration || (epRuntime ? epRuntime * 60 : (current.runtime ? current.runtime * 60 : 0));

      const payload = {
        user_id: user.id,
        media_id: String(current.id),
        type: current.type,
        season_idx: sIdx,
        episode_idx: eIdx,
        season_number: currentSeason?.seasonNumber || 1,
        episode_number: currentSeason?.episodes?.[eIdx]?.number || 1,
        current_time: Math.floor(currentTime),
        duration: Math.floor(defaultDuration),
        updated_at: new Date().toISOString(),
      };

      await supabase
        .from('watch_history')
        .upsert(payload, { onConflict: 'user_id,media_id' });

      if (current.type === 'series') setResumePos({ s: sIdx, e: eIdx });
      else setHasMovieHistory(true);
    } catch (err) {
      console.error('Erreur saveWatchHistory:', err);
    }
  };

  const setWatchedKeys = async (keys: string[], value: boolean) => {
    const current = mediaRef.current;
    if (!current || keys.length === 0) return;

    const updatedWatched = { ...(current.watched || {}) };
    keys.forEach(k => { if (value) updatedWatched[k] = true; else delete updatedWatched[k]; });
    const updatedMedia = { ...current, watched: updatedWatched };
    mediaRef.current = updatedMedia;
    setMedia(updatedMedia);

    let uid = userIdRef.current;
    if (!uid) {
      const { data: { session } } = await supabase.auth.getSession();
      uid = session?.user?.id || null;
      userIdRef.current = uid;
    }
    if (!uid) {
      setNotice('Connecte-toi pour enregistrer tes épisodes vus.');
      return;
    }

    const mediaId = String(current.id);
    const { error } = value
      ? await supabase.from('user_watched').upsert(
          keys.map(k => ({ user_id: uid, media_id: mediaId, ep_key: k, watched_at: new Date().toISOString() })),
          { onConflict: 'user_id,media_id,ep_key' }
        )
      : await supabase.from('user_watched').delete()
          .eq('user_id', uid).eq('media_id', mediaId).in('ep_key', keys);

    if (error) console.error('Erreur user_watched :', error);
  };

  const markAsWatched = async (key: string) => {
    if (mediaRef.current?.watched?.[key]) return;
    await setWatchedKeys([key], true);
  };

  const toggleEpisodeWatched = (sIdx: number, eIdx: number) => {
    const key = epKey(sIdx, eIdx);
    setWatchedKeys([key], !mediaRef.current?.watched?.[key]);
  };

  const setSeasonWatched = (sIdx: number, value: boolean) => {
    const season = mediaRef.current?.seasons?.[sIdx];
    if (!season) return;
    setWatchedKeys(season.episodes.map((_, eIdx) => epKey(sIdx, eIdx)), value);
    setNotice(value ? `Saison ${season.seasonNumber} marquée comme vue` : `Saison ${season.seasonNumber} décochée`);
  };

  const markUpTo = (sIdx: number, eIdx: number) => {
    const seasons = mediaRef.current?.seasons || [];
    const keys: string[] = [];
    seasons.forEach((season, s) => {
      season.episodes.forEach((_, e) => {
        if (s < sIdx || (s === sIdx && e <= eIdx)) keys.push(epKey(s, e));
      });
    });
    setWatchedKeys(keys, true);
    setNotice(`Épisodes marqués comme vus jusqu'à S${seasons[sIdx]?.seasonNumber ?? sIdx + 1} · É${seasons[sIdx]?.episodes?.[eIdx]?.number ?? eIdx + 1}`);
  };

  const toggleMovieWatched = () => {
    setWatchedKeys(['movie_main'], !mediaRef.current?.watched?.movie_main);
  };

  const checkAndIncrementWatch = async (): Promise<boolean> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setNotice('Connecte-toi pour lancer la lecture.');
      return false;
    }

    const user = session.user;
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_vip, watch_count')
      .eq('id', user.id)
      .maybeSingle();

    if (profile) {
      if (!profile.is_vip && (profile.watch_count || 0) >= MAX_FREE_LIMIT) {
        setRemainingFree(0);
        setShowVipModal(true);
        setIsPlaying(false);
        return false;
      }
    }
    return true;
  };

  const performValidatedWatchAction = async (sIdx: number, eIdx: number) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const user = session.user;

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_vip, watch_count')
      .eq('id', user.id)
      .maybeSingle();

    if (profile && !profile.is_vip) {
      const newCount = (profile.watch_count || 0) + 1;
      await supabase
        .from('profiles')
        .update({ watch_count: newCount })
        .eq('id', user.id);
      setRemainingFree(Math.max(0, MAX_FREE_LIMIT - newCount));
    }

    const current = mediaRef.current;
    if (current?.type === 'series') markAsWatched(epKey(sIdx, eIdx));
    else markAsWatched('movie_main');

    const currTime = currentProgressRef.current.currentTime;
    const currDur = currentProgressRef.current.duration;
    await saveWatchHistory(sIdx, eIdx, currTime, currDur);
  };

  const startPlaying = async (sIdx = selectedSeasonIdx, eIdx = selectedEpisodeIdx) => {
    if (isStarting || busyRef.current) return;
    busyRef.current = true;
    setIsStarting(true);
    try {
      const canPlay = await checkAndIncrementWatch();
      if (!canPlay) return;

      if (sIdx !== selectedSeasonIdx) setSelectedSeasonIdx(sIdx);
      if (eIdx !== selectedEpisodeIdx) setSelectedEpisodeIdx(eIdx);
      posRef.current = { s: sIdx, e: eIdx };

      await saveWatchHistory(sIdx, eIdx, 0, 0);

      clearTimer();

      setPlayerKey(prev => prev + 1);
      setShowAdPopup(true);
      setIsPlaying(true);

      window.setTimeout(() => {
        document.getElementById('lecteur-video')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 80);
    } finally {
      busyRef.current = false;
      setIsStarting(false);
    }
  };

  const closePlayer = () => {
    clearTimer();

    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }

    saveWatchHistory(posRef.current.s, posRef.current.e, currentProgressRef.current.currentTime, currentProgressRef.current.duration);

    setIsPlaying(false);
    setShowAdPopup(true);
  };

  const handleLaunchClick = () => {
    setShowAdPopup(false);
    const { s, e } = posRef.current;

    const activeEp = mediaRef.current?.seasons?.[s]?.episodes?.[e];
    initTimer(activeEp?.runtime || mediaRef.current?.runtime || 21);

    if (playerWrapperRef.current && !document.fullscreenElement) {
      playerWrapperRef.current.requestFullscreen().catch(() => {});
    }

    performValidatedWatchAction(s, e);
  };

  const selectEpisode = (idx: number) => {
    if (idx === posRef.current.e && selectedSeasonIdx === posRef.current.s && isPlaying) return;

    if (isPlaying) {
      const previous = posRef.current;
      if (mediaRef.current?.type === 'series') {
        void markAsWatched(epKey(previous.s, previous.e));
        void saveWatchHistory(previous.s, previous.e, currentProgressRef.current.currentTime, currentProgressRef.current.duration);
      }
      currentProgressRef.current = { currentTime: 0, duration: 0 };
      posRef.current = { s: selectedSeasonIdx, e: idx };
      setSelectedEpisodeIdx(idx);
      setResumePos({ s: selectedSeasonIdx, e: idx });
      void saveWatchHistory(selectedSeasonIdx, idx, 0, 0);
      setPlayerKey(prevKey => prevKey + 1);
      setIframeLoaded(false);

      const activeEp = mediaRef.current?.seasons?.[selectedSeasonIdx]?.episodes?.[idx];
      initTimer(activeEp?.runtime || mediaRef.current?.runtime || 21);

      setNotice(`Lecture de l'épisode ${activeEp?.number ?? idx + 1}`);
      return;
    }

    void startPlaying(selectedSeasonIdx, idx);
  };

  const restartFromBeginning = () => {
    setSelectedSeasonIdx(0);
    setSelectedEpisodeIdx(0);
    setResumePos({ s: 0, e: 0 });
    saveWatchHistory(0, 0, 0, 0);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const getCleanEmbedUrl = (rawUrl?: string) => {
    const episodeObj = media?.seasons?.[selectedSeasonIdx]?.episodes?.[selectedEpisodeIdx];
    const target = (episodeObj?.embedUrl && episodeObj.embedUrl.trim() !== '') 
      ? episodeObj.embedUrl 
      : (rawUrl || media?.embedUrl || media?.url || '');
    
    let clean = target.trim();

    if (clean.includes('<iframe')) {
      try {
        const doc = new DOMParser().parseFromString(clean, 'text/html');
        const iframe = doc.querySelector('iframe');
        clean = iframe ? iframe.getAttribute('src') || '' : '';
      } catch {
        clean = '';
      }
    }

    if (!clean && media?.type === 'movie') {
      clean = `https://api.moviez.ac/${media.id}`;
    }
    if (!clean) return '';

    try {
      const url = new URL(clean, window.location.origin);
      url.searchParams.set('autoplay', '1');
      if (media?.type === 'series') {
        url.searchParams.set('next', '1');
        url.searchParams.set('season', String(currentSeason?.seasonNumber || 1));
        url.searchParams.set('episode', String(currentEpisode?.number || 1));
        if (currentEpisode?.tmdb_id) {
          url.searchParams.set('tmdb_id', String(currentEpisode.tmdb_id));
        }
      }
      url.searchParams.set('color', 'e8213f');
      return url.toString();
    } catch {
      let out = clean;
      if (!/[?&]autoplay=/.test(out)) out += (out.includes('?') ? '&' : '?') + 'autoplay=1';
      if (media?.type === 'series') {
        out = out.replace(/([?&])next=[^&]*/i, '$1next=1');
        if (!/[?&]next=/.test(out)) out += '&next=1';
        if (!/[?&]season=/.test(out)) out += `&season=${currentSeason?.seasonNumber || 1}`;
        if (!/[?&]episode=/.test(out)) out += `&episode=${currentEpisode?.number || 1}`;
        if (currentEpisode?.tmdb_id && !/[?&]tmdb_id=/.test(out)) {
          out += `&tmdb_id=${currentEpisode.tmdb_id}`;
        }
      }
      return out;
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-[#0a0a0b] text-white">
        <div className="h-[60vh] w-full bg-gradient-to-b from-zinc-900 to-[#0a0a0b] animate-pulse" />
        <div className="max-w-7xl mx-auto px-6 sm:px-12 -mt-32 space-y-4">
          <div className="h-5 w-24 rounded-full bg-zinc-800 animate-pulse" />
          <div className="h-12 w-2/3 max-w-lg rounded-xl bg-zinc-800 animate-pulse" />
          <div className="h-4 w-full max-w-2xl rounded bg-zinc-900 animate-pulse" />
        </div>
      </main>
    );
  }

  if (!media) {
    return (
      <main className="min-h-screen bg-[#0a0a0b] text-white flex flex-col items-center justify-center gap-5 p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-white/10 flex items-center justify-center text-zinc-500">
          <Icon className="w-7 h-7" name="alert" />
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

  const isSeries = media.type === 'series' && !!media.seasons && media.seasons.length > 0;
  const currentSeason = media.seasons?.[selectedSeasonIdx] || media.seasons?.[0];
  const currentEpisode = currentSeason?.episodes?.[selectedEpisodeIdx] || currentSeason?.episodes?.[0];
  const w = media.watched || {};

  const currentEmbedRaw = isSeries
    ? currentEpisode?.embedUrl || media.embedUrl || media.url || ''
    : media.embedUrl || media.url || '';

  const finalEmbedUrl = getCleanEmbedUrl(currentEmbedRaw);
  const desktopBg = hasText(media.backdrop) ? media.backdrop! : media.poster;
  const mobileBg = hasText(media.poster) ? media.poster : media.backdrop || '';

  const episodesCount = currentSeason?.episodes?.length || 0;

  const totalEpisodes = isSeries ? media.seasons!.reduce((n, s) => n + s.episodes.length, 0) : 0;
  const seenEpisodes = isSeries
    ? media.seasons!.reduce((n, s, sIdx) => n + s.episodes.filter((_, eIdx) => !!w[epKey(sIdx, eIdx)]).length, 0)
    : 0;
  const seriesDone = isSeries && totalEpisodes > 0 && seenEpisodes === totalEpisodes;
  const seasonSeen = (sIdx: number) =>
    (media.seasons?.[sIdx]?.episodes || []).filter((_, eIdx) => !!w[epKey(sIdx, eIdx)]).length;
  const currentSeasonSeen = seasonSeen(selectedSeasonIdx);
  const currentSeasonDone = episodesCount > 0 && currentSeasonSeen === episodesCount;
  const movieSeen = !!w.movie_main;

  const isResumeSelection =
    !!resumePos && resumePos.s === selectedSeasonIdx && resumePos.e === selectedEpisodeIdx;
  const showRestart = !!resumePos && (resumePos.s !== 0 || resumePos.e !== 0);

  const playLabel = isSeries
    ? `${isResumeSelection ? 'Reprendre' : 'Lecture'} S${currentSeason?.seasonNumber || 1} · É${currentEpisode?.number || 1}`
    : hasMovieHistory ? 'Reprendre' : 'Regarder';

  const isAdmin = currentUser?.email === ADMIN_EMAIL;

  return (
    <main className="min-h-screen bg-[#080809] text-white font-sans pb-24 antialiased selection:bg-red-600 selection:text-white">
      {notice && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[80] px-4 w-full max-w-sm pointer-events-none">
          <div className="flex items-center gap-3 bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-2xl px-4 py-3 shadow-2xl">
            <span className="text-emerald-400"><Icon name="check" /></span>
            <p className="text-sm text-zinc-200">{notice}</p>
          </div>
        </div>
      )}

      {showVipModal && (
        <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-amber-500/20 bg-[#111113] shadow-[0_0_80px_-20px_rgba(245,158,11,0.35)]">
            <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-amber-500/15 to-transparent pointer-events-none" />
            <div className="relative p-8 text-center">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-zinc-950 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-amber-500/30">
                <Icon className="w-7 h-7" name="crown" />
              </div>
              <h3 className="text-xl font-bold tracking-tight mb-2">Passe au VIP</h3>
              <p className="text-sm text-zinc-400 leading-relaxed mb-6">
                Tu as utilisé tes <span className="text-white font-semibold">{MAX_FREE_LIMIT} visions gratuites</span> (films ou épisodes).
              </p>

              <button
                onClick={() => router.push('/abonnement')}
                className="w-full bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-zinc-950 font-bold py-3.5 rounded-full text-sm transition cursor-pointer shadow-lg shadow-amber-500/20"
              >
                Voir l'offre VIP
              </button>
              <button
                onClick={() => setShowVipModal(false)}
                className="mt-3 w-full py-2.5 text-sm text-zinc-400 hover:text-white transition cursor-pointer"
              >
                Plus tard
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="fixed top-0 inset-x-0 z-40 bg-gradient-to-b from-black/80 via-black/40 to-transparent">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-12 py-4">
          <button
            onClick={() => router.push('/')}
            className="group inline-flex items-center gap-2 text-sm font-medium text-zinc-200 hover:text-white bg-white/5 hover:bg-white/10 backdrop-blur-md border border-white/10 pl-3 pr-4 py-2 rounded-full transition cursor-pointer"
          >
            <Icon className="w-4 h-4 transition group-hover:-translate-x-0.5" name="back" />
            Retour
          </button>
          <span className="font-black text-lg tracking-[0.2em] text-red-600 select-none">
            YAMON<span className="text-white">FIM</span>
          </span>
        </div>
      </header>

      {isPlaying && (
        <section id="lecteur-video" className="relative z-10 w-[calc(100%-2rem)] max-w-7xl mx-auto mt-24 mb-10 bg-[#070708] flex flex-col rounded-3xl overflow-hidden border border-white/10 shadow-[0_30px_100px_-35px_rgba(0,0,0,0.9)]">
          {showAdPopup ? (
            <div className="flex-1 flex items-center justify-center p-4 bg-[radial-gradient(ellipse_at_center,rgba(220,38,38,0.12),transparent_60%)]">
              <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-[#111113] p-8 text-center shadow-2xl">
                <div className="w-14 h-14 rounded-2xl bg-red-600/10 border border-red-500/20 text-red-500 flex items-center justify-center mx-auto mb-5">
                  <Icon className="w-6 h-6" name="alert" />
                </div>
                <h3 className="text-lg font-bold tracking-tight mb-2">Prêt à lancer la vidéo</h3>
                <p className="text-sm text-zinc-400 leading-relaxed mb-7">
                  Si une page publicitaire s'ouvre dans un nouvel onglet,{' '}
                  <strong className="text-white font-semibold">ferme-la immédiatement</strong> et reviens ici.
                </p>
                <button
                  onClick={handleLaunchClick}
                  className="w-full inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 text-white font-semibold py-3.5 rounded-full text-sm transition shadow-lg shadow-red-600/30 cursor-pointer active:scale-[0.98]"
                >
                  <Icon className="w-4 h-4" name="play" /> Lancer la vidéo & Plein écran
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
              {/* Barre de contrôle du lecteur et du minuteur */}
              <div className="shrink-0 border-b border-white/10 bg-[#09090b]/95 backdrop-blur-2xl">
                <div className="max-w-[1600px] mx-auto flex flex-wrap items-center justify-between gap-3 px-4 sm:px-8 py-3.5">
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

                  {/* Widget Minuteur Visible & Modifiable pour tout le monde */}
                  {isSeries && (
                    <div className="flex items-center gap-2 bg-black/50 border border-white/10 px-3 py-1.5 rounded-2xl">
                      <div className="flex items-center gap-1.5 text-xs text-zinc-300 font-semibold px-2">
                        <Icon name="clock" className="w-3.5 h-3.5 text-red-500" />
                        <span className="font-mono text-white text-sm">{formatTimerDisplay(remainingSeconds)}</span>
                      </div>
                      <div className="h-4 w-[1px] bg-white/10" />
                      <button
                        onClick={togglePauseTimer}
                        className={`w-7 h-7 rounded-full flex items-center justify-center transition cursor-pointer ${
                          isPlayerPaused ? 'bg-amber-500 text-black' : 'bg-white/10 text-white hover:bg-white/20'
                        }`}
                        title={isPlayerPaused ? 'Reprendre le minuteur' : 'Mettre en pause le minuteur'}
                      >
                        <Icon name={isPlayerPaused ? 'play' : 'pause'} className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => addTime(-60)}
                        className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition cursor-pointer"
                        title="Retirer 1 minute"
                      >
                        <Icon name="minus" className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => addTime(60)}
                        className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition cursor-pointer"
                        title="Ajouter 1 minute"
                      >
                        <Icon name="plus" className="w-3 h-3" />
                      </button>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={requestFullscreenPlayer}
                      className="inline-flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white px-3.5 py-2 rounded-full text-xs font-semibold transition cursor-pointer"
                      title="Mettre en plein écran"
                    >
                      <Icon name="maximize" className="w-3.5 h-3.5" /> Plein écran
                    </button>

                    {!isVipUser && remainingFree !== null && (
                      <button
                        onClick={() => router.push('/abonnement')}
                        className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1.5 text-[11px] font-bold text-amber-400 ring-1 ring-amber-500/30 transition hover:bg-amber-500/20 cursor-pointer"
                      >
                        <Icon className="w-3.5 h-3.5" name="crown" />
                        {remainingFree} restante{remainingFree > 1 ? 's' : ''}
                      </button>
                    )}

                    <button
                      onClick={() => setPlayerKey(prev => prev + 1)}
                      title="Recharger le lecteur"
                      aria-label="Recharger le lecteur"
                      className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-zinc-300 hover:text-white transition cursor-pointer"
                    >
                      <Icon name="reload" />
                    </button>

                    <button
                      onClick={closePlayer}
                      className="inline-flex items-center gap-1.5 bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-full text-xs font-semibold transition cursor-pointer"
                    >
                      <Icon className="w-3.5 h-3.5" name="close" /> Fermer
                    </button>
                  </div>
                </div>
              </div>

              <div className="h-[56vw] min-h-[260px] max-h-[76vh] flex items-center justify-center p-0 sm:p-4 lg:p-6 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.06),transparent_65%)]">
                <div 
                  ref={playerWrapperRef}
                  className="w-full max-w-[1500px] max-h-full aspect-video bg-black sm:rounded-2xl overflow-hidden ring-1 ring-white/10 shadow-[0_24px_100px_-35px_rgba(0,0,0,0.9)] relative flex items-center justify-center group"
                >
                  <div className="absolute inset-x-0 bottom-4 flex justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20 pointer-events-none">
                    <button
                      onClick={requestFullscreenPlayer}
                      className="pointer-events-auto inline-flex items-center gap-2 bg-black/80 hover:bg-black text-white backdrop-blur-md px-4 py-2 rounded-full text-xs font-semibold shadow-lg border border-white/20 transition cursor-pointer"
                    >
                      <Icon name="maximize" className="w-3.5 h-3.5" /> Basculer en Plein Écran
                    </button>
                  </div>

                  {finalEmbedUrl ? (
                    <>
                      {!iframeLoaded && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-zinc-500 pointer-events-none z-10">
                          <div className="w-10 h-10 rounded-full border-2 border-white/10 border-t-red-600 animate-spin" />
                          <span className="text-xs">Chargement du lecteur…</span>
                        </div>
                      )}
                      <iframe
                        ref={iframeRef}
                        key={`player-${playerKey}-${selectedSeasonIdx}-${selectedEpisodeIdx}`}
                        src={finalEmbedUrl}
                        onLoad={() => setIframeLoaded(true)}
                        className="relative w-full h-full border-0"
                        allow="fullscreen; accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        referrerPolicy="origin"
                        title={media.title}
                      />
                    </>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-zinc-500">
                      <Icon className="w-6 h-6" name="alert" />
                      <span className="text-sm">Aucun flux vidéo disponible.</span>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </section>
      )}

      {/* Présentation du contenu */}
      <section className="relative w-full border-b border-white/[0.06]">
        <div className="relative h-[48svh] min-h-[360px] sm:h-[52vh] sm:min-h-[390px] w-full overflow-hidden">
          {mobileBg && (
            <img
              src={mobileBg}
              alt=""
              className={`absolute inset-0 w-full h-full object-cover sm:hidden ${hasText(media.poster) ? 'object-[center_15%]' : 'object-center'}`}
            />
          )}
          {desktopBg && (
            <img
              src={desktopBg}
              alt=""
              className="absolute inset-0 hidden sm:block w-full h-full object-cover object-center scale-105"
            />
          )}
          <div className="absolute inset-0 hidden sm:block bg-gradient-to-r from-[#0a0a0b] via-[#0a0a0b]/70 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0b] via-[#0a0a0b]/30 to-black/40" />
          <div className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-[#0a0a0b] via-[#0a0a0b]/70 to-transparent sm:hidden" />
        </div>

        <div className="absolute inset-x-0 bottom-0">
          <div className="max-w-7xl mx-auto px-4 sm:px-12 pb-10 flex items-end gap-8">
            {media.poster && (
              <img
                src={media.poster}
                alt={media.title}
                className="hidden md:block w-48 lg:w-56 aspect-[2/3] object-cover rounded-2xl ring-1 ring-white/10 shadow-2xl shadow-black/60"
              />
            )}

            <div className="flex-1 min-w-0 space-y-4 text-center sm:text-left">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <span className="text-[11px] uppercase tracking-wider font-semibold text-white bg-red-600 px-2.5 py-1 rounded-md">
                  {media.type === 'movie' ? 'Film' : 'Série'}
                </span>
                {isSeries && (
                  <span className="text-[11px] uppercase tracking-wider font-semibold text-zinc-300 bg-white/10 backdrop-blur px-2.5 py-1 rounded-md">
                    {media.seasons!.length} saison{media.seasons!.length > 1 ? 's' : ''}
                  </span>
                )}
                {(seriesDone || (!isSeries && movieSeen)) && (
                  <span className="inline-flex items-center gap-1 text-[11px] uppercase tracking-wider font-semibold text-emerald-300 bg-emerald-500/15 border border-emerald-500/25 px-2.5 py-1 rounded-md">
                    <Icon className="w-3 h-3" name="check" /> {isSeries ? 'Terminée' : 'Vu'}
                  </span>
                )}
              </div>

              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.05] drop-shadow-lg">
                {media.title}
              </h1>

              {media.description && (
                <p className="mx-auto sm:mx-0 text-sm sm:text-base text-zinc-300 max-w-2xl line-clamp-2 sm:line-clamp-3 leading-relaxed">
                  {media.description}
                </p>
              )}

              {isSeries && totalEpisodes > 0 && (
                <div className="mx-auto sm:mx-0 flex max-w-sm items-center gap-3">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/15">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${seriesDone ? 'bg-emerald-500' : 'bg-red-600'}`}
                      style={{ width: `${(seenEpisodes / totalEpisodes) * 100}%` }}
                    />
                  </div>
                  <span className="shrink-0 text-xs font-medium tabular-nums text-zinc-300">
                    {seenEpisodes} / {totalEpisodes} vus
                  </span>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 pt-1">
                <button
                  onClick={() => startPlaying(selectedSeasonIdx, selectedEpisodeIdx)}
                  disabled={isStarting}
                  className="inline-flex items-center gap-2.5 bg-white hover:bg-zinc-200 text-black font-bold py-3.5 pl-6 pr-7 rounded-full text-sm transition shadow-xl shadow-black/40 cursor-pointer active:scale-[0.97] disabled:opacity-60 disabled:cursor-wait"
                >
                  <Icon className="w-5 h-5" name="play" />
                  {playLabel}
                </button>

                {isSeries && showRestart && (
                  <button
                    onClick={restartFromBeginning}
                    className="inline-flex items-center gap-2 rounded-full bg-white/10 px-5 py-3.5 text-sm font-semibold text-white ring-1 ring-white/15 backdrop-blur transition hover:bg-white/15 cursor-pointer"
                  >
                    <Icon name="restart" /> Depuis le début
                  </button>
                )}

                {!isSeries && (
                  <button
                    onClick={toggleMovieWatched}
                    className={`inline-flex items-center gap-2 rounded-full px-5 py-3.5 text-sm font-semibold ring-1 backdrop-blur transition cursor-pointer ${
                      movieSeen
                        ? 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30 hover:bg-emerald-500/25'
                        : 'bg-white/10 text-white ring-white/15 hover:bg-white/15'
                    }`}
                  >
                    <Icon name="check" /> {movieSeen ? 'Vu' : 'Marquer comme vu'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Épisodes */}
      {isSeries && currentSeason && (
        <section className="max-w-7xl mx-auto px-4 sm:px-8 mt-10 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight">Épisodes <span className="text-red-500">.</span></h2>
              <p className="text-sm text-zinc-500 mt-0.5">
                Saison {currentSeason.seasonNumber} · {currentSeasonSeen} / {episodesCount} vu{currentSeasonSeen > 1 ? 's' : ''}
              </p>
            </div>

            <button
              onClick={() => setSeasonWatched(selectedSeasonIdx, !currentSeasonDone)}
              className={`inline-flex items-center gap-2 self-start rounded-full px-4 py-2 text-xs font-semibold ring-1 transition cursor-pointer sm:self-auto ${
                currentSeasonDone
                  ? 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30 hover:bg-emerald-500/25'
                  : 'bg-white/5 text-zinc-200 ring-white/10 hover:bg-white/10'
              }`}
            >
              <Icon name="check" className="w-3.5 h-3.5" />
              {currentSeasonDone ? `Saison ${currentSeason.seasonNumber} vue` : `Marquer la saison ${currentSeason.seasonNumber} comme vue`}
            </button>
          </div>

          {media.seasons!.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {media.seasons!.map((season, sIdx) => {
                const isSelected = selectedSeasonIdx === sIdx;
                const seen = seasonSeen(sIdx);
                const done = season.episodes.length > 0 && seen === season.episodes.length;
                return (
                  <button
                    key={sIdx}
                    onClick={() => {
                      if (sIdx === selectedSeasonIdx) return;
                      const previous = posRef.current;
                      if (isPlaying && mediaRef.current?.type === 'series') {
                        void markAsWatched(epKey(previous.s, previous.e));
                        void saveWatchHistory(previous.s, previous.e, currentProgressRef.current.currentTime, currentProgressRef.current.duration);
                        currentProgressRef.current = { currentTime: 0, duration: 0 };
                      }
                      setSelectedSeasonIdx(sIdx);
                      setSelectedEpisodeIdx(0);
                      posRef.current = { s: sIdx, e: 0 };
                      setResumePos({ s: sIdx, e: 0 });
                      if (isPlaying) {
                        setPlayerKey(prevKey => prevKey + 1);
                        setIframeLoaded(false);
                        void saveWatchHistory(sIdx, 0, 0, 0);
                        setNotice(`Saison ${season.seasonNumber}`);
                      }
                    }}
                    className={`inline-flex shrink-0 items-center gap-1.5 px-5 py-2 rounded-full text-sm font-semibold transition cursor-pointer ${
                      isSelected
                        ? 'bg-white text-black'
                        : 'bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 border border-white/10'
                    }`}
                  >
                    {done && <Icon name="check" className={`w-3.5 h-3.5 ${isSelected ? 'text-emerald-600' : 'text-emerald-400'}`} />}
                    Saison {season.seasonNumber}
                    {!done && seen > 0 && (
                      <span className={`text-[11px] tabular-nums ${isSelected ? 'text-zinc-500' : 'text-zinc-500'}`}>
                        {seen}/{season.episodes.length}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          <div ref={episodeListRef} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {currentSeason.episodes.map((ep, eIdx) => {
              const isSelected = eIdx === selectedEpisodeIdx;
              const isWatched = !!w[epKey(selectedSeasonIdx, eIdx)];
              const isResume = resumePos?.s === selectedSeasonIdx && resumePos?.e === eIdx;
              const thumb = ep.still_path || currentSeason.poster_path || media.poster;
              const canMarkUpTo = !isWatched && (eIdx > 0 || selectedSeasonIdx > 0);

              return (
                <div
                  key={eIdx}
                  data-ep={`${selectedSeasonIdx}-${eIdx}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => selectEpisode(eIdx)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') startPlaying(selectedSeasonIdx, eIdx);
                    else if (e.key === ' ') { e.preventDefault(); selectEpisode(eIdx); }
                  }}
                  className={`group relative flex gap-4 p-3 rounded-2xl border transition cursor-pointer scroll-mt-24 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600 ${
                    isSelected
                      ? 'bg-gradient-to-br from-red-950/70 to-[#111114] border-red-500/60 ring-1 ring-red-500/25 shadow-[0_8px_35px_-20px_rgba(239,68,68,0.65)]'
                      : isWatched
                        ? 'bg-gradient-to-br from-emerald-950/20 to-[#0e0e10] border-emerald-500/20 hover:border-emerald-500/40'
                        : 'bg-[#111114]/80 border-white/[0.07] hover:bg-[#18181c] hover:border-white/20 hover:-translate-y-0.5 hover:shadow-xl'
                  }`}
                >
                  <div className="relative w-28 sm:w-36 shrink-0 aspect-video rounded-xl overflow-hidden bg-zinc-900 ring-1 ring-white/10">
                    {thumb && (
                      <img
                        src={thumb}
                        alt=""
                        loading="lazy"
                        className={`w-full h-full object-cover transition duration-300 group-hover:scale-105 ${isWatched && !isSelected ? 'opacity-50' : ''}`}
                      />
                    )}
                    <button
                      onClick={e => { e.stopPropagation(); startPlaying(selectedSeasonIdx, eIdx); }}
                      aria-label={`Lire l'épisode ${ep.number}`}
                      className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition group-hover:opacity-100 focus:opacity-100"
                    >
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-black">
                        <Icon name="play" className="h-4 w-4 translate-x-[1px]" />
                      </span>
                    </button>
                    {isResume && !isWatched && (
                      <span className="absolute left-1.5 top-1.5 rounded-md bg-red-600 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider shadow">
                        En cours
                      </span>
                    )}
                    {isWatched && (
                      <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-md bg-emerald-500 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider shadow">
                        <Icon name="check" className="h-3 w-3" /> Vu
                      </span>
                    )}
                    {isSelected && <span className="absolute bottom-0 inset-x-0 h-1 bg-red-600" />}
                  </div>

                  <div className="min-w-0 flex-1 py-1 space-y-1 pr-8">
                    <div className="flex items-center gap-2">
                      <p className={`text-[11px] font-semibold uppercase tracking-wider ${isSelected ? 'text-red-500' : 'text-zinc-500'}`}>
                        {isSelected ? 'Sélectionné' : `Épisode ${ep.number}`}
                      </p>
                      {ep.runtime && ep.runtime > 0 ? (
                        <p className="text-[11px] text-zinc-500">· {ep.runtime} min</p>
                      ) : null}
                    </div>
                    <p className={`text-sm font-semibold line-clamp-2 leading-snug ${isWatched && !isSelected ? 'text-zinc-400' : 'text-white'}`}>
                      {isSelected ? `${ep.number}. ` : ''}{ep.title || `Épisode ${ep.number}`}
                    </p>
                    {canMarkUpTo && (
                      <button
                        onClick={e => { e.stopPropagation(); markUpTo(selectedSeasonIdx, eIdx); }}
                        className="text-[11px] font-medium text-zinc-500 opacity-0 transition hover:text-white group-hover:opacity-100 focus:opacity-100"
                      >
                        Tout marquer vu jusqu'ici
                      </button>
                    )}
                  </div>

                  <button
                    onClick={e => { e.stopPropagation(); toggleEpisodeWatched(selectedSeasonIdx, eIdx); }}
                    aria-label={isWatched ? 'Marquer comme non vu' : 'Marquer comme vu'}
                    aria-pressed={isWatched}
                    title={isWatched ? 'Marquer comme non vu' : 'Marquer comme vu'}
                    className={`absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full ring-2 transition ${
                      isWatched
                        ? 'bg-emerald-500 text-white ring-emerald-500 hover:bg-emerald-400'
                        : 'text-transparent ring-white/20 hover:text-white/50 hover:ring-white/40'
                    }`}
                  >
                    <Icon name="check" className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Commentaires */}
      <section className="max-w-7xl mx-auto px-4 sm:px-8 mt-14 space-y-8 border-t border-white/5 pt-10">
        <div>
          <h2 className="text-2xl font-black tracking-tight">Commentaires ({comments.length})</h2>
          <p className="text-sm text-zinc-400 mt-1">Donne ton avis ou discute de ce contenu avec la communauté.</p>
        </div>

        {currentUser ? (
          <form onSubmit={handleAddComment} className="rounded-3xl bg-white/[0.03] p-4 sm:p-6 ring-1 ring-white/10 space-y-4">
            <textarea
              required
              rows={3}
              placeholder="Écris ton commentaire..."
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-white outline-none focus:border-red-600 resize-none"
            />
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={submittingComment}
                className="inline-flex items-center gap-2 rounded-full bg-red-600 hover:bg-red-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-red-600/25 transition cursor-pointer disabled:opacity-50"
              >
                <Icon name="send" className="w-4 h-4" />
                {submittingComment ? 'Publication...' : 'Publier le commentaire'}
              </button>
            </div>
          </form>
        ) : (
          <div className="rounded-3xl border border-dashed border-white/10 p-6 text-center">
            <p className="text-sm text-zinc-400">Connecte-toi pour laisser un commentaire.</p>
          </div>
        )}

        <div className="space-y-4">
          {comments.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-white/10 py-12 text-center text-sm text-zinc-500">
              Aucun commentaire pour le moment. Sois le premier à donner ton avis !
            </div>
          ) : (
            comments.map(comment => {
              const isAuthor = currentUser?.id === comment.user_id;
              return (
                <div key={comment.id} className="rounded-2xl bg-white/[0.02] p-4 sm:p-5 ring-1 ring-white/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-red-600/20 text-xs font-bold text-red-400 uppercase">
                        {comment.user_email[0]}
                      </span>
                      <span className="text-xs font-semibold text-zinc-300">
                        {maskEmail(comment.user_email)}
                      </span>
                      <span className="text-[11px] text-zinc-500">· {timeAgo(comment.created_at)}</span>
                    </div>

                    {(isAuthor || isAdmin) && (
                      <button
                        onClick={() => handleDeleteComment(comment.id)}
                        aria-label="Supprimer le commentaire"
                        className="rounded-full bg-white/5 p-2 text-zinc-400 hover:bg-red-600 hover:text-white transition cursor-pointer"
                      >
                        <Icon name="trash" className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-zinc-200 leading-relaxed pl-9 whitespace-pre-wrap">{comment.content}</p>
                </div>
              );
            })
          )}
        </div>
      </section>
    </main>
  );
}