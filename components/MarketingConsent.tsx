'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Consent = boolean | null;

// Consent is stored in the member's own Auth metadata (see lib/marketing.ts).
function useMarketingConsent() {
  const [consent, setConsent] = useState<Consent | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!active || !data.user) return;
      const value = data.user.user_metadata?.marketing_consent;
      setConsent(value === true || value === false ? value : null);
    }).catch(() => {});
    return () => { active = false; };
  }, []);
  const save = async (value: boolean) => {
    setSaving(true); setError('');
    const { error: updateError } = await supabase.auth.updateUser({ data: { marketing_consent: value, marketing_consent_at: new Date().toISOString() } });
    if (updateError) setError('Ton choix n’a pas pu être enregistré. Réessaie.');
    else setConsent(value);
    setSaving(false);
  };
  return { consent, save, saving, error };
}

// Invitation shown once to members who were never asked.
export function MarketingConsentBanner() {
  const { consent, save, saving, error } = useMarketingConsent();
  const [thanks, setThanks] = useState(false);
  if (thanks) return <p role="status" className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">C’est noté ! Tu recevras les nouvelles saisons et les offres par email.</p>;
  if (consent !== null) return null;
  return <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-gradient-to-r from-red-950/40 to-[#121214] p-5">
    <div className="min-w-0"><p className="text-sm font-bold text-white">Ne rate plus aucune nouvelle saison</p><p className="mt-1 text-xs text-zinc-400">Reçois par email les nouveautés et les offres VIP. Désinscription en un clic.</p>{error && <p className="mt-1 text-xs text-red-300">{error}</p>}</div>
    <div className="flex gap-2"><button type="button" disabled={saving} onClick={async () => { await save(true); setThanks(true); }} className="rounded-full bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-500 disabled:opacity-50">Oui, je m’abonne</button><button type="button" disabled={saving} onClick={() => void save(false)} className="rounded-full border border-white/15 px-4 py-2 text-xs font-semibold text-zinc-300 hover:text-white disabled:opacity-50">Non merci</button></div>
  </div>;
}

export function MarketingConsentToggle() {
  const { consent, save, saving, error } = useMarketingConsent();
  if (consent === undefined) return null;
  return <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginTop: 18, fontSize: 11, lineHeight: 1.6, color: '#a1a1aa', cursor: 'pointer' }}>
    <input type="checkbox" checked={consent === true} disabled={saving} onChange={e => void save(e.target.checked)} style={{ marginTop: 3, accentColor: '#dc2626' }} />
    <span>Recevoir par email les nouveautés et offres de YAMONFIM.{error && <span style={{ display: 'block', color: '#fca5a5' }}>{error}</span>}</span>
  </label>;
}
