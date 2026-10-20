export interface Plan { id: string; name: string; price: number; days: number; months?: number; tagline: string; badge?: string; stripeLink: string }
export const PLANS: Plan[] = [
  { id: '2w', name: '2 semaines', price: 3.99, days: 14, tagline: 'Pour découvrir à votre rythme', stripeLink: 'https://buy.stripe.com/aFa7sK2HT9tnfaD3qif3a0n' },
  { id: '3m', name: '3 mois', price: 15, days: 91, months: 3, tagline: 'Pour vos soirées et vos week-ends', badge: 'Notre recommandation', stripeLink: 'https://buy.stripe.com/eVq6oGeqBbBvbYrbWOf3a0m' },
  { id: '1y', name: '1 an', price: 50, days: 365, months: 12, tagline: 'Pour les passionnés de cinéma', badge: 'Meilleur tarif par jour', stripeLink: 'https://buy.stripe.com/bJedR896h8pjbYrd0Sf3a0o' },
];
export const formatEuro = (value: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }).format(value);
export function checkoutUrl(plan: Plan, userId: string, email: string) {
  if (!userId || !email) throw new Error('Reconnectez-vous pour associer le paiement à votre compte.');
  const url = new URL(plan.stripeLink);
  if (url.protocol !== 'https:' || url.hostname !== 'buy.stripe.com') throw new Error('Ce lien de paiement est indisponible.');
  url.searchParams.set('prefilled_email', email);
  url.searchParams.set('client_reference_id', userId);
  return url.toString();
}
export function expirationDate(start?: string, duration?: string): number | null {
  if (!start) return null;
  const date = new Date(start);
  if (!Number.isFinite(date.getTime())) return null;
  // Preserve the existing Admin VIP countdown's calendar rules.
  if (duration === '15d') date.setDate(date.getDate() + 15);
  else if (duration === '3m') date.setMonth(date.getMonth() + 3);
  else if (duration === '1y') date.setFullYear(date.getFullYear() + 1);
  else return null;
  return date.getTime();
}

export function nextSundayReset(now: number) {
  const key = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  const target = new Date(`${key}T00:00:00Z`);
  target.setUTCDate(target.getUTCDate() + (7 - target.getUTCDay()));
  const offset = new Intl.DateTimeFormat('en', { timeZone: 'Europe/Paris', timeZoneName: 'longOffset' }).formatToParts(target).find(part => part.type === 'timeZoneName')?.value.match(/GMT([+-])(\d{2}):(\d{2})/);
  if (!offset) throw new Error('Fuseau horaire indisponible');
  const minutes = (Number(offset[2]) * 60 + Number(offset[3])) * (offset[1] === '+' ? 1 : -1);
  return target.getTime() - minutes * 60_000;
}
