'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function VipActivationPage() {
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');

  useEffect(() => {
    async function activateVip() {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        router.push('/login');
        return;
      }

      const user = session.user;

      // 1. Mise à jour de la table profiles
      const { error: dbError } = await supabase
        .from('profiles')
        .update({ is_vip: true })
        .eq('id', user.id);

      // 2. Mise à jour des métadonnées auth Supabase
      const { error: authError } = await supabase.auth.updateUser({
        data: { is_vip: true }
      });

      if (dbError && authError) {
        setStatus('error');
      } else {
        setStatus('success');
        setTimeout(() => {
          router.push('/');
        }, 2000);
      }
    }

    activateVip();
  }, [router]);

  return (
    <main className="min-h-screen bg-[#141414] text-white flex flex-col items-center justify-center p-4 font-sans">
      <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl">
        {status === 'loading' && (
          <>
            <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <h2 className="text-base font-bold text-white mb-1">Activation du statut VIP...</h2>
            <p className="text-xs text-slate-400">Veuillez patienter un instant.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto mb-4 text-2xl shadow-lg shadow-amber-500/10">
              👑
            </div>
            <h2 className="text-lg font-black text-white mb-2">Félicitations !</h2>
            <p className="text-xs text-slate-300 mb-4">
              Votre compte est désormais <strong className="text-amber-400">VIP</strong>. Redirection vers l'accueil...
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 flex items-center justify-center mx-auto mb-4 text-xl">
              ✕
            </div>
            <h2 className="text-base font-bold text-white mb-2">Erreur d'activation</h2>
            <p className="text-xs text-slate-400 mb-6">
              Impossible d'activer le VIP. Vérifiez que la table profiles possède les bons droits.
            </p>
            <button
              onClick={() => router.push('/')}
              className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-2.5 rounded-xl text-xs transition cursor-pointer"
            >
              Retour à l'accueil
            </button>
          </>
        )}
      </div>
    </main>
  );
}