'use client';

import { useCallback, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from '@stripe/react-stripe-js';
import { getPersistentSession } from '@/lib/auth-session';
import { formatEuro, type Plan } from './plans';
import styles from './payment.module.css';

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
export const embeddedPaymentEnabled = !!publishableKey;
const stripePromise = publishableKey ? loadStripe(publishableKey) : null;

export default function EmbeddedPayment({ plan, onClose }: { plan: Plan; onClose: () => void }) {
  const fetchClientSecret = useCallback(async () => {
    const { data: { session } } = await getPersistentSession();
    const response = await fetch('/api/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` }, body: JSON.stringify({ planId: plan.id }) });
    const result = await response.json().catch(() => ({})) as { clientSecret?: string; error?: string };
    if (!response.ok || !result.clientSecret) throw new Error(result.error || 'Le paiement ne peut pas être ouvert.');
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
  return <div className={styles.backdrop} onClick={onClose}>
    <section role="dialog" aria-modal="true" aria-label={`Paiement VIP ${plan.name}`} className={styles.dialog} onClick={event => event.stopPropagation()}>
      <header className={styles.head}><div><p>YAMONFIM VIP</p><h2>{plan.name} · {formatEuro(plan.price)}</h2></div><button onClick={onClose} aria-label="Fermer le paiement">×</button></header>
      <div className={styles.checkout}><EmbeddedCheckoutProvider stripe={stripePromise} options={{ fetchClientSecret }}><EmbeddedCheckout /></EmbeddedCheckoutProvider></div>
      <p className={styles.foot}>🔒 Paiement sécurisé par Stripe · ton VIP s’active automatiquement après le paiement</p>
    </section>
  </div>;
}
