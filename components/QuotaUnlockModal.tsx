'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { fetchSubscriptionProfile } from '@/lib/subscription';
import { readClientResource } from '@/lib/resource-cache';
import { PLANS, formatEuro, perWeek, nextSundayReset } from '@/app/abonnement/plans';
import styles from './QuotaUnlock.module.css';

const FREE_LIMIT = 5;
const cheapestWeek = Math.min(...PLANS.map(perWeek));

export function LockIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path className={styles.shackle} d="M10 14V10a6 6 0 0 1 12 0v4" />
    <g className={styles.lockBody}><rect x="6" y="14" width="20" height="14" rx="4" fill="currentColor" stroke="none" /><circle cx="16" cy="20.5" r="2" fill="#fbbf24" stroke="none" /></g>
  </svg>;
}
function Crown() { return <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m3 7 4.5 4L12 4l4.5 7L21 7l-2 12H5L3 7Z" /></svg>; }
function Check() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>; }

// Gold chip shown on every locked poster, plus an unlock call to action on hover.
export function LockedPosterOverlay() {
  return <>
    <span className={styles.chip}><Crown />VIP</span>
    <span className={styles.unlock}><span className={styles.unlockButton}><Crown />Débloquer</span></span>
  </>;
}

export function QuotaBanner() {
  return <div className={styles.banner} role="status">
    <div className={styles.bannerText}><span className={styles.bannerIcon}><LockIcon /></span><div><strong>Tes {FREE_LIMIT} visions gratuites sont utilisées</strong><span>Débloque tout le catalogue tout de suite, dès {formatEuro(cheapestWeek)} par semaine.</span></div></div>
    <Link href="/abonnement#formules" className={styles.bannerCta}><Crown />Tout débloquer</Link>
  </div>;
}

function useResetCountdown() {
  const [resetAt, setResetAt] = useState<number | null>(null);
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const time = Date.now();
      let target = nextSundayReset(time);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const { data, resetVerified } = await fetchSubscriptionProfile(session.user.id);
          const stored = data?.watch_reset_at ? Date.parse(data.watch_reset_at) : NaN;
          if (resetVerified && Number.isFinite(stored)) target = stored;
        }
      } catch { /* The scheduled Sunday reset remains a useful estimate. */ }
      if (!cancelled) { setResetAt(target); setNow(Date.now()); }
    })();
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, []);
  if (resetAt === null || now === null) return null;
  const seconds = Math.max(0, Math.floor((resetAt - now) / 1000));
  const d = Math.floor(seconds / 86400), h = Math.floor(seconds / 3600) % 24, m = Math.floor(seconds / 60) % 60;
  return d ? `${d} j ${h} h` : h ? `${h} h ${m} min` : `${m} min`;
}

export default function QuotaUnlockModal({ onClose }: { onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [posters, setPosters] = useState<string[]>([]);
  const wait = useResetCountdown();
  useEffect(() => {
    let active = true;
    readClientResource<{ poster?: string }[]>('quota:posters', async () => { const { data } = await supabase.from('media').select('poster').not('poster', 'is', null).limit(12); return data ?? []; }, 10 * 60_000)
      .then(rows => { if (active) setPosters(rows.map(r => r.poster).filter((p): p is string => !!p).slice(0, 3)); })
      .catch(() => {});
    return () => { active = false; };
  }, []);
  useEffect(() => {
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab') return;
      const controls = closeRef.current?.closest('[role="dialog"]')?.querySelectorAll<HTMLElement>('button, a[href]');
      if (!controls?.length) return;
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', keydown);
    return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', keydown); if (previous instanceof HTMLElement) previous.focus(); };
  }, [onClose]);

  return <div className={styles.backdrop} onClick={onClose}>
    <section role="dialog" aria-modal="true" aria-labelledby="quota-unlock-title" aria-describedby="quota-unlock-text" className={styles.dialog} onClick={event => event.stopPropagation()}>
      <button ref={closeRef} onClick={onClose} aria-label="Fermer" className={styles.close}>×</button>
      {posters.length === 3 ? <div className={styles.posters} aria-hidden="true">{posters.map(src => <img key={src} src={src} alt="" />)}</div> : <div style={{ height: 30 }} />}
      <div className={styles.body}>
        <div className={styles.lock}><LockIcon /></div>
        <p className={styles.kicker}>PAUSE DANS TA SÉANCE</p>
        <h2 id="quota-unlock-title" className={styles.title}>Ne t’arrête pas maintenant.</h2>
        <p id="quota-unlock-text" className={styles.text}>Tu as utilisé tes <strong>{FREE_LIMIT} visions gratuites</strong> de la semaine. Passe VIP et continue tout de suite, sans attendre.</p>
        <div className={styles.meter} aria-hidden="true">{Array.from({ length: FREE_LIMIT }, (_, i) => <span key={i} />)}</div>
        <ul className={styles.perks}>{['Films et épisodes en illimité', 'Accès immédiat, plus d’attente le dimanche', 'Téléphone, ordinateur et TV'].map(text => <li key={text}><Check />{text}</li>)}</ul>
        <Link href="/abonnement#formules" className={styles.cta}><Crown />Débloquer maintenant</Link>
        <p className={styles.price}>Dès <strong>{formatEuro(cheapestWeek)} par semaine</strong> · paiement sécurisé Stripe</p>
        <button onClick={onClose} className={styles.later}>Plus tard</button>
        {wait && <p className={styles.wait}>Sans VIP, tes visions gratuites reviennent dans {wait}.</p>}
      </div>
    </section>
  </div>;
}
