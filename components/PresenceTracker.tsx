'use client';

import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { usePathname } from 'next/navigation';

export default function PresenceTracker() {
  const pathname = usePathname();

  useEffect(() => {
    let disposed = false;
    let inFlight = false;
    let recordedKey = '';
    let warned = false;
    const parisDay = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit',
    });
    async function updatePresence() {
      if (disposed || inFlight || document.visibilityState !== 'visible') return;
      inFlight = true;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session || disposed) return;

        // Détecte si l'utilisateur regarde un média (ex: /watch/123)
        let currentAction = 'Navigate sur le site';
        let currentMediaId = null;

        if (pathname.startsWith('/watch/')) {
          currentAction = 'Regarde un média';
          currentMediaId = pathname.split('/')[2];
        } else if (pathname.startsWith('/admin')) {
          currentAction = 'Dans l\'administration';
        } else if (pathname === '/abonnement') {
          currentAction = 'Consulte les abonnements';
        }

        await supabase.from('user_presence').upsert({
          user_id: session.user.id,
          email: session.user.email,
          current_action: currentAction,
          current_media_id: currentMediaId,
          last_seen: new Date().toISOString(),
        });

        // One durable account/day record, independent of the short-lived presence.
        // PostgreSQL chooses the authoritative date and deduplicates tabs/devices.
        const key = `${session.user.id}:${parisDay.format(new Date())}`;
        if (key !== recordedKey && !disposed) {
          const { error } = await supabase.rpc('record_daily_presence');
          if (!error) recordedKey = key;
          else if (!warned) {
            warned = true;
            console.warn('Suivi quotidien indisponible : installer la migration daily_activity.', error.message);
          }
        }
      } finally {
        inFlight = false;
      }
    }

    const refresh = () => { void updatePresence().catch(error => console.warn('Présence indisponible', error)); };
    refresh();
    const heartbeat = setInterval(refresh, 20000);
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      // Run outside the auth callback to avoid waiting on the auth lock.
      setTimeout(() => { if (!disposed) refresh(); }, 0);
    });
    document.addEventListener('visibilitychange', refresh);
    return () => {
      disposed = true;
      clearInterval(heartbeat);
      subscription.unsubscribe();
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [pathname]);

  return null;
}
