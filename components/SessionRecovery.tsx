'use client';

import { useEffect } from 'react';
import { getPersistentSession } from '@/lib/auth-session';

export default function SessionRecovery() {
  useEffect(() => {
    const resume = () => {
      if (document.visibilityState === 'visible' && navigator.onLine !== false) {
        void getPersistentSession().catch(() => { /* A network outage is not a sign-out. */ });
      }
    };
    window.addEventListener('online', resume);
    window.addEventListener('pageshow', resume);
    document.addEventListener('visibilitychange', resume);
    return () => {
      window.removeEventListener('online', resume);
      window.removeEventListener('pageshow', resume);
      document.removeEventListener('visibilitychange', resume);
    };
  }, []);
  return null;
}
