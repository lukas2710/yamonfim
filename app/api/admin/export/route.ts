import { contactable, readConsent, toCsv, unsubscribeUrl } from '@/lib/marketing';
import { listAllUsers, unsubscribeSecret } from '@/lib/marketing-server';
import { adminDatabase, stripe, userFromRequest } from '@/lib/stripe-server';

const ADMIN_EMAIL = 'lukas.leclerc312@gmail.com';
interface Payments { count: number; total: number; last: number; currency: string }

// Admin-only CSV of every member and every Stripe buyer, with the contact rule applied.
export async function GET(request: Request) {
  const admin = await userFromRequest(request);
  if (!admin) return new Response('Connexion requise', { status: 401 });
  if (admin.email !== ADMIN_EMAIL) return new Response('Accès administrateur requis', { status: 403 });

  const [users, profiles] = await Promise.all([
    listAllUsers(),
    adminDatabase().from('profiles').select('id,is_vip').then(({ data }) => data ?? []),
  ]);
  const vip = new Set(profiles.filter(p => p.is_vip === true || p.is_vip === 'true').map(p => p.id));

  // Paid Checkout sessions (payment links and embedded checkout), grouped by email.
  const payments = new Map<string, Payments>();
  let note = '';
  try {
    for await (const session of stripe().checkout.sessions.list({ status: 'complete', limit: 100 })) {
      const email = (session.customer_details?.email || session.customer_email || '').trim().toLowerCase();
      if (!email || session.payment_status !== 'paid') continue;
      const entry = payments.get(email) ?? { count: 0, total: 0, last: 0, currency: (session.currency || 'eur').toUpperCase() };
      entry.count++; entry.total += (session.amount_total ?? 0) / 100; entry.last = Math.max(entry.last, session.created * 1000);
      payments.set(email, entry);
    }
  } catch { note = 'Stripe indisponible : colonnes de paiement vides'; }

  const secret = unsubscribeSecret();
  const site = new URL(request.url).origin;
  const date = (ms: number) => ms ? new Date(ms).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' }) : '';
  const consentLabel = (c: boolean | null) => c === true ? 'Oui' : c === false ? 'Non' : 'Jamais demandé';
  const rows: unknown[][] = [];
  const seen = new Set<string>();
  for (const user of users) {
    const email = user.email?.trim().toLowerCase();
    if (!email) continue;
    seen.add(email);
    const paid = payments.get(email);
    const consent = readConsent(user.user_metadata);
    const rule = contactable(consent, !!paid);
    rows.push([email, date(Date.parse(user.created_at)), vip.has(user.id) ? 'Oui' : 'Non', paid ? 'Oui' : 'Non', paid?.count ?? 0, paid ? paid.total.toFixed(2) : '', date(paid?.last ?? 0), consentLabel(consent), rule.ok ? 'Oui' : 'Non', rule.reason, rule.ok ? unsubscribeUrl(site, email, secret) : '']);
  }
  // Buyers who paid with another email than their account: their opt-out could not be recorded.
  for (const [email, paid] of payments) {
    if (seen.has(email)) continue;
    rows.push([email, '', 'Non', 'Oui', paid.count, paid.total.toFixed(2), date(paid.last), 'Jamais demandé', 'Non', 'Pas de compte sur le site : désinscription impossible à enregistrer', '']);
  }
  rows.sort((a, b) => String(b[8]).localeCompare(String(a[8])) || String(a[0]).localeCompare(String(b[0])));

  const header = ['Email', 'Inscrit le', 'VIP actuel', 'Client Stripe (a payé)', 'Nb paiements', 'Total payé (€)', 'Dernier paiement', 'Accepte les emails', 'Contactable pour une offre', 'Pourquoi', 'Lien de désinscription à mettre dans l’email'];
  return new Response(toCsv([header, ...rows]), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="yamonfim-contacts-${new Date().toISOString().slice(0, 10)}.csv"`,
      'Cache-Control': 'no-store',
      ...(note ? { 'X-Export-Note': encodeURIComponent(note) } : {}),
    },
  });
}
