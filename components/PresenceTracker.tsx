'use client';

import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { usePathname } from 'next/navigation';

export default function PresenceTracker() {
  const pathname = usePathname();

  useEffect(() => {
    async function updatePresence() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

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
    }

    updatePresence();
    const heartbeat = setInterval(updatePresence, 20000);
    return () => clearInterval(heartbeat);
  }, [pathname]);

  return null;
}