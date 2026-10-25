'use client';

import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import type Hls from 'hls.js';
import { isNativePlayback, isMoviezPlayer, playbackProgress } from '@/lib/watch-progress';
import { getPersistentSession } from '@/lib/auth-session';
import { playerTime, playerSeek, preferredAudioTrack, frenchFirstAudioTracks, audioTrackLabel, type PlayerAudioTrack } from '@/lib/player-controls';
import styles from './WatchPlayer.module.css';

interface NativeAudioTrack { id: string; label: string; language: string; enabled: boolean }
interface NativeAudioTracks extends EventTarget { length: number; [index: number]: NativeAudioTrack }
type AudioVideo = HTMLVideoElement & { audioTracks?: NativeAudioTracks };
const AUDIO_LANGUAGE_KEY = 'yamonfim_audio_language';

function PlayerIcon({ name }: { name: 'play' | 'pause' | 'back' | 'forward' | 'volume' | 'muted' | 'cast' | 'fullscreen' | 'close' }) {
  const paths = {
    play: <path d="m9 5 11 7-11 7Z" fill="currentColor" />,
    pause: <path d="M8 5v14M16 5v14" strokeWidth="4" />,
    back: <><path d="M4 10a8 8 0 1 1 1 8M4 4v6h6" /><text x="9" y="16" fontSize="8" fill="currentColor" stroke="none">10</text></>,
    forward: <><path d="M20 10a8 8 0 1 0-1 8M20 4v6h-6" /><text x="9" y="16" fontSize="8" fill="currentColor" stroke="none">10</text></>,
    volume: <path d="m11 5-6 5H2v4h3l6 5ZM15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" />,
    muted: <path d="m11 5-6 5H2v4h3l6 5ZM16 9l6 6m0-6-6 6" />,
    cast: <path d="M3 8V4h18v16h-9M3 20h.01M3 15a5 5 0 0 1 5 5M3 10a10 10 0 0 1 10 10" />,
    fullscreen: <path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5" />,
    close: <path d="m6 6 12 12M6 18 18 6" />,
  };
  return <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

export interface WatchPlayerControl { togglePause: () => void }
interface Props {
  src: string; title: string; resumeAt: number; controlRef: Ref<WatchPlayerControl>;
  onProgress: (time: number, duration: number) => void;
  onState: (paused: boolean) => void; onEnded: () => void;
}

export default function WatchPlayer({ src, title, resumeAt, controlRef, onProgress, onState, onEnded }: Props) {
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
  const [controlMessage, setControlMessage] = useState('');
  const [audioTracks, setAudioTracks] = useState<PlayerAudioTrack[]>([]);
  const [audioTrack, setAudioTrack] = useState(-1);
  const hlsRef = useRef<Hls | null>(null);
  const nativePlaylistRef = useRef('');
  const rootRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const automaticRetries = useRef(0);
  const restoreTimeRef = useRef(resumeAt);
  const callbacks = useRef({ onProgress, onState, onEnded });
  useEffect(() => { callbacks.current = { onProgress, onState, onEnded }; }, [onProgress, onState, onEnded]);
  const direct = isNativePlayback(src);
  const togglePause = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) void video.play().catch(() => setError('La lecture n’a pas pu reprendre. Utilise les commandes vidéo.'));
    else video.pause();
  };
  useImperativeHandle(controlRef, () => ({ togglePause }));
  const reveal = () => {
    setVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setVisible(false), 3500);
  };
  useEffect(() => () => { if (hideTimer.current) clearTimeout(hideTimer.current); }, []);
  const seek = (time: number) => {
    const video = videoRef.current;
    if (video && video.readyState > 0) video.currentTime = playerSeek(time, video.duration);
    reveal();
  };
  const fullscreen = () => {
    const target = rootRef.current?.closest('.watch-screen') || rootRef.current;
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    else void target?.requestFullscreen().catch(() => setControlMessage('Le plein écran est indisponible dans ce navigateur.'));
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
    const video = videoRef.current;
    const nativeAudio = (video as AudioVideo).audioTracks;
    let hls: Hls | null = null;
    let disposed = false;
    let restored = false;
    const languagePreference = () => { try { return localStorage.getItem(AUDIO_LANGUAGE_KEY) || 'fr'; } catch { return 'fr'; } };
    const updateNativeAudio = () => {
      if (!nativeAudio?.length || disposed || hls) return;
      const tracks: PlayerAudioTrack[] = Array.from({ length: nativeAudio.length }, (_, id) => ({ id, name: nativeAudio[id].label, lang: nativeAudio[id].language }));
      setAudioTracks(frenchFirstAudioTracks(tracks));
      const selected = tracks.find(track => nativeAudio[track.id].enabled)?.id ?? 0;
      setAudioTrack(tracks.length ? selected : -1);
    };
    const progress = () => {
      const value = playbackProgress(video.currentTime, video.duration);
      setPosition(value);
      restoreTimeRef.current = value.currentTime;
      callbacks.current.onProgress(value.currentTime, value.duration);
    };
    const restore = () => {
      if (!restored) {
        restored = true;
        const target = restoreTimeRef.current;
        if (target > 0 && Number.isFinite(video.duration) && target < video.duration - 5) video.currentTime = target;
        if (nativeAudio && !hls) {
          const tracks = Array.from({ length: nativeAudio.length }, (_, id) => ({ id, name: nativeAudio[id].label, lang: nativeAudio[id].language }));
          const preferred = preferredAudioTrack(tracks, languagePreference());
          if (preferred !== null) for (let index = 0; index < nativeAudio.length; index++) nativeAudio[index].enabled = index === preferred;
          updateNativeAudio();
        }
      }
      void video.play().catch(() => callbacks.current.onState(true));
    };
    const playing = () => { setPausedState(false); callbacks.current.onState(false); };
    const paused = () => { setPausedState(true); progress(); callbacks.current.onState(true); };
    const sound = () => { setVolume(video.volume); setMuted(video.muted); };
    const rate = () => setSpeed(video.playbackRate);
    const ended = () => { progress(); callbacks.current.onEnded(); };
    const failed = () => {
      if (disposed) return;
      if (isMoviezPlayer(src) && automaticRetries.current < 1) {
        automaticRetries.current++;
        setRetry(value => value + 1);
      } else { setLoading(false); setError('Ce flux est indisponible. Tu peux réessayer ou signaler le problème.'); }
    };
    video.addEventListener('loadedmetadata', restore);
    video.addEventListener('timeupdate', progress);
    video.addEventListener('seeked', progress);
    video.addEventListener('play', playing);
    video.addEventListener('pause', paused);
    video.addEventListener('ended', ended);
    video.addEventListener('error', failed);
    video.addEventListener('volumechange', sound);
    video.addEventListener('ratechange', rate);
    nativeAudio?.addEventListener('addtrack', updateNativeAudio);
    nativeAudio?.addEventListener('removetrack', updateNativeAudio);
    nativeAudio?.addEventListener('change', updateNativeAudio);
    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      let playable = src;
      let manifestAudio: PlayerAudioTrack[] = [];
      if (isMoviezPlayer(src)) {
        const { data: { session } } = await getPersistentSession();
        if (!session) throw new Error('Session expirée');
        const response = await fetch('/api/playback', {
          method: 'POST', signal: controller.signal,
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ url: src }),
        });
        const data = await response.json();
        if (!response.ok || typeof data.url !== 'string') throw new Error('Flux indisponible');
        playable = data.url;
        if (Array.isArray(data.audioTracks)) manifestAudio = data.audioTracks;
      }
      if (disposed) return;
      // Some Chromium/WebView browsers claim native HLS support but expose no
      // audioTracks API. Prefer HLS.js so alternate languages remain selectable.
      if (/\.m3u8(?:\?|$)/i.test(playable)) {
        const { default: Hls } = await import('hls.js');
        if (disposed) return;
        if (Hls.isSupported()) {
          hls = new Hls();
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
          hls.on(Hls.Events.ERROR, (_, data) => { if (data.fatal) failed(); });
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
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
        }
        else failed();
      } else video.src = playable;
      setLoading(false);
    };
    void load().catch(() => { if (!disposed) failed(); });
    return () => {
      disposed = true;
      controller.abort();
      video.removeEventListener('loadedmetadata', restore); video.removeEventListener('timeupdate', progress);
      video.removeEventListener('seeked', progress); video.removeEventListener('play', playing);
      video.removeEventListener('pause', paused); video.removeEventListener('ended', ended); video.removeEventListener('error', failed);
      video.removeEventListener('volumechange', sound); video.removeEventListener('ratechange', rate);
      nativeAudio?.removeEventListener('addtrack', updateNativeAudio);
      nativeAudio?.removeEventListener('removetrack', updateNativeAudio);
      nativeAudio?.removeEventListener('change', updateNativeAudio);
      hlsRef.current = null;
      nativePlaylistRef.current = '';
      hls?.destroy(); video.pause(); video.removeAttribute('src'); video.load();
    };
  }, [src, direct, resumeAt, retry]);

  if (!direct) return <iframe src={src} title={title} className="relative w-full h-full border-0" allow="fullscreen; accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowFullScreen referrerPolicy="origin" />;
  return <div ref={rootRef} className={styles.player} data-controls={visible || pausedState || castInfo ? 'visible' : 'hidden'} role="group" aria-label={`Lecteur de ${title}`} tabIndex={0}
    onPointerMove={reveal} onPointerDown={reveal} onFocus={reveal}
    onKeyDown={event => {
      if ((event.target as HTMLElement).closest('input,select,button')) return;
      if (event.key === ' ' || event.key === 'k') { event.preventDefault(); togglePause(); reveal(); }
      if (event.key === 'ArrowLeft') { event.preventDefault(); seek(position.currentTime - 10); }
      if (event.key === 'ArrowRight') { event.preventDefault(); seek(position.currentTime + 10); }
      if (event.key === 'f') fullscreen();
      if (event.key === 'm' && videoRef.current) videoRef.current.muted = !videoRef.current.muted;
    }}>
    <video ref={videoRef} autoPlay playsInline className={styles.video} aria-label={title} onClick={() => { togglePause(); reveal(); }} onDoubleClick={fullscreen} />
    <div className={styles.heading}><span className={styles.brand}>YAMON<span>FIM</span></span><span className={styles.title}>{title}</span></div>
    {pausedState && !loading && !error && <button className={styles.centerPlay} onClick={togglePause} aria-label="Reprendre la lecture"><PlayerIcon name="play" /></button>}
    <div className={styles.controls}>
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
        <label className={styles.audioLabel}>
          <span className={styles.srOnly}>Langue audio</span>
          <select className={styles.audioSelect} aria-label="Langue audio" title={audioTracks.length > 1 ? 'Changer la langue audio' : 'Cette vidéo ne propose pas plusieurs pistes audio'}
            value={audioTrack} disabled={audioTracks.length < 2} onChange={event => changeAudio(Number(event.target.value))}>
            {!audioTracks.length && <option value={-1}>Audio d’origine</option>}
            {audioTracks.map(track => <option key={track.id} value={track.id}>{audioTrackLabel(track)}</option>)}
          </select>
        </label>
        <select aria-label="Vitesse de lecture" value={speed} onChange={event => { if (videoRef.current) videoRef.current.playbackRate = Number(event.target.value); }}>
          {[0.5, 0.75, 1, 1.25, 1.5, 2].map(value => <option key={value} value={value}>{value}×</option>)}
        </select>
        <button onClick={() => setCastInfo(true)} aria-label="Diffuser sur une télévision" title="Diffuser sur une télévision"><PlayerIcon name="cast" /></button>
        <button onClick={fullscreen} aria-label="Plein écran" title="Plein écran (F)"><PlayerIcon name="fullscreen" /></button>
      </div>
    </div>
    {controlMessage && <p role="status" className={styles.message}>{controlMessage}</p>}
    {castInfo && <div className={styles.castPanel} role="dialog" aria-modal="false" aria-label="Diffuser sur une télévision">
      <button className={styles.panelClose} autoFocus onClick={() => setCastInfo(false)} aria-label="Fermer les informations de diffusion"><PlayerIcon name="close" /></button>
      <span className={styles.eyebrow}>SUR GRAND ÉCRAN</span><h3>Ta séance, sur ta télé.</h3>
      <p>Chromecast et AirPlay nécessitent de partager le lien vidéo temporaire avec la télévision sélectionnée.</p>
      <p>La diffusion reste à activer après ton accord. Place tes appareils sur le même réseau Wi-Fi.</p>
      <button className={styles.panelButton} onClick={() => setCastInfo(false)}>Revenir à la vidéo</button>
    </div>}
    {loading && <div role="status" className="pointer-events-none absolute inset-0 grid place-content-center bg-black/70 p-6 text-sm text-zinc-200">Préparation de la vidéo…</div>}
    {error && <div role="alert" className="absolute inset-0 grid place-content-center bg-black/90 p-6 text-center"><p className="max-w-md text-sm text-zinc-300">{error}</p><button onClick={() => { setError(''); automaticRetries.current = 0; setRetry(value => value + 1); }} className="mx-auto mt-4 rounded-full bg-red-600 px-5 py-3 text-sm font-semibold">Réessayer</button></div>}
  </div>;
}
