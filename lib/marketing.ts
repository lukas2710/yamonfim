import { createHmac, timingSafeEqual } from 'node:crypto';

// Marketing consent lives in Supabase Auth user_metadata:
// marketing_consent = true (opted in), false (refused or unsubscribed), absent (never asked).
export type Consent = boolean | null;
export const readConsent = (metadata: unknown): Consent => {
  const value = (metadata as { marketing_consent?: unknown } | null)?.marketing_consent;
  return value === true || value === false ? value : null;
};

// French rules (CNIL): promotional emails need prior consent, except for paying
// customers about similar services ("soft opt-in") as long as they did not refuse.
export function contactable(consent: Consent, paidCustomer: boolean) {
  if (consent === true) return { ok: true, reason: 'Consentement donné' };
  if (consent === false) return { ok: false, reason: 'Désinscrit ou refus' };
  if (paidCustomer) return { ok: true, reason: 'Client payant : offres VIP uniquement, avec lien de désinscription' };
  return { ok: false, reason: 'Pas de consentement' };
}

const normalize = (email: string) => email.trim().toLowerCase();
export function unsubscribeToken(email: string, secret: string) {
  return createHmac('sha256', secret).update(`unsubscribe:${normalize(email)}`).digest('base64url').slice(0, 32);
}
export function verifyUnsubscribeToken(email: string, token: string, secret: string) {
  const expected = Buffer.from(unsubscribeToken(email, secret));
  const given = Buffer.from(String(token));
  return expected.length === given.length && timingSafeEqual(expected, given);
}
export const unsubscribeUrl = (siteUrl: string, email: string, secret: string) =>
  `${siteUrl.replace(/\/$/, '')}/desinscription?e=${encodeURIComponent(normalize(email))}&t=${unsubscribeToken(email, secret)}`;

// Semicolon CSV for Excel in French, protected against formula injection.
export function toCsv(rows: unknown[][]) {
  const cell = (value: unknown) => {
    let text = String(value ?? '');
    if (/^[=+@\-\t\r]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  };
  return '﻿' + rows.map(row => row.map(cell).join(';')).join('\r\n');
}
