import { supabase } from './supabase';
import { reserveViewing } from './watch-quota';

export interface SubscriptionProfile {
  id: string;
  is_vip: boolean | string;
  watch_count: number;
  vip_started_at?: string;
  vip_duration?: string;
  watch_reset_at?: string;
}

function normalizeProfile(value: SubscriptionProfile | null): SubscriptionProfile | null {
  if (!value) return null;
  return { ...value, is_vip: value.is_vip === true || value.is_vip === 'true', watch_count: Math.max(0, Number(value.watch_count) || 0) };
}

// The RPC resets only the authenticated member's expired weekly quota.
// Keep existing installations usable until their migration is installed.
export async function fetchSubscriptionProfile(userId: string) {
  const result = await supabase.rpc('get_my_subscription_status');
  if (!result.error) return { data: normalizeProfile(result.data as SubscriptionProfile | null), error: null, resetVerified: true };
  if (!['PGRST202', '42883'].includes(result.error.code)) return { data: null, error: result.error, resetVerified: false };
  const fallback = await supabase.from('profiles').select('*').eq('id', userId).single();
  return { data: normalizeProfile(fallback.data as SubscriptionProfile | null), error: fallback.error, resetVerified: false };
}

export async function reserveAccountViewing(userId: string) {
  return reserveViewing(async () => {
    const { data: profile, error } = await fetchSubscriptionProfile(userId);
    if (error || !profile) throw new Error('Impossible de vérifier ton accès. Réessaie dans un instant.');
    return { vip: profile.is_vip === true, count: profile.watch_count };
  }, async expected => incrementWatchCount(userId, expected));
}

// Prefer the server function: members cannot edit their profile row once RLS is locked.
// The direct update keeps sites without the security migration working.
export async function incrementWatchCount(userId: string, expected: number) {
  const rpc = await supabase.rpc('increment_my_watch_count', { expected });
  if (!rpc.error) return rpc.data === true;
  if (!['PGRST202', '42883'].includes(rpc.error.code)) throw new Error('Le visionnage n’a pas pu être enregistré. Réessaie.');
  let query = supabase.from('profiles').update({ watch_count: expected + 1 }).eq('id', userId).not('is_vip', 'is', true);
  query = expected === 0 ? query.or('watch_count.eq.0,watch_count.is.null') : query.eq('watch_count', expected);
  const { data, error } = await query.select('id').maybeSingle();
  if (error) throw new Error('Le visionnage n’a pas pu être enregistré. Réessaie.');
  return !!data;
}
