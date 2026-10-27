import { createClient } from '@supabase/supabase-js';
import { supabaseUrl, supabaseAnonKey } from './supabase';
import { type CreditsMarker } from './episode-credits';
import { selectStoredCredits } from './stored-credits-selection';

const database = () => createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false } });
export async function storedCredits(keys: string[], season: number, episode: number, duration: number) {
  const { data, error } = await database().from('episode_credits').select('*').in('episode_key', keys).eq('season', season).eq('episode', episode)
    .order('episode_key').order('duration_ms');
  if (error) return { marker: null, hit: false };
  const ordered = (data || []).sort((a, b) => keys.indexOf(a.episode_key) - keys.indexOf(b.episode_key));
  return selectStoredCredits(ordered, duration, Date.now());
}
export async function storeCredits(key: string, season: number, episode: number, duration: number, marker: CreditsMarker | null, retrySoon = false) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return false;
  // SkipDB is used read-only, without importing its data into our database.
  if (marker?.source === 'SkipDB') return false;
  const { error } = await database().from('episode_credits').upsert({ episode_key: key, season, episode, duration_ms: Math.round(duration * 1000),
    start_sec: marker?.start ?? null, source: marker?.source || 'missing', checked_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + (marker ? 7 * 86400000 : retrySoon ? 60000 : 3600000)).toISOString() });
  return !error;
}
