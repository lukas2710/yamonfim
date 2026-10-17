'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

/* ------------------------------------------------------------------ */
/* Types & thèmes (partagés avec la page admin)                        */
/* ------------------------------------------------------------------ */

export interface Promotion {
  id: string;
  title: string;
  subtitle?: string | null;
  badge?: string | null;
  image_url?: string | null;
  button_label?: string | null;
  link_url?: string | null;
  theme: string;
  audience: 'all' | 'free' | 'vip';
  starts_at?: string | null;
  ends_at?: string | null;
  active: boolean;
  priority: number;
  created_at?: string;
}

export const PROMO_THEMES: Record<string, { label: string; glow: string; badge: string; button: string; ring: string; dot: string }> = {
  red:     { label: 'Rouge',  glow: 'from-red-600/40',     badge: 'bg-red-600 text-white',             button: 'bg-red-600 hover:bg-red-500 text-white',              ring: 'ring-red-500/30',     dot: 'bg-red-600' },
  amber:   { label: 'Or',     glow: 'from-amber-500/40',   badge: 'bg-gradient-to-r from-amber-400 to-amber-500 text-zinc-950', button: 'bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-zinc-950', ring: 'ring-amber-500/30', dot: 'bg-amber-500' },
  violet:  { label: 'Violet', glow: 'from-violet-600/40',  badge: 'bg-violet-600 text-white',          button: 'bg-violet-600 hover:bg-violet-500 text-white',        ring: 'ring-violet-500/30',  dot: 'bg-violet-600' },
  emerald: { label: 'Vert',   glow: 'from-emerald-500/40', badge: 'bg-emerald-500 text-zinc-950',      button: 'bg-emerald-500 hover:bg-emerald-400 text-zinc-950',   ring: 'ring-emerald-500/30', dot: 'bg-emerald-500' },
  blue:    { label: 'Bleu',   glow: 'from-sky-500/40',     badge: 'bg-sky-500 text-zinc-950',          button: 'bg-sky-500 hover:bg-sky-400 text-zinc-950',           ring: 'ring-sky-500/30',     dot: 'bg-sky-500' },
};

const DISMISS_KEY = 'yf_dismissed_promos';

/* ------------------------------------------------------------------ */
/* Compte à rebours                                                    */
/* ------------------------------------------------------------------ */

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

export function Countdown({ endsAt }: { endsAt: string }) {
  const now = useNow();
  const diff = Math.max(0, new Date(endsAt).getTime() - now);
  if (!Number.isFinite(diff) || diff <= 0) return null;
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  const parts = d > 0 ? [[d, 'j'], [h, 'h'], [m, 'min']] : [[h, 'h'], [m, 'min'], [s, 's']];
  return (
    <div className="flex items-center gap-1.5" aria-label="Temps restant">
      <span className="mr-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-300">Fin dans</span>
      {parts.map(([v, u]) => (
        <span key={u as string} className="rounded-lg bg-black/40 px-2 py-1 text-xs font-bold tabular-nums ring-1 ring-white/10 backdrop-blur">
          {String(v).padStart(2, '0')}<span className="ml-0.5 font-medium text-zinc-400">{u}</span>
        </span>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Carte d'une promotion (utilisée aussi pour l'aperçu admin)           */
/* ------------------------------------------------------------------ */

export function PromoCard({
  promo, onClick, onDismiss,
}: { promo: Promotion; onClick?: () => void; onDismiss?: () => void }) {
  const theme = PROMO_THEMES[promo.theme] || PROMO_THEMES.red;
  return (
    <div className={`relative overflow-hidden rounded-3xl bg-[#111113] ring-1 ${theme.ring}`}>
      {promo.image_url && (
        <img src={promo.image_url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-50" />
      )}
      <div className={`absolute inset-0 bg-gradient-to-br ${theme.glow} via-transparent to-transparent`} />
      <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0b] via-[#0a0a0b]/75 to-[#0a0a0b]/10" />

      {onDismiss && (
        <button
          onClick={e => { e.stopPropagation(); onDismiss(); }}
          aria-label="Masquer cette promotion"
          className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-zinc-300 ring-1 ring-white/10 backdrop-blur transition hover:bg-black/60 hover:text-white"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-3.5 w-3.5"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
      )}

      <div className="relative flex min-h-[190px] flex-col justify-center gap-3 p-6 sm:min-h-[220px] sm:p-10">
        {promo.badge && (
          <span className={`w-fit rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wider shadow-lg ${theme.badge}`}>
            {promo.badge}
          </span>
        )}
        <h3 className="max-w-xl text-2xl font-black leading-tight tracking-tight sm:text-4xl">{promo.title || 'Titre de la promotion'}</h3>
        {promo.subtitle && <p className="max-w-lg text-sm leading-relaxed text-zinc-300 sm:text-base">{promo.subtitle}</p>}
        <div className="mt-1 flex flex-wrap items-center gap-3">
          {(promo.button_label || promo.link_url) && (
            <button
              onClick={onClick}
              className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold shadow-lg transition active:scale-[0.98] ${theme.button}`}
            >
              {promo.button_label || 'En profiter'}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M5 12h14m-6-7 7 7-7 7" /></svg>
            </button>
          )}
          {promo.ends_at && <Countdown endsAt={promo.ends_at} />}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Bloc de l'accueil : <PromoBanner isVip={isVip} />                    */
/* ------------------------------------------------------------------ */

export default function PromoBanner({ isVip, isAdmin = false }: { isVip: boolean; isAdmin?: boolean }) {
  const router = useRouter();
  const [promos, setPromos] = useState<Promotion[]>([]);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    // La croix ne masque la promo que le temps de la visite :
    // elle réapparaît à chaque retour sur l'accueil. On efface l'ancien masquage permanent.
    try { localStorage.removeItem(DISMISS_KEY); } catch { /* stockage indisponible */ }

    supabase
      .from('promotions')
      .select('*')
      .eq('active', true)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          console.error('Erreur promotions :', error);
          setLoadError(error.message);
        }
        setPromos((data as Promotion[]) || []);
        setLoaded(true);
      });
  }, []);

  const visible = useMemo(() => {
    const now = Date.now();
    return promos.filter(p => {
      if (dismissed.includes(p.id)) return false;
      if (p.audience === 'vip' && !isVip) return false;
      if (p.audience === 'free' && isVip) return false;
      if (p.starts_at && new Date(p.starts_at).getTime() > now) return false;
      if (p.ends_at && new Date(p.ends_at).getTime() <= now) return false;
      return true;
    });
  }, [promos, dismissed, isVip]);

  useEffect(() => {
    if (index >= visible.length) setIndex(0);
  }, [visible.length, index]);

  // Défilement automatique toutes les 7 s
  useEffect(() => {
    if (visible.length <= 1 || paused) return;
    const t = setInterval(() => setIndex(i => (i + 1) % visible.length), 7000);
    return () => clearInterval(t);
  }, [visible.length, paused]);

  if (visible.length === 0) {
    // Les visiteurs ne voient rien ; l'admin voit pourquoi aucune promo ne s'affiche
    if (!isAdmin || !loaded) return null;
    const now = Date.now();
    let reason = 'Aucune promotion active. Crée-en une depuis /admin/promotions.';
    if (loadError) {
      reason = /does not exist|relation/i.test(loadError)
        ? 'La table "promotions" n\'existe pas : lance le script supabase-promotions.sql dans Supabase.'
        : `Erreur Supabase : ${loadError}`;
    } else if (promos.length > 0) {
      const p = promos[0];
      if (dismissed.includes(p.id)) reason = 'Tu as masqué cette promotion avec la croix (elle reviendra à la prochaine visite).';
      else if (p.audience === 'free' && isVip) reason = 'La promo est réservée aux non-VIP, et ton compte est VIP.';
      else if (p.audience === 'vip' && !isVip) reason = 'La promo est réservée aux VIP.';
      else if (p.starts_at && new Date(p.starts_at).getTime() > now) reason = 'La promo est programmée : sa date de début n\'est pas encore arrivée.';
      else if (p.ends_at && new Date(p.ends_at).getTime() <= now) reason = 'La promo est terminée : sa date de fin est passée.';
    }
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-amber-500/40 bg-amber-500/5 px-4 py-3 text-sm text-amber-100">
        <span><span className="font-semibold">Promotions (visible par toi seulement) :</span> {reason}</span>
        <div className="flex gap-2">
          {dismissed.length > 0 && (
            <button
              onClick={() => setDismissed([])}
              className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/15"
            >
              Réafficher les promos masquées
            </button>
          )}
          <button onClick={() => router.push('/admin/promotions')} className="rounded-full bg-amber-500 px-3 py-1.5 text-xs font-bold text-zinc-950 hover:bg-amber-400">
            Gérer
          </button>
        </div>
      </div>
    );
  }
  const promo = visible[Math.min(index, visible.length - 1)];

  const open = (p: Promotion) => {
    const url = p.link_url || '/abonnement';
    if (/^https?:\/\//.test(url)) window.open(url, '_blank', 'noopener,noreferrer');
    else router.push(url);
  };

  // Masque la promo seulement jusqu'au prochain retour sur la page (rien n'est mémorisé)
  const dismiss = (id: string) => {
    setDismissed(prev => [...prev, id]);
  };

  return (
    <section
      aria-label="Promotions"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div key={promo.id} className="animate-[promoIn_.45s_ease-out]">
        <PromoCard promo={promo} onClick={() => open(promo)} onDismiss={() => dismiss(promo.id)} />
      </div>

      {visible.length > 1 && (
        <div className="mt-3 flex items-center justify-center gap-1.5">
          {visible.map((p, i) => (
            <button
              key={p.id}
              onClick={() => setIndex(i)}
              aria-label={`Promotion ${i + 1}`}
              className={`h-1.5 rounded-full transition-all ${i === index ? 'w-7 bg-white' : 'w-2.5 bg-white/25 hover:bg-white/50'}`}
            />
          ))}
        </div>
      )}

      <style jsx global>{`
        @keyframes promoIn {
          from { opacity: 0; transform: translateY(8px) scale(0.99); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </section>
  );
}
