'use client';
import { useEffect, useRef } from 'react';
import { scheduleSeen } from '@/lib/delayed-seen';

export default function useDelayedSeen(enabled: boolean, playbackKey: string, onSeen: () => void) {
  const callback = useRef(onSeen);
  useEffect(() => { callback.current = onSeen; }, [onSeen]);
  useEffect(() => {
    if (!enabled) return;
    return scheduleSeen(() => callback.current());
  }, [enabled, playbackKey]);
}
