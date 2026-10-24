import { stripe, planById, userFromRequest } from '@/lib/stripe-server';

// Creates an embedded Checkout session for the signed-in member.
export async function POST(request: Request) {
  const user = await userFromRequest(request);
  if (!user?.email) return Response.json({ error: 'Reconnecte-toi pour payer.' }, { status: 401 });
  const body = await request.json().catch(() => null) as { planId?: unknown } | null;
  const plan = planById(body?.planId);
  if (!plan) return Response.json({ error: 'Offre inconnue.' }, { status: 400 });
  const origin = new URL(request.url).origin;
  try {
    const session = await stripe().checkout.sessions.create({
      mode: 'payment',
      ui_mode: 'embedded_page',
      line_items: [{ quantity: 1, price_data: { currency: 'eur', unit_amount: Math.round(plan.price * 100), product_data: { name: `YAMONFIM VIP · ${plan.name}`, description: 'Films et séries en illimité, sans quota.' } } }],
      customer_email: user.email,
      client_reference_id: user.id,
      metadata: { userId: user.id, planId: plan.id },
      return_url: `${origin}/abonnement?paiement={CHECKOUT_SESSION_ID}`,
    });
    return Response.json({ clientSecret: session.client_secret });
  } catch (error) {
    console.error('Stripe checkout', error);
    return Response.json({ error: 'Le paiement ne peut pas être ouvert. Réessaie.' }, { status: 502 });
  }
}
