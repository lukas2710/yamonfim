import type Stripe from 'stripe';
import { stripe } from '@/lib/stripe-server';
import { activateVipFromSession } from '@/lib/stripe-activation';

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
  try { await activateVipFromSession(event.data.object); }
  // A 500 makes Stripe retry later instead of losing the activation.
  catch (error) { console.error('Stripe webhook', error); return new Response('Activation impossible', { status: 500 }); }
  return Response.json({ received: true });
}
