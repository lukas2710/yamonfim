'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
// Ancillary pages may contain an unrestricted catalogue (live TV, history, requests).
export default function ProfileAccess({ children }: { children: ReactNode }) {
  const path = usePathname();
  const safe = path === '/' || path === '/profiles' || path.startsWith('/watch/') || path.startsWith('/login') || path.startsWith('/admin') || ['/confidentialite','/conditions','/mentions-legales'].includes(path);
  const [checked, setChecked] = useState('');
  const [blocked, setBlocked] = useState(false);
  useEffect(() => {
    if (safe) return;
    let alive = true;
    void (async () => {
      let active;
      try { active = JSON.parse(localStorage.getItem('active_profile') || '{}'); } catch { active = {}; }
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = user && active.id ? await supabase.from('user_profiles').select('profile_mode').eq('user_id', user.id).eq('id', active.id).single() : {data: null, error: null};
      if (alive) { setBlocked(!!error || (!!active.id && (!data || data.profile_mode !== 'standard'))); setChecked(path); }
    })().catch(() => { if (alive) { setBlocked(true); setChecked(path); } });
    return () => { alive = false; };
  }, [path, safe]);
  if (!safe && checked !== path) return <main className="p-10">Vérification du profil…</main>;
  if (!safe && blocked) return <main className="p-10"><h1 className="text-2xl">Cette page est réservée aux profils Standard.</h1><Link className="mt-5 block underline" href="/">Retour au catalogue enfants</Link><Link className="mt-5 block underline" href="/profiles">Changer de profil</Link></main>;
  return children;
}
