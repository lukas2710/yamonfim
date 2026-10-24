import { NextResponse } from 'next/server';
import { verifyUnsubscribeToken } from '@/lib/marketing';
import { listAllUsers, unsubscribeSecret } from '@/lib/marketing-server';
import { adminDatabase } from '@/lib/stripe-server';

// Public endpoint used by the link in marketing emails: the signed token proves
// the request comes from the email sent to that address.
export async function POST(request: Request) {
  const { email, token } = await request.json().catch(() => ({}));
  if (typeof email !== 'string' || typeof token !== 'string' || !verifyUnsubscribeToken(email, token, unsubscribeSecret())) {
    return NextResponse.json({ error: 'Lien de désinscription invalide.' }, { status: 400 });
  }
  try {
    const target = email.trim().toLowerCase();
    const user = (await listAllUsers()).find(u => u.email?.toLowerCase() === target);
    if (user) {
      const { error } = await adminDatabase().auth.admin.updateUserById(user.id, { user_metadata: { ...user.user_metadata, marketing_consent: false, marketing_consent_at: new Date().toISOString() } });
      if (error) throw error;
    }
    // Same answer whether or not an account exists: the page never reveals who is a member.
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Désinscription momentanément impossible. Réessaie ou écris-nous.' }, { status: 500 });
  }
}
