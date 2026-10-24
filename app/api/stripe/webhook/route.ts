import type Stripe from 'stripe';
import { stripe, planById, VIP_DURATIONS, adminDatabase } from '@/lib/stripe-server';

// Activates VIP once Stripe confirms the payment. Safe to receive twice:
// the start date comes from the session, so a replay writes the same values.
export async function POST(request: Request) {
  const signature = request.headers.get('stripe-signature');
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !secret) return new Response('Signature manquante', { status: 400 });
  let event: Stripe.Event;
  try { event = stripe().webhooks.constructEvent(await request.text(), signature, secret); }
  catch { return new Response('Signature invalide', { status: 400 }); }

  if (event.type !== 'checkout.session.completed' && event.type !== 'checkout.session.async_payment_succeeded') return Response.json({ received: true });
  const session = event.data.object;
  if (session.payment_status !== 'paid') return Response.json({ received: true });
  const userId = session.metadata?.userId || session.client_reference_id;
  const plan = planById(session.metadata?.planId);
  if (!userId || !plan) { console.error('Stripe webhook: session sans compte ou offre', session.id); return Response.json({ received: true }); }

  const { error } = await adminDatabase().from('profiles')
    .update({ is_vip: true, vip_started_at: new Date(session.created * 1000).toISOString(), vip_duration: VIP_DURATIONS[plan.id] })
    .eq('id', userId);
  // A 500 makes Stripe retry later instead of losing the activation.
  if (error) { console.error('Stripe webhook: activation VIP', error); return new Response('Activation impossible', { status: 500 }); }
  return Response.json({ received: true });
}
