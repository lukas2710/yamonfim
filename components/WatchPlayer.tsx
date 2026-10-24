'use client';

import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import type Hls from 'hls.js';
import { isDirectVideo, playbackProgress } from '@/lib/watch-progress';

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
  const restoreTimeRef = useRef(resumeAt);
  const callbacks = useRef({ onProgress, onState, onEnded });
  useEffect(() => { callbacks.current = { onProgress, onState, onEnded }; }, [onProgress, onState, onEnded]);
  const direct = isDirectVideo(src);
  useImperativeHandle(controlRef, () => ({ togglePause() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) void video.play().catch(() => setError('La lecture n’a pas pu reprendre. Utilise les commandes vidéo.'));
    else video.pause();
  } }), []);

  useEffect(() => {
    if (!direct || !videoRef.current) return;
    const video = videoRef.current;
    let hls: Hls | null = null;
    let disposed = false;
    let restored = false;
    const progress = () => {
      const value = playbackProgress(video.currentTime, video.duration);
      restoreTimeRef.current = value.currentTime;
      callbacks.current.onProgress(value.currentTime, value.duration);
    };
    const restore = () => {
      if (!restored) {
        restored = true;
        const target = restoreTimeRef.current;
        if (target > 0 && Number.isFinite(video.duration) && target < video.duration - 5) video.currentTime = target;
      }
      void video.play().catch(() => callbacks.current.onState(true));
    };
    const playing = () => callbacks.current.onState(false);
    const paused = () => { progress(); callbacks.current.onState(true); };
    const ended = () => { progress(); callbacks.current.onEnded(); };
    const failed = () => setError('Ce flux est indisponible. Tu peux réessayer ou signaler le problème.');
    video.addEventListener('loadedmetadata', restore);
    video.addEventListener('timeupdate', progress);
    video.addEventListener('seeked', progress);
    video.addEventListener('play', playing);
    video.addEventListener('pause', paused);
    video.addEventListener('ended', ended);
    video.addEventListener('error', failed);
    if (/\.m3u8(?:\?|$)/i.test(src) && !video.canPlayType('application/vnd.apple.mpegurl')) {
      void import('hls.js').then(({ default: Hls }) => {
        if (disposed) return;
        if (Hls.isSupported()) {
          hls = new Hls(); hls.loadSource(src); hls.attachMedia(video);
          hls.on(Hls.Events.ERROR, (_, data) => { if (data.fatal) failed(); });
        } else failed();
      }).catch(() => { if (!disposed) failed(); });
    } else video.src = src;
    return () => {
      disposed = true;
      video.removeEventListener('loadedmetadata', restore); video.removeEventListener('timeupdate', progress);
      video.removeEventListener('seeked', progress); video.removeEventListener('play', playing);
      video.removeEventListener('pause', paused); video.removeEventListener('ended', ended); video.removeEventListener('error', failed);
      hls?.destroy(); video.pause(); video.removeAttribute('src'); video.load();
    };
  }, [src, direct, resumeAt, retry]);

  if (!direct) return <iframe src={src} title={title} className="relative w-full h-full border-0" allow="fullscreen; accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowFullScreen referrerPolicy="origin" />;
  return <>
    <video ref={videoRef} controls autoPlay playsInline className="h-full w-full object-contain" aria-label={title} />
    {error && <div role="alert" className="absolute inset-0 grid place-content-center bg-black/90 p-6 text-center"><p className="max-w-md text-sm text-zinc-300">{error}</p><button onClick={() => { setError(''); setRetry(value => value + 1); }} className="mx-auto mt-4 rounded-full bg-red-600 px-5 py-3 text-sm font-semibold">Réessayer</button></div>}
  </>;
}
