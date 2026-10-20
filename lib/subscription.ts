import { supabase } from './supabase';

export interface SubscriptionProfile {
  id: string;
  is_vip: boolean | string;
  watch_count: number;
  vip_started_at?: string;
  vip_duration?: string;
  watch_reset_at?: string;
}

// The RPC resets only the authenticated member's expired weekly quota.
// Keep existing installations usable until their migration is installed.
export async function fetchSubscriptionProfile(userId: string) {
  const result = await supabase.rpc('get_my_subscription_status');
  if (!result.error) return { data: result.data as SubscriptionProfile | null, error: null, resetVerified: true };
  if (!['PGRST202', '42883'].includes(result.error.code)) return { data: null, error: result.error, resetVerified: false };
  const fallback = await supabase.from('profiles').select('*').eq('id', userId).single();
  return { data: fallback.data as SubscriptionProfile | null, error: fallback.error, resetVerified: false };
}
