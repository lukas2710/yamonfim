'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { getPersistentSession } from '@/lib/auth-session';
import { fetchUserLists, LIST_LABELS, setUserList, type UserList } from '@/lib/user-lists';

const LISTS: UserList[] = ['favorite', 'later'];

// Lists never affect access: the free viewing limit still applies when playing.
export default function UserListButtons({ mediaId }: { mediaId: string }) {
  const [owner, setOwner] = useState<{ user: string; profile: string } | null>(null);
  const [active, setActive] = useState<Set<UserList>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { data: { session } } = await getPersistentSession();
        const profile = JSON.parse(localStorage.getItem('active_profile') || 'null')?.id;
        if (!session || !profile) return;
        const { entries, available } = await fetchUserLists(supabase, session.user.id, String(profile));
        if (cancelled || !available) return;
        setActive(new Set(entries.filter(entry => entry.media_id === mediaId).map(entry => entry.list)));
        setOwner({ user: session.user.id, profile: String(profile) });
      } catch { /* The lists are optional on this page. */ }
    })();
    return () => { cancelled = true; };
  }, [mediaId]);

  if (!owner) return null;
  const toggle = async (list: UserList) => {
    const present = !active.has(list);
    setBusy(true); setError('');
    try {
      await setUserList(supabase, owner.user, owner.profile, mediaId, list, present);
      setActive(current => { const next = new Set(current); if (present) next.add(list); else next.delete(list); return next; });
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Réessaie.'); }
    finally { setBusy(false); }
  };
  return <div className="mx-auto mt-4 flex max-w-7xl flex-wrap items-center gap-2 px-4 sm:px-8">
    {LISTS.map(list => {
      const on = active.has(list);
      return <button key={list} type="button" disabled={busy} aria-pressed={on} onClick={() => void toggle(list)} className={`inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ring-1 transition disabled:opacity-60 ${on ? 'bg-red-600 text-white ring-red-500' : 'bg-white/5 text-zinc-200 ring-white/10 hover:bg-white/10'}`}>
        <span aria-hidden="true">{list === 'favorite' ? (on ? '♥' : '♡') : (on ? '✓' : '+')}</span>
        {on ? LIST_LABELS[list].added : LIST_LABELS[list].add}
      </button>;
    })}
    {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
  </div>;
}
