import type { SupabaseClient } from '@supabase/supabase-js';
import type { SeenRow } from './completed-titles';

export async function fetchProfileWatched(client: SupabaseClient, userId: string, profileId: string): Promise<SeenRow[]> {
  if (!userId || !profileId) return [];
  const rows: SeenRow[] = [];
  let total: number | null = null;
  for (;;) {
    const { data, error, count } = await client.from('user_watched')
      .select('media_id,ep_key,watched_at', rows.length === 0 ? { count: 'exact' } : undefined)
      .eq('user_id', userId).eq('profile_id', profileId)
      .order('watched_at', { ascending: false }).order('media_id').order('ep_key')
      .range(rows.length, rows.length + 999);
    if (error) throw new Error('Les épisodes vus ne peuvent pas être chargés.');
    if (count !== null) total = count;
    if (!data?.length) { if (total !== null && rows.length < total) throw new Error('Liste des épisodes vus incomplète.'); break; }
    rows.push(...data as SeenRow[]);
    if (total !== null ? rows.length >= total : data.length < 1000) break;
  }
  return rows;
}
