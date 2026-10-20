'use client';

import { useEffect, useRef } from 'react';
import { createEpisodeClock, elapsedEpisodeTime, pauseEpisodeClock, resumeEpisodeClock, type EpisodeClock } from '@/lib/episode-clock';

interface Options {
  enabled: boolean; episodeKey: string; durationSeconds: number; paused: boolean;
  getElapsed: () => number; onProgress: (elapsed: number) => void; onEnd: () => Promise<void>;
}
export default function useEstimatedEpisodeClock({ enabled, episodeKey, durationSeconds, paused, getElapsed, onProgress, onEnd }: Options) {
  const callbacks = useRef({ getElapsed, onProgress, onEnd });
  const state = useRef<{ key: string; clock: EpisodeClock; fired: boolean } | null>(null);
  useEffect(() => { callbacks.current = { getElapsed, onProgress, onEnd }; }, [getElapsed, onProgress, onEnd]);
  useEffect(() => {
    if (!enabled) { state.current = null; return; }
    const now = Date.now();
    if (!state.current || state.current.key !== episodeKey) {
      state.current = { key: episodeKey, clock: createEpisodeClock(durationSeconds, now, callbacks.current.getElapsed()), fired: false };
    }
    const current = state.current;
    current.clock = paused ? pauseEpisodeClock(current.clock, now) : resumeEpisodeClock(current.clock, now);
    if (paused) {
      callbacks.current.onProgress(elapsedEpisodeTime(current.clock, now) / 1000);
      return;
    }
    const tick = () => {
      if (current.fired || state.current !== current) return;
      const elapsed = elapsedEpisodeTime(current.clock, Date.now());
      callbacks.current.onProgress(elapsed / 1000);
      if (elapsed >= current.clock.durationMs) {
        current.fired = true;
        void callbacks.current.onEnd();
      }
    };
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [enabled, episodeKey, durationSeconds, paused]);
}
