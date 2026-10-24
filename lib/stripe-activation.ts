import type Stripe from 'stripe';
import { planById, VIP_DURATIONS, adminDatabase } from './stripe-server';

// Shared by the webhook and the return-page confirmation. Idempotent: the start
// date comes from the session, so activating twice writes the same values.
export async function activateVipFromSession(session: Stripe.Checkout.Session) {
  if (session.payment_status !== 'paid') return { activated: false, reason: 'Paiement pas encore confirmé.' };
  const userId = session.metadata?.userId || session.client_reference_id;
  const plan = planById(session.metadata?.planId);
  if (!userId || !plan) return { activated: false, reason: 'Session sans compte ou offre.' };
  const { error } = await adminDatabase().from('profiles')
    .update({ is_vip: true, vip_started_at: new Date(session.created * 1000).toISOString(), vip_duration: VIP_DURATIONS[plan.id] })
    .eq('id', userId);
  if (error) throw new Error(`Activation VIP impossible : ${error.message}`);
  return { activated: true, userId };
}
