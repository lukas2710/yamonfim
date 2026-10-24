import { stripe, userFromRequest } from '@/lib/stripe-server';
import { activateVipFromSession } from '@/lib/stripe-activation';

// Called when the member comes back from Checkout: asks Stripe directly whether
// the session is paid, so VIP activates even without a configured webhook.
export async function POST(request: Request) {
  const user = await userFromRequest(request);
  if (!user) return Response.json({ error: 'Reconnecte-toi.' }, { status: 401 });
  const body = await request.json().catch(() => null) as { sessionId?: unknown } | null;
  const sessionId = typeof body?.sessionId === 'string' && /^cs_[A-Za-z0-9_]+$/.test(body.sessionId) ? body.sessionId : null;
  if (!sessionId) return Response.json({ error: 'Paiement introuvable.' }, { status: 400 });
  try {
    const session = await stripe().checkout.sessions.retrieve(sessionId);
    // Only the member who paid can activate their own session.
    if ((session.metadata?.userId || session.client_reference_id) !== user.id) return Response.json({ error: 'Ce paiement ne correspond pas à ton compte.' }, { status: 403 });
    const result = await activateVipFromSession(session);
    return Response.json(result);
  } catch (error) {
    console.error('Stripe confirm', error);
    return Response.json({ error: 'Confirmation impossible pour le moment.' }, { status: 502 });
  }
}
