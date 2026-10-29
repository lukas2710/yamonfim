'use client';

import { useCallback, useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import type Hls from 'hls.js';
import { playbackRequest, invalidatePlayback } from '@/lib/playback-request';
import { isNativePlayback, isMoviezPlayer, playbackProgress } from '@/lib/watch-progress';
import { getPersistentSession } from '@/lib/auth-session';
import { isCataloguePlayer, isSupportedEmbed, MAX_SOURCE_EMBEDS } from '@/lib/catalogue-source';
import { playerTime, playerSeek, preferredAudioTrack, frenchFirstAudioTracks, audioTrackLabel, type PlayerAudioTrack } from '@/lib/player-controls';
import styles from './WatchPlayer.module.css';

interface NativeAudioTrack { id: string; label: string; language: string; enabled: boolean }
interface NativeAudioTracks extends EventTarget { length: number; [index: number]: NativeAudioTrack }
type AudioVideo = HTMLVideoElement & { audioTracks?: NativeAudioTracks };
const AUDIO_LANGUAGE_KEY = 'yamonfim_audio_language';
const MAX_PLAYBACK_FAILOVERS = 2;

type SafariVideo = HTMLVideoElement & { webkitEnterFullscreen?: () => void; webkitExitFullscreen?: () => void; webkitDisplayingFullscreen?: boolean };
type SafariDocument = Document & { webkitFullscreenElement?: Element; webkitExitFullscreen?: () => void };

function PlayerIcon({ name }: { name: 'play' | 'pause' | 'back' | 'forward' | 'volume' | 'muted' | 'cast' | 'fullscreen' | 'minimize' | 'settings' | 'pip' | 'close' }) {
  const paths = {
    play: <path d="m9 5 11 7-11 7Z" fill="currentColor" />,
    pause: <path d="M8 5v14M16 5v14" strokeWidth="4" />,
    back: <><path d="M4 10a8 8 0 1 1 1 8M4 4v6h6" /><text x="9" y="16" fontSize="8" fill="currentColor" stroke="none">10</text></>,
    forward: <><path d="M20 10a8 8 0 1 0-1 8M20 4v6h-6" /><text x="9" y="16" fontSize="8" fill="currentColor" stroke="none">10</text></>,
    volume: <path d="m11 5-6 5H2v4h3l6 5ZM15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" />,
    muted: <path d="m11 5-6 5H2v4h3l6 5ZM16 9l6 6m0-6-6 6" />,
    cast: <path d="M3 8V4h18v16h-9M3 20h.01M3 15a5 5 0 0 1 5 5M3 10a10 10 0 0 1 10 10" />,
    fullscreen: <path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5" />,
    minimize: <path d="M3 8h5V3m8 0v5h5M8 21v-5H3m18 0h-5v5" />,
    settings: <><path d="M4 7h16M4 17h16" /><circle cx="9" cy="7" r="3" fill="#17171b" /><circle cx="15" cy="17" r="3" fill="#17171b" /></>,
    pip: <><rect x="2" y="4" width="20" height="16" rx="2" /><rect x="12" y="11" width="8" height="7" rx="1" fill="currentColor" /></>,
    close: <path d="m6 6 12 12M6 18 18 6" />,
  };
  return <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

export interface WatchPlayerControl { togglePause: () => void; simulateFailure?: () => void }
interface Props {
  src: string; title: string; resumeAt: number; controlRef: Ref<WatchPlayerControl>;
  initialExcludedEmbeds?: string[];
  onProgress: (time: number, duration: number, paused?: boolean, source?: string) => void;
  onState: (paused: boolean) => void; onEnded: (source?: string) => void;
  onExit?: () => void;
  nextEpisodeIn?: number | null;
  nextEpisodeSource?: string;
  onPlayNext?: () => void;
  onCancelNext?: () => void;
}

export default function WatchPlayer({ src, title, resumeAt, controlRef, onProgress, onState, onEnded, initialExcludedEmbeds, onExit, nextEpisodeIn, nextEpisodeSource, onPlayNext, onCancelNext }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [loading, setLoading] = useState(false);
  const [pausedState, setPausedState] = useState(true);
  const [position, setPosition] = useState({ currentTime: 0, duration: 0 });
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [visible, setVisible] = useState(true);
  const [castInfo, setCastInfo] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [pipSupported, setPipSupported] = useState(false);
  const [inPip, setInPip] = useState(false);
  const [controlMessage, setControlMessage] = useState('');
  const [audioTracks, setAudioTracks] = useState<PlayerAudioTrack[]>([]);
  const [audioTrack, setAudioTrack] = useState(-1);
  const hlsRef = useRef<Hls | null>(null);
  const nativePlaylistRef = useRef('');
  const rootRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const interacting = useRef(false);
  const pointerType = useRef('mouse');
  const touchControlsVisible = useRef(true);
  const automaticRetries = useRef(0);
  const excludedEmbeds = useRef<string[]>(initialExcludedEmbeds || []);
  const activeEmbed = useRef('');
  const sourceIdentity = useRef(src);
  const [sourceMessage, setSourceMessage] = useState('');
  const [sourceOptions, setSourceOptions] = useState<{ embed: string; provider: string; quality?: { height: number } }[]>([]);
  const [selectedSource, setSelectedSource] = useState('');
  const manualSource = useRef('');
  const restoreTimeRef = useRef(resumeAt);
  const [autoplayMuted, setAutoplayMuted] = useState(false);
  const initialResumeRef = useRef(resumeAt);
  initialResumeRef.current = resumeAt;
  const playbackIntent = useRef(true);
  const speedRef = useRef(1);
  const failureRef = useRef<(() => void) | null>(null);
  const callbacks = useRef({ onProgress, onState, onEnded });
  useEffect(() => { callbacks.current = { onProgress, onState, onEnded }; }, [onProgress, onState, onEnded]);
  const direct = isNativePlayback(src);
  const togglePause = () => {
    const video = videoRef.current;
    if (!video) return;
    playbackIntent.current = video.paused;
    if (video.paused) void video.play().catch(() => setError('La lecture n’a pas pu reprendre. Utilise les commandes vidéo.'));
    else video.pause();
  };
  useImperativeHandle(controlRef, () => ({ togglePause, ...(process.env.NODE_ENV === 'development' ? { simulateFailure: () => failureRef.current?.() } : {}) }));
  const reveal = useCallback(() => {
    setVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (interacting.current || rootRef.current?.querySelector(':focus-visible')) return;
      setVisible(false);
    }, 3000);
  }, []);
  useEffect(() => { if (!pausedState && !loading && !settingsOpen && !castInfo) reveal(); }, [pausedState, loading, settingsOpen, castInfo, reveal]);
  useEffect(() => () => { if (hideTimer.current) clearTimeout(hideTimer.current); }, []);
  useEffect(() => {
    const release = () => { if (interacting.current) { interacting.current = false; reveal(); } };
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    return () => { window.removeEventListener('pointerup', release); window.removeEventListener('pointercancel', release); };
  }, [reveal]);
  useEffect(() => {
    const video = videoRef.current as SafariVideo | null;
    const sync = () => { setIsFullscreen(!!(document.fullscreenElement || (document as SafariDocument).webkitFullscreenElement || video?.webkitDisplayingFullscreen)); reveal(); };
    const pip = () => setInPip(document.pictureInPictureElement === video);
    setPipSupported(!!(document.pictureInPictureEnabled && video?.requestPictureInPicture));
    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('webkitfullscreenchange', sync);
    video?.addEventListener('webkitbeginfullscreen', sync);
    video?.addEventListener('webkitendfullscreen', sync);
    video?.addEventListener('enterpictureinpicture', pip);
    video?.addEventListener('leavepictureinpicture', pip);
    return () => {
      document.removeEventListener('fullscreenchange', sync); document.removeEventListener('webkitfullscreenchange', sync);
      video?.removeEventListener('webkitbeginfullscreen', sync); video?.removeEventListener('webkitendfullscreen', sync);
      video?.removeEventListener('enterpictureinpicture', pip); video?.removeEventListener('leavepictureinpicture', pip);
    };
  }, [direct, reveal]);
  useEffect(() => {
    if (!controlMessage) return;
    const timer = setTimeout(() => setControlMessage(''), 4500);
    return () => clearTimeout(timer);
  }, [controlMessage]);
  const seek = (time: number) => {
    const video = videoRef.current;
    if (video && video.readyState > 0) video.currentTime = playerSeek(time, video.duration);
    reveal();
  };
  const fullscreen = async () => {
    const video = videoRef.current as SafariVideo | null;
    const doc = document as SafariDocument;
    reveal(); setSettingsOpen(false);
    if (expanded) {
      setExpanded(false);
      if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
      else if (doc.webkitFullscreenElement && doc.webkitExitFullscreen) doc.webkitExitFullscreen();
      return;
    }
    try {
      if (document.fullscreenElement) { await document.exitFullscreen(); return; }
      if (doc.webkitFullscreenElement && doc.webkitExitFullscreen) { doc.webkitExitFullscreen(); return; }
      if (video?.webkitDisplayingFullscreen && video.webkitExitFullscreen) { video.webkitExitFullscreen(); return; }
      if (rootRef.current?.requestFullscreen) {
        setExpanded(true);
        await rootRef.current.requestFullscreen();
        return;
      }
      // iPhone's native video fullscreen hides HTML overlays. The expanded
      // player keeps the next-episode bar visible and survives source changes.
    } catch { /* Use a viewport-sized player when the browser rejects fullscreen. */ }
    setExpanded(true);
  };
  const pictureInPicture = async () => {
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else if (videoRef.current) await videoRef.current.requestPictureInPicture();
    } catch { setControlMessage('Le mini-lecteur sera disponible après le démarrage de la vidéo, si ton navigateur le permet.'); }
    reveal();
  };
  const changeAudio = (id: number) => {
    const track = audioTracks.find(item => item.id === id);
    if (!track) return;
    if (hlsRef.current) hlsRef.current.audioTrack = id;
    else {
      const tracks = (videoRef.current as AudioVideo | null)?.audioTracks;
      if (tracks?.length) for (let index = 0; index < tracks.length; index++) tracks[index].enabled = index === id;
      else if (videoRef.current && nativePlaylistRef.current && track.lang) {
        const video = videoRef.current;
        const time = video.currentTime;
        const wasPaused = video.paused;
        const selected = new URL(nativePlaylistRef.current, window.location.origin);
        selected.searchParams.set('audio', track.lang);
        video.addEventListener('loadedmetadata', () => {
          video.currentTime = playerSeek(time, video.duration);
          if (wasPaused) video.pause();
        }, { once: true });
        restoreTimeRef.current = time;
        video.src = selected.href;
      }
    }
    setAudioTrack(id);
    if (track.lang) try { localStorage.setItem(AUDIO_LANGUAGE_KEY, track.lang); } catch {}
    reveal();
  };

  useEffect(() => {
    if (!direct || !videoRef.current) return;
    if (sourceIdentity.current !== src) {
      sourceIdentity.current = src;
      excludedEmbeds.current = initialExcludedEmbeds || []; activeEmbed.current = ''; automaticRetries.current = 0;
      restoreTimeRef.current = initialResumeRef.current;
      playbackIntent.current = true;
      manualSource.current = ''; setSelectedSource(''); setSourceOptions([]);
    }
    const video = videoRef.current;
    const nativeAudio = (video as AudioVideo).audioTracks;
    const preferNativeHls = !!video.canPlayType('application/vnd.apple.mpegurl') &&
      (!!(video as SafariVideo).webkitEnterFullscreen || 'ManagedMediaSource' in window);
    let hls: Hls | null = null;
    let disposed = false;
    let restored = false;
    let pendingRestore: number | null = null;
    let failing = false;
    let startingPlayback = false;
    let networkRecoveries = 0, mediaRecoveries = 0;
    let resolvedToken = '';
    let lastAdvancingTime = video.currentTime;
    let stallTimer: ReturnType<typeof setTimeout> | null = null;
    const resolvedSource = isMoviezPlayer(src) || isCataloguePlayer(src) || isSupportedEmbed(src);
    const languagePreference = () => { try { return localStorage.getItem(AUDIO_LANGUAGE_KEY) || 'fr'; } catch { return 'fr'; } };
    const updateNativeAudio = () => {
      if (!nativeAudio?.length || disposed || hls) return;
      const tracks: PlayerAudioTrack[] = Array.from({ length: nativeAudio.length }, (_, id) => ({ id, name: nativeAudio[id].label, lang: nativeAudio[id].language }));
      setAudioTracks(frenchFirstAudioTracks(tracks));
      const selected = tracks.find(track => nativeAudio[track.id].enabled)?.id ?? 0;
      setAudioTrack(tracks.length ? selected : -1);
    };
    const progress = () => {
      if (disposed) return;
      if (Math.abs(video.currentTime - lastAdvancingTime) > .2) {
        lastAdvancingTime = video.currentTime;
        clearStall();
      }
      if (!restored) return;
      if (pendingRestore !== null) {
        if (video.seeking || Math.abs(video.currentTime - pendingRestore) > 1) return;
        pendingRestore = null;
      }
      const value = playbackProgress(video.currentTime, video.duration);
      if (!value.duration) return;
      setPosition(value);
      restoreTimeRef.current = value.currentTime;
      callbacks.current.onProgress(value.currentTime, value.duration, video.paused, src);
    };
    const startAutomatically = async () => {
      if (disposed || !playbackIntent.current || startingPlayback) return;
      startingPlayback = true;
      try { await video.play(); }
      catch (error) {
        if (disposed || !playbackIntent.current) return;
        if ((error as { name?: string } | null)?.name === 'NotAllowedError') {
          // Mobile browsers may block sound after asynchronous source loading.
          // Start silently, then let a deliberate tap restore sound.
          video.muted = true;
          setMuted(true);
          setAutoplayMuted(true);
          try { await video.play(); } catch { if (!disposed) callbacks.current.onState(true); }
        } else if (!disposed) callbacks.current.onState(true);
      } finally { startingPlayback = false; }
    };
    const restore = () => {
      if (!restored) {
        restored = true;
        const target = restoreTimeRef.current;
        if (target > 0 && Number.isFinite(video.duration) && video.duration > 0) {
          pendingRestore = Math.min(target, Math.max(0, video.duration - 0.1));
          video.currentTime = pendingRestore;
        }
        video.playbackRate = speedRef.current;
        if (nativeAudio && !hls) {
          const tracks = Array.from({ length: nativeAudio.length }, (_, id) => ({ id, name: nativeAudio[id].label, lang: nativeAudio[id].language }));
          const preferred = preferredAudioTrack(tracks, languagePreference());
          if (preferred !== null) for (let index = 0; index < nativeAudio.length; index++) nativeAudio[index].enabled = index === preferred;
          updateNativeAudio();
        }
      }
      void startAutomatically();
    };
    const playing = () => { setPausedState(false); callbacks.current.onState(false); };
    const paused = () => { if (failing || video.error) return; setPausedState(true); progress(); callbacks.current.onState(true); };
    const sound = () => { setVolume(video.volume); setMuted(video.muted); if (!video.muted) setAutoplayMuted(false); };
    const rate = () => { if (restored) { speedRef.current = video.playbackRate; setSpeed(video.playbackRate); } };
    const ended = () => { if (!disposed) { progress(); callbacks.current.onEnded(src); } };
    const failed = () => {
      if (disposed || failing) return;
      if (resolvedToken) invalidatePlayback(src, resolvedToken);
      failing = true;
      if (restored && pendingRestore === null && video.currentTime > 0 && Number.isFinite(video.currentTime)) restoreTimeRef.current = video.currentTime;
      if (resolvedSource && automaticRetries.current < MAX_PLAYBACK_FAILOVERS) {
        manualSource.current = ''; setSelectedSource('');
        if (activeEmbed.current) excludedEmbeds.current = [...new Set([...excludedEmbeds.current, activeEmbed.current])];
        automaticRetries.current++;
        setSourceMessage('Flux interrompu : recherche d’une autre source…');
        setRetry(value => value + 1);
      } else { setLoading(false); setError('Ce flux est indisponible. Tu peux réessayer ou signaler le problème.'); }
    };
    const clearStall = () => { if (stallTimer) clearTimeout(stallTimer); stallTimer = null; };
    failureRef.current = failed;
    const stalled = () => {
      if (stallTimer || disposed || video.paused || video.ended || video.seeking || document.hidden || window.navigator.onLine === false) return;
      const position = video.currentTime;
      stallTimer = setTimeout(() => {
        stallTimer = null;
        if (disposed || video.paused || video.ended || video.seeking || document.hidden || window.navigator.onLine === false || Math.abs(video.currentTime - position) > .2) return;
        // Give the existing source one chance to recover before replacing it.
        if (networkRecoveries++ < 1) {
          if (hls) hls.startLoad(video.currentTime);
          else { restoreTimeRef.current = video.currentTime; restored = false; video.load(); void startAutomatically(); }
          stalled();
        } else failed();
      }, 45000);
    };
    const mediaFailed = () => {
      if (video.error?.code === 1 || document.hidden || window.navigator.onLine === false) return;
      if (video.error?.code === 2 && networkRecoveries++ < 1) {
        if (hls) hls.startLoad(video.currentTime);
        else { restoreTimeRef.current = video.currentTime; restored = false; video.load(); void startAutomatically(); }
        return;
      }
      failed();
    };
    const visibility = () => {
      clearStall();
      if (document.hidden || window.navigator.onLine === false || !playbackIntent.current) return;
      if (video.error) mediaFailed();
      else {
        if (hls && video.readyState < 3) hls.startLoad(video.currentTime);
        void startAutomatically();
      }
    };
    video.addEventListener('waiting', stalled);
    video.addEventListener('stalled', stalled);
    video.addEventListener('playing', clearStall);
    video.addEventListener('canplay', clearStall);
    video.addEventListener('seeking', clearStall);
    video.addEventListener('pause', clearStall);
    video.addEventListener('loadedmetadata', restore);
    video.addEventListener('canplay', restore);
    video.addEventListener('timeupdate', progress);
    video.addEventListener('seeked', progress);
    video.addEventListener('play', playing);
    video.addEventListener('pause', paused);
    video.addEventListener('ended', ended);
    video.addEventListener('error', mediaFailed);
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('offline', clearStall);
    window.addEventListener('online', visibility);
    video.addEventListener('volumechange', sound);
    video.addEventListener('ratechange', rate);
    nativeAudio?.addEventListener('addtrack', updateNativeAudio);
    nativeAudio?.addEventListener('removetrack', updateNativeAudio);
    nativeAudio?.addEventListener('change', updateNativeAudio);
    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      // Download the playback engine while the server resolves the video.
      const engine = !preferNativeHls && (resolvedSource || /\.m3u8(?:\?|$)/i.test(src)) ? import('hls.js').then(module => ({ module }), error => ({ error })) : null;
      let playable = src;
      let manifestAudio: PlayerAudioTrack[] = [];
      if (resolvedSource) {
        const { data: { session } } = await getPersistentSession();
        if (!session) throw new Error('Session expirée');
        resolvedToken = session.access_token;
        const response = await playbackRequest(src, session.access_token, excludedEmbeds.current, manualSource.current);
        const data = response.data;
        if (disposed) return;
        if (!response.ok && data.hasMore && Array.isArray(data.attempted) && automaticRetries.current < MAX_SOURCE_EMBEDS) {
          const previous = excludedEmbeds.current.length;
          excludedEmbeds.current = [...new Set([...excludedEmbeds.current, ...data.attempted.filter((embed: unknown): embed is string => typeof embed === 'string')])];
          if (excludedEmbeds.current.length > previous) {
            automaticRetries.current++;
            failing = true;
            setSourceMessage('Recherche d’une autre source disponible…');
            setRetry(value => value + 1);
            return;
          }
        }
        if (!response.ok || typeof data.url !== 'string') throw new Error('Flux indisponible');
        activeEmbed.current = data.embed || '';
        if (Array.isArray(data.alternatives)) setSourceOptions(data.alternatives.filter((option: { embed?: unknown }) => typeof option.embed === 'string'));
        const qualityLabel = data.quality?.height > 0 ? `${data.quality.height}p` : '';
        setSourceMessage(qualityLabel ? `Meilleure qualité vérifiée : ${qualityLabel} · ${data.provider}` : data.provider === 'Movix' ? 'Lecture via une source de secours Movix' : '');
        playable = data.url;
        if (Array.isArray(data.audioTracks)) manifestAudio = data.audioTracks;
      }
      if (disposed) return;
      const attachNative = () => {
        nativePlaylistRef.current = playable;
        if (manifestAudio.length) {
          setAudioTracks(frenchFirstAudioTracks(manifestAudio));
          const preferred = preferredAudioTrack(manifestAudio, languagePreference()) ?? preferredAudioTrack(manifestAudio, 'fr') ?? manifestAudio[0].id;
          setAudioTrack(preferred);
          const selected = new URL(playable, window.location.origin);
          selected.searchParams.set('audio', manifestAudio.find(track => track.id === preferred)?.lang || '');
          playable = selected.href;
        }
        video.src = playable;
      };
      // Safari/iPhone use their native HLS pipeline; other browsers keep HLS.js.
      if (/\.m3u8(?:\?|$)/i.test(playable)) {
        if (preferNativeHls) attachNative();
        else {
        const loaded = engine ? await engine : { module: await import('hls.js') };
        if ('error' in loaded) throw loaded.error;
        const { default: Hls } = loaded.module;
        if (disposed) return;
        if (Hls.isSupported()) {
          // Start small, then let ABR raise quality without an initial probe reload.
          hls = new Hls({
            startLevel: 0,
            testBandwidth: false,
            // Resume directly at the saved segment instead of downloading the
            // beginning, then seeking and buffering a second time.
            startPosition: Number.isFinite(restoreTimeRef.current) && restoreTimeRef.current > 0 ? restoreTimeRef.current : -1,
          });
          hlsRef.current = hls;
          hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, () => {
            if (!hls || disposed) return;
            const tracks = hls.audioTracks.map((track, id) => ({ id, name: track.name || '', lang: track.lang || '' }));
            const available = tracks.length ? tracks : manifestAudio;
            setAudioTracks(frenchFirstAudioTracks(available));
            const preferred = preferredAudioTrack(available, languagePreference()) ?? preferredAudioTrack(available, 'fr');
            if (tracks.length && preferred !== null && preferred !== hls.audioTrack) hls.audioTrack = preferred;
            setAudioTrack(preferred ?? (tracks.length ? hls.audioTrack : available[0]?.id ?? -1));
          });
          hls.on(Hls.Events.AUDIO_TRACK_SWITCHED, (_, data) => { if (!disposed) setAudioTrack(data.id); });
          hls.loadSource(playable); hls.attachMedia(video);
          hls.on(Hls.Events.ERROR, (_, data) => {
            if (!data.fatal || disposed || document.hidden || window.navigator.onLine === false) return;
            if (data.type === Hls.ErrorTypes.NETWORK_ERROR && networkRecoveries++ < 2) { hls?.startLoad(video.currentTime); return; }
            if (data.type === Hls.ErrorTypes.MEDIA_ERROR && mediaRecoveries++ < 1) { hls?.recoverMediaError(); return; }
            failed();
          });
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          attachNative();
        }
        else failed();
        }
      } else video.src = playable;
      void startAutomatically();
      setLoading(false);
    };
    void load().catch(() => {
      if (!disposed) {
        if (manualSource.current) {
          excludedEmbeds.current = [...new Set([...excludedEmbeds.current, manualSource.current])];
          manualSource.current = ''; setSelectedSource('');
          setSourceMessage('Cette source est indisponible : retour au choix automatique…');
          setRetry(value => value + 1);
          return;
        }
        setLoading(false);
        setError('Aucun flux compatible disponible sur Moviez ou Movix. Réessaie dans un instant.');
      }
    });
    return () => {
      // Some browsers exit native fullscreen when a media source is cleared.
      // Keep the same viewport-sized player through the episode handoff.
      if (rootRef.current && (document.fullscreenElement === rootRef.current || (document as SafariDocument).webkitFullscreenElement === rootRef.current)) setExpanded(true);
      disposed = true;
      if (failureRef.current === failed) failureRef.current = null;
      clearStall();
      video.removeEventListener('waiting', stalled); video.removeEventListener('stalled', stalled);
      video.removeEventListener('playing', clearStall); video.removeEventListener('pause', clearStall);
      video.removeEventListener('canplay', clearStall); video.removeEventListener('seeking', clearStall);
      document.removeEventListener('visibilitychange', visibility); window.removeEventListener('offline', clearStall);
      window.removeEventListener('online', visibility);
      controller.abort();
      video.removeEventListener('loadedmetadata', restore); video.removeEventListener('timeupdate', progress);
      video.removeEventListener('canplay', restore);
      video.removeEventListener('seeked', progress); video.removeEventListener('play', playing);
      video.removeEventListener('pause', paused); video.removeEventListener('ended', ended); video.removeEventListener('error', mediaFailed);
      video.removeEventListener('volumechange', sound); video.removeEventListener('ratechange', rate);
      nativeAudio?.removeEventListener('addtrack', updateNativeAudio);
      nativeAudio?.removeEventListener('removetrack', updateNativeAudio);
      nativeAudio?.removeEventListener('change', updateNativeAudio);
      hlsRef.current = null;
      nativePlaylistRef.current = '';
      hls?.destroy(); video.pause(); video.removeAttribute('src'); video.load();
    };
  // Updating the saved resume position must not destroy an already loaded video.
  }, [src, direct, retry]);

  const controlsVisible = visible || pausedState || castInfo || settingsOpen || loading || !!error;
  if (!direct) return <iframe src={src} title={title} className="relative w-full h-full border-0" allow="fullscreen; accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowFullScreen referrerPolicy="origin" />;
  return <div ref={rootRef} className={styles.player} data-controls={controlsVisible ? 'visible' : 'hidden'} data-expanded={expanded || undefined} role="group" aria-label={`Lecteur de ${title}`} tabIndex={0}
    onPointerMove={event => { if (event.pointerType === 'mouse') reveal(); }}
    onPointerDown={event => { pointerType.current = event.pointerType; touchControlsVisible.current = controlsVisible; if (event.pointerType === 'mouse' || (event.target as HTMLElement).closest('button,input,select')) reveal(); }} onFocus={reveal}
    onKeyDown={event => {
      if (event.key === 'Escape' && (settingsOpen || castInfo || expanded || isFullscreen)) {
        event.preventDefault(); event.stopPropagation();
        if (settingsOpen || castInfo) { setSettingsOpen(false); setCastInfo(false); }
        else if (expanded) void fullscreen();
        else if (document.fullscreenElement || (document as SafariDocument).webkitFullscreenElement || (videoRef.current as SafariVideo | null)?.webkitDisplayingFullscreen) void fullscreen();
        else setIsFullscreen(false);
        reveal(); return;
      }
      if ((event.target as HTMLElement).closest('input,select,button')) return;
      if (event.key === ' ' || event.key === 'k') { event.preventDefault(); togglePause(); reveal(); }
      if (event.key === 'ArrowLeft') { event.preventDefault(); seek(position.currentTime - 10); }
      if (event.key === 'ArrowRight') { event.preventDefault(); seek(position.currentTime + 10); }
      if (event.key === 'f') { event.preventDefault(); void fullscreen(); }
      if (event.key === 'm' && videoRef.current) videoRef.current.muted = !videoRef.current.muted;
    }}>
    <video ref={videoRef} autoPlay playsInline className={styles.video} aria-label={title} onClick={() => {
      if (pointerType.current === 'touch' || pointerType.current === 'pen') {
        if (pausedState) { togglePause(); reveal(); }
        else if (touchControlsVisible.current) setVisible(false);
        else reveal();
      } else { togglePause(); reveal(); }
    }} onDoubleClick={() => { if (pointerType.current === 'mouse') void fullscreen(); }} />
    {onExit && <button className={styles.exitButton} onClick={onExit} aria-label="Fermer le lecteur" tabIndex={controlsVisible ? 0 : -1}><PlayerIcon name="close" /></button>}
    <div className={styles.heading}><span className={styles.brand}>YAMON<span>FILM</span></span><span className={styles.title}>{title}</span></div>
    {autoplayMuted && !error && <button className={styles.soundPrompt} onClick={() => {
      const video = videoRef.current;
      if (!video) return;
      video.muted = false;
      setMuted(false); setAutoplayMuted(false);
      playbackIntent.current = true;
      void video.play().catch(() => callbacks.current.onState(true));
    }}><PlayerIcon name="volume" /> Activer le son</button>}
    {pausedState && !loading && !error && <button className={styles.centerPlay} onClick={togglePause} aria-label="Reprendre la lecture"><PlayerIcon name="play" /></button>}
    <div className={styles.controls} inert={!controlsVisible}
      onPointerDown={() => { interacting.current = true; }}
      onPointerUp={() => { interacting.current = false; reveal(); }}
      onPointerCancel={() => { interacting.current = false; reveal(); }}>
      <input className={styles.timeline} type="range" min="0" max={position.duration || 1} step="0.1" value={Math.min(position.currentTime, position.duration || 1)}
        style={{ background: `linear-gradient(to right,#ef4444 ${position.duration ? position.currentTime / position.duration * 100 : 0}%,#ffffff30 0)` }}
        aria-label="Position dans la vidéo" aria-valuetext={`${playerTime(position.currentTime)} sur ${playerTime(position.duration)}`} disabled={!position.duration}
        onChange={event => seek(Number(event.target.value))} />
      <div className={styles.row}>
        <button className={styles.primary} onClick={togglePause} aria-label={pausedState ? 'Lire' : 'Pause'} title={pausedState ? 'Lire (espace)' : 'Pause (espace)'}><PlayerIcon name={pausedState ? 'play' : 'pause'} /></button>
        <button onClick={() => seek(position.currentTime - 10)} aria-label="Reculer de 10 secondes" title="Reculer de 10 secondes"><PlayerIcon name="back" /></button>
        <button onClick={() => seek(position.currentTime + 10)} aria-label="Avancer de 10 secondes" title="Avancer de 10 secondes"><PlayerIcon name="forward" /></button>
        <span className={styles.time}>{playerTime(position.currentTime)} <span>/ {playerTime(position.duration)}</span></span>
        <div className={styles.sound}>
          <button onClick={() => { if (videoRef.current) videoRef.current.muted = !videoRef.current.muted; }} aria-label={muted || !volume ? 'Activer le son' : 'Couper le son'}><PlayerIcon name={muted || !volume ? 'muted' : 'volume'} /></button>
          <input type="range" aria-label="Volume" min="0" max="1" step="0.05" value={muted ? 0 : volume} onChange={event => { if (videoRef.current) { videoRef.current.volume = Number(event.target.value); videoRef.current.muted = false; } }} />
        </div>
        <span className={styles.spacer} />
        {pipSupported && <button className={styles.pipButton} onClick={() => void pictureInPicture()} aria-label={inPip ? 'Fermer le mini-lecteur' : 'Mini-lecteur'} title="Mini-lecteur"><PlayerIcon name="pip" /></button>}
        <button onClick={() => setSettingsOpen(value => !value)} aria-label="Réglages du lecteur" aria-expanded={settingsOpen}><PlayerIcon name="settings" /></button>
        <button onClick={() => void fullscreen()} aria-label={isFullscreen || expanded ? 'Quitter le plein écran' : 'Plein écran'} title={isFullscreen || expanded ? 'Réduire la vidéo (F)' : 'Plein écran (F)'}><PlayerIcon name={isFullscreen || expanded ? 'minimize' : 'fullscreen'} /></button>
      </div>
    </div>
    {settingsOpen && <div className={styles.settingsPanel} role="region" aria-label="Réglages du lecteur">
      <div className={styles.settingsHeader}><strong>Réglages</strong><button className={styles.panelClose} onClick={() => { setSettingsOpen(false); reveal(); }} aria-label="Fermer les réglages"><PlayerIcon name="close" /></button></div>
      <div className={styles.settingsFields}>
        {sourceOptions.length > 0 && <label>Source vidéo<select aria-label="Source vidéo" title="Changer de flux sans perdre la position" value={selectedSource} disabled={loading} onChange={event => {
          const video = videoRef.current;
          if (video && video.currentTime > 0) restoreTimeRef.current = video.currentTime;
          if (video) playbackIntent.current = !video.paused;
          manualSource.current = event.target.value;
          setSelectedSource(event.target.value); setError('');
          if (event.target.value) excludedEmbeds.current = excludedEmbeds.current.filter(embed => embed !== event.target.value);
          setRetry(value => value + 1); reveal();
        }}><option value="">Automatique</option>{sourceOptions.map((option, index) => <option key={option.embed} value={option.embed}>Source {index + 1} · {option.quality?.height ? `${option.quality.height}p` : 'qualité inconnue'} · {option.provider === 'Lien ajouté' ? option.provider : new URL(option.embed).hostname}</option>)}</select></label>}
        <label className={styles.audioLabel}>
          <span>Langue audio</span>
          <select className={styles.audioSelect} aria-label="Langue audio" title={audioTracks.length > 1 ? 'Changer la langue audio' : 'Cette vidéo ne propose pas plusieurs pistes audio'}
            value={audioTrack} disabled={audioTracks.length < 2} onChange={event => changeAudio(Number(event.target.value))}>
            {!audioTracks.length && <option value={-1}>Audio d’origine</option>}
            {audioTracks.map(track => <option key={track.id} value={track.id}>{audioTrackLabel(track)}</option>)}
          </select>
        </label>
        <label>Vitesse<select aria-label="Vitesse de lecture" value={speed} onChange={event => { if (videoRef.current) videoRef.current.playbackRate = Number(event.target.value); }}>
          {[0.5, 0.75, 1, 1.25, 1.5, 2].map(value => <option key={value} value={value}>{value}×</option>)}
        </select></label>
        <button className={styles.castButton} onClick={() => { setSettingsOpen(false); setCastInfo(true); }} aria-label="Diffuser sur une télévision"><PlayerIcon name="cast" /> Diffuser</button>
        {pipSupported && <button className={styles.castButton} onClick={() => { setSettingsOpen(false); void pictureInPicture(); }}><PlayerIcon name="pip" /> {inPip ? 'Fermer le mini-lecteur' : 'Mini-lecteur'}</button>}
      </div>
    </div>}
    {nextEpisodeIn != null && !loading && !error && <div role="status" className={styles.nextEpisode}>
      <span className={styles.nextBadge}><PlayerIcon name="play" /></span>
      <div className={styles.nextCopy}><span>LA SUITE DE TON HISTOIRE</span><strong>Lecture suivante dans {nextEpisodeIn} s</strong>{nextEpisodeSource === 'SkipDB' && <a href="https://skipdb.tv" target="_blank" rel="noreferrer">Minutage : SkipDB · ODbL</a>}</div>
      {pausedState && <p>En pause avec la vidéo</p>}
      <div><button onClick={onPlayNext}>Lancer la suite</button><button onClick={onCancelNext}>Regarder le générique</button></div>
      <span className={styles.nextTrack} aria-hidden="true"><span style={{ width: `${Math.max(0, Math.min(100, (5 - nextEpisodeIn) * 20))}%` }} /></span>
    </div>}
    {controlMessage && <p role="status" className={styles.message}>{controlMessage}</p>}
    {sourceMessage && !error && controlsVisible && !settingsOpen && <p role="status" className={styles.message}>{sourceMessage}</p>}
    {castInfo && <div className={styles.castPanel} role="dialog" aria-modal="false" aria-label="Diffuser sur une télévision">
      <button className={styles.panelClose} autoFocus onClick={() => setCastInfo(false)} aria-label="Fermer les informations de diffusion"><PlayerIcon name="close" /></button>
      <span className={styles.eyebrow}>SUR GRAND ÉCRAN</span><h3>Ta séance, sur ta télé.</h3>
      <p>Chromecast et AirPlay nécessitent de partager le lien vidéo temporaire avec la télévision sélectionnée.</p>
      <p>La diffusion reste à activer après ton accord. Place tes appareils sur le même réseau Wi-Fi.</p>
      <button className={styles.panelButton} onClick={() => setCastInfo(false)}>Revenir à la vidéo</button>
    </div>}
    {loading && <div role="status" className="pointer-events-none absolute inset-0 grid place-content-center bg-black/70 p-6 text-sm text-zinc-200">Préparation de la vidéo…</div>}
    {error && <div role="alert" className="absolute inset-0 grid place-content-center bg-black/90 p-6 text-center"><p className="max-w-md text-sm text-zinc-300">{error}</p><button onClick={() => { setError(''); automaticRetries.current = 0; excludedEmbeds.current = []; activeEmbed.current = ''; setRetry(value => value + 1); }} className="mx-auto mt-4 rounded-full bg-red-600 px-5 py-3 text-sm font-semibold">Réessayer</button></div>}
  </div>;
}
