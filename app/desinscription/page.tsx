'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

// Confirmation step so that email scanners opening the link do not unsubscribe anyone.
export default function Desinscription() {
  const [params, setParams] = useState<{ email: string; token: string } | null>(null);
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');
  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Read the link parameters once in the browser.
    setParams({ email: search.get('e') ?? '', token: search.get('t') ?? '' });
  }, []);
  const confirm = async () => {
    if (!params) return;
    setState('sending'); setError('');
    const response = await fetch('/api/unsubscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(params) }).catch(() => null);
    const body = await response?.json().catch(() => ({}));
    if (response?.ok) setState('done');
    else { setState('error'); setError(body?.error || 'Désinscription impossible pour le moment. Réessaie.'); }
  };
  const valid = !!params?.email && !!params.token;
  return <main className="yf-page grid min-h-screen place-items-center bg-[#0a0a0b] px-4 text-white">
    <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#121214] p-8 text-center">
      <Link href="/" className="text-lg font-black tracking-tight text-red-500">YAMON<span className="text-white">FILM</span></Link>
      {state === 'done' ? <>
        <h1 className="mt-6 text-2xl font-bold">C’est fait.</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-400">Tu ne recevras plus nos emails d’offres et de nouveautés. Tu peux changer d’avis à tout moment depuis la page Mon abonnement.</p>
      </> : <>
        <h1 className="mt-6 text-2xl font-bold">Se désinscrire des emails</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-400">{valid ? <>L’adresse <strong className="text-white">{params.email}</strong> ne recevra plus nos offres et nouveautés. Les emails liés à ton compte (sécurité, paiement) continuent.</> : params ? 'Ce lien de désinscription est incomplet. Utilise le lien reçu dans l’email, ou écris-nous.' : 'Chargement…'}</p>
        {valid && <button type="button" onClick={() => void confirm()} disabled={state === 'sending'} className="mt-6 w-full rounded-full bg-red-600 py-3.5 text-sm font-bold hover:bg-red-500 disabled:opacity-50">{state === 'sending' ? 'Désinscription…' : 'Confirmer la désinscription'}</button>}
        {error && <p role="alert" className="mt-4 text-sm text-red-300">{error}</p>}
      </>}
    </div>
  </main>;
}
