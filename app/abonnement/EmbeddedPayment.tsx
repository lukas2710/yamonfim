'use client';

import { useCallback, useEffect, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from '@stripe/react-stripe-js';
import { getPersistentSession } from '@/lib/auth-session';
import { formatEuro, perMonth, perWeek, savingPercent, type Plan } from './plans';
import styles from './payment.module.css';

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
export const embeddedPaymentEnabled = !!publishableKey;
const stripePromise = publishableKey ? loadStripe(publishableKey) : null;

function Check() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>; }
function Lock() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>; }
function Shield() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3 4 6v6c0 5 4 8 8 9 4-1 8-4 8-9V6l-8-3Z" /><path d="m8 12 3 3 5-6" /></svg>; }
function Bolt() { return <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" /></svg>; }

export default function EmbeddedPayment({ plan, email, onClose }: { plan: Plan; email?: string; onClose: () => void }) {
  const [failed, setFailed] = useState('');
  const fetchClientSecret = useCallback(async () => {
    const { data: { session } } = await getPersistentSession();
    const response = await fetch('/api/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` }, body: JSON.stringify({ planId: plan.id }) });
    const result = await response.json().catch(() => ({})) as { clientSecret?: string; error?: string };
    if (!response.ok || !result.clientSecret) {
      const message = result.error || 'Le paiement ne peut pas être ouvert.';
      setFailed(message);
      throw new Error(message);
    }
    return result.clientSecret;
  }, [plan.id]);
  useEffect(() => {
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const keydown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', keydown);
    return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', keydown); };
  }, [onClose]);
  if (!stripePromise) return null;
  const saving = savingPercent(plan);
  return <div className={styles.backdrop} onClick={onClose}>
    <section role="dialog" aria-modal="true" aria-label={`Paiement VIP ${plan.name}`} className={styles.dialog} onClick={event => event.stopPropagation()}>
      <button className={styles.close} onClick={onClose} aria-label="Fermer le paiement">×</button>
      <aside className={styles.summary}>
        <p className={styles.brand}>YAMON<span>FILM</span> <em>VIP</em></p>
        <p className={styles.kicker}>Ta commande</p>
        <h2>VIP {plan.name}</h2>
        <p className={styles.amount}>{formatEuro(plan.price)}<span>une seule fois</span></p>
        <p className={styles.equiv}>soit {formatEuro(plan.months ? perMonth(plan) : perWeek(plan))} / {plan.months ? 'mois' : 'semaine'}{saving > 0 && <b>−{saving} %</b>}</p>
        <ul className={styles.perks}>{['Films et séries en illimité', 'Accès activé tout de suite', 'Téléphone, ordinateur et TV'].map(text => <li key={text}><Check />{text}</li>)}</ul>
        <div className={styles.trust}>
          <p><Lock /><span><strong>Paiement chiffré</strong>Traité par Stripe, utilisé par des millions de sites. Ta carte ne passe jamais par YAMONFILM.</span></p>
          <p><Bolt /><span><strong>VIP immédiat</strong>Ton compte passe VIP dès la fin du paiement{email ? ` (${email})` : ''}.</span></p>
          <p><Shield /><span><strong>Aucune surprise</strong>Le montant exact s’affiche avant que tu confirmes.</span></p>
        </div>
        <p className={styles.cards} aria-label="Moyens de paiement acceptés">{['VISA', 'Mastercard', 'CB', 'Apple Pay', 'Google Pay'].map(m => <span key={m}>{m}</span>)}</p>
      </aside>
      <div className={styles.checkout}>
        {failed ? <div className={styles.failed} role="alert"><p>{failed}</p><button onClick={onClose}>Fermer et réessayer</button></div>
          : <EmbeddedCheckoutProvider stripe={stripePromise} options={{ fetchClientSecret }}><EmbeddedCheckout /></EmbeddedCheckoutProvider>}
      </div>
    </section>
  </div>;
}
