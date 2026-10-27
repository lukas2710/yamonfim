'use client';

import { getPersistentSession } from '@/lib/auth-session';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

type IconName = 'crown' | 'check' | 'close' | 'home' | 'arrowRight' | 'request';

const ICONS: Record<IconName, React.ReactNode> = {
  crown: <path d="m3 7 4.5 4L12 4l4.5 7L21 7l-2 12H5L3 7Z" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  close: <path d="M18 6 6 18M6 6l12 12" />,
  home: <><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9v11h14V9" /></>,
  arrowRight: <path d="M5 12h14m-6-7 7 7-7 7" />,
  request: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></>,
};

function Icon({ name, className = 'w-4 h-4' }: { name: IconName; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}

export default function VipActivationPage() {
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');

  useEffect(() => {
    let active = true;

    async function activateVipDirectly() {
      try {
        const { data: { session }, error: authError } = await getPersistentSession();
        if (!active) return;
        if (authError || !session) {
          router.replace('/login');
          return;
        }

        // Activation immédiate du VIP dans la table profiles
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            is_vip: true,
            vip_started_at: new Date().toISOString(),
            vip_duration: '1y'
          })
          .eq('id', session.user.id);

        if (updateError) throw updateError;

        if (!active) return;
        setStatus('success');

        // Redirection automatique vers l'accueil après 2 secondes
        setTimeout(() => {
          if (active) router.push('/');
        }, 2000);
      } catch (err) {
        console.error('Erreur activation VIP :', err);
        if (active) setStatus('error');
      }
    }

    void activateVipDirectly();

    return () => {
      active = false;
    };
  }, [router]);

  return (
    <main className="yf-page yf-activation relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#0a0a0b] p-4 font-sans text-white antialiased">
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[140px] bg-amber-500/20" />

      <span className="relative mb-10 select-none text-xl font-black tracking-[0.2em] text-red-600">
        YAMON<span className="text-white">FILM</span>
      </span>

      <div className="yf-surface relative w-full max-w-sm overflow-hidden rounded-3xl border border-white/10 bg-[#111113]/90 p-8 text-center shadow-2xl backdrop-blur-xl">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-amber-500/15 to-transparent" />

        {status === 'loading' && (
          <div className="relative animate-[fadeUp_.4s_ease-out]">
            <div className="relative mx-auto mb-6 h-20 w-20">
              <div className="absolute inset-0 rounded-full border-4 border-white/5" />
              <div className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-amber-400" />
              <div className="absolute inset-0 flex items-center justify-center text-amber-400">
                <Icon name="crown" className="h-8 w-8" />
              </div>
            </div>
            <h1 className="text-xl font-bold tracking-tight">Activation du VIP…</h1>
            <p className="mt-2 text-sm text-zinc-400">Patiente un instant pendant que nous débloquons ton accès.</p>
          </div>
        )}

        {status === 'success' && (
          <div className="relative animate-[fadeUp_.5s_ease-out]">
            <div className="relative mx-auto mb-6 w-fit">
              <div className="absolute inset-0 animate-pulse rounded-3xl bg-amber-500/40 blur-2xl" />
              <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-amber-300 via-amber-500 to-amber-700 text-zinc-950 shadow-2xl">
                <Icon name="crown" className="h-10 w-10" />
              </div>
              <span className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-white ring-4 ring-[#111113]">
                <Icon name="check" className="h-4 w-4" />
              </span>
            </div>

            <p className="mb-2 text-xs font-bold uppercase tracking-[0.3em] text-amber-400">Statut VIP activé</p>
            <h1 className="text-2xl font-black tracking-tight">Félicitations !</h1>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">
              Ton compte est désormais <span className="font-semibold text-amber-300">VIP</span>. Profite du catalogue en illimité.
            </p>

            <div className="mt-7">
              <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-600 animate-[fill_2s_linear_forwards]" />
              </div>
              <p className="mt-2 text-xs text-zinc-500">Redirection vers l’accueil…</p>
            </div>

            <button
              onClick={() => router.push('/')}
              className="group mt-5 inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 py-3.5 text-sm font-bold text-zinc-950 shadow-lg shadow-amber-500/25 transition hover:from-amber-300 hover:to-amber-400 active:scale-[0.98]"
            >
              Commencer à regarder
              <Icon name="arrowRight" className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </button>
          </div>
        )}

        {status === 'error' && (
          <div className="relative animate-[fadeUp_.4s_ease-out]">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-600/10 text-red-500 ring-1 ring-red-500/30">
              <Icon name="close" className="h-7 w-7" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">Erreur d'activation</h1>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">
              Impossible d'activer ton statut VIP pour le moment. Réessaie plus tard.
            </p>

            <button
              onClick={() => router.push('/')}
              className="mt-7 inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-white/5 py-3 text-sm font-semibold text-zinc-300 ring-1 ring-white/10 transition hover:bg-white/10 hover:text-white"
            >
              <Icon name="home" /> Retour à l’accueil
            </button>
          </div>
        )}
      </div>

      <style jsx global>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fill {
          from { width: 0%; }
          to { width: 100%; }
        }
      `}</style>
    </main>
  );
}