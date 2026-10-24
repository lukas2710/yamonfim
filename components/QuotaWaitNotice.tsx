'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { fetchSubscriptionProfile } from '@/lib/subscription';
import { nextSundayReset } from '@/app/abonnement/plans';

export default function QuotaWaitNotice() {
  const [now, setNow] = useState<number | null>(null);
  const [status, setStatus] = useState<{ resetAt: number; verified: boolean; available: boolean; vip: boolean } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false, deadline: number | null = null, checkedDeadline = false;
    async function load() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('Session indisponible');
        const { data, error, resetVerified } = await fetchSubscriptionProfile(session.user.id);
        if (error || !data) throw new Error('Statut indisponible');
        const time = Date.now();
        const stored = data.watch_reset_at ? Date.parse(data.watch_reset_at) : NaN;
        const verified = resetVerified && Number.isFinite(stored);
        const resetAt = verified ? stored : nextSundayReset(time);
        deadline = resetAt;
        if (!cancelled) {
          setNow(time);
          setStatus({ resetAt, verified, available: data.watch_count < 5, vip: data.is_vip === true });
          setFailed(false);
        }
      } catch {
        if (!cancelled) setFailed(true);
      }
    }
    void load();
    const interval = window.setInterval(() => {
      const time = Date.now();
      setNow(time);
      if (deadline !== null && time >= deadline && !checkedDeadline) {
        checkedDeadline = true;
        void load();
      }
    }, 1000);
    return () => { cancelled = true; window.clearInterval(interval); };
  }, []);

  const seconds = status && now !== null ? Math.max(0, Math.ceil((status.resetAt - now) / 1000)) : null;
  const values = seconds === null ? [] : [Math.floor(seconds / 86400), Math.floor(seconds / 3600) % 24, Math.floor(seconds / 60) % 60, seconds % 60];
  const available = status?.available || status?.vip;

  return <div className="my-5 rounded-2xl border border-white/10 bg-white/[.03] p-4 text-center">
    <p className="text-sm font-semibold text-white">{available ? (status?.vip ? 'Ton accès VIP est actif.' : 'Tes visions gratuites sont de nouveau disponibles.') : !status || failed ? 'Ton prochain accès gratuit' : status.verified ? 'Tu pourras regarder à nouveau dans' : 'Prochaine remise à zéro prévue dans'}</p>
    {failed ? <p className="mt-3 text-sm text-zinc-400">Le délai est momentanément indisponible. Actualise ton accès pour le vérifier.</p> : !status ? <p className="mt-3 text-sm text-zinc-400">Vérification de ton prochain accès…</p> : !available && seconds !== null && seconds > 0 ? <>
      <div className="mt-4 grid grid-cols-4 gap-2" role="timer" aria-label="Temps restant avant la remise à zéro du quota">
        {values.map((value, index) => <div key={index} className="min-w-0 rounded-xl bg-black/25 px-1 py-3"><strong className="block text-xl font-bold tabular-nums text-amber-400 sm:text-2xl">{String(value).padStart(2, '0')}</strong><span className="mt-1 block text-[10px] text-zinc-400">{['Jours', 'Heures', 'Minutes', 'Secondes'][index]}</span></div>)}
      </div>
      <p className="mt-3 text-xs leading-5 text-zinc-500">{status.verified ? 'Remise à zéro' : 'Remise à zéro prévue'} le {new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(status.resetAt)} (heure de Paris).</p>
    </> : !available ? <p className="mt-3 text-sm text-zinc-400">L’échéance est atteinte. Actualise ton accès pour vérifier tes visions disponibles.</p> : null}
    {(available || failed || seconds === 0) && <button onClick={() => window.location.reload()} className="mt-3 min-h-11 rounded-full border border-white/15 px-5 text-sm font-semibold text-white hover:bg-white/10">Actualiser mon accès</button>}
  </div>;
}
