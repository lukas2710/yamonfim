'use client';
import { useEffect, useState } from 'react';
import { getPersistentSession } from './auth-session';
import { readClientResource } from './resource-cache';
import type { VipReviews } from './feedback-reviews';
const UPDATED = 'yf-vip-reviews-updated';
export function refreshVipReviews() { window.dispatchEvent(new Event(UPDATED)); }
export function useVipReviews(userId?: string) {
  const [version, setVersion] = useState(0);
  const [data, setData] = useState<VipReviews>({ reviews: [], average: 0, total: 0 });
  const [loading, setLoading] = useState(true), [unavailable, setUnavailable] = useState(false);
  useEffect(() => { const refresh = () => setVersion(value => value + 1); window.addEventListener(UPDATED, refresh); return () => window.removeEventListener(UPDATED, refresh); }, []);
  useEffect(() => {
    if (!userId) return;
    let active = true;
    void readClientResource<VipReviews>(`vip-feedback:${userId}:${version}`, async () => {
      const { data: { session } } = await getPersistentSession();
      if (!session || session.user.id !== userId) throw new Error('Connexion requise');
      const response = await fetch('/api/reviews', { headers: { Authorization: `Bearer ${session.access_token}` } });
      if (!response.ok) throw new Error('Avis indisponibles');
      return response.json();
    }).then(result => { if (active) { setData(result); setUnavailable(false); } }).catch(() => { if (active) setUnavailable(true); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [userId, version]);
  return { ...data, loading, unavailable };
}
export async function publishVipReview(review: { display_name: string; rating: number; comment: string }) {
  const { data: { session } } = await getPersistentSession();
  if (!session) throw new Error('Connexion requise');
  const response = await fetch('/api/reviews', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify(review) });
  if (!response.ok) throw new Error('Ton avis n’a pas pu être enregistré. Réessaie.');
  refreshVipReviews();
}
