import type { SupabaseClient } from '@supabase/supabase-js';

export function parisMidnight(now: Date, daysAgo = 0) {
  const key = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  const day = new Date(`${key}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() - daysAgo);
  const offset = new Intl.DateTimeFormat('en', { timeZone: 'Europe/Paris', timeZoneName: 'longOffset' }).formatToParts(day).find(p => p.type === 'timeZoneName')?.value.match(/GMT([+-])(\d{2}):(\d{2})/);
  const minutes = offset ? (Number(offset[2]) * 60 + Number(offset[3])) * (offset[1] === '+' ? 1 : -1) : 0;
  return new Date(day.getTime() - minutes * 60_000);
}

export async function fetchDailyAdditions(client: SupabaseClient, now = new Date()) {
  const today = parisMidnight(now).toISOString(), yesterday = parisMidnight(now, 1).toISOString();
  const count = async (from: string, until: string, type?: string) => {
    let query = client.from('media').select('id', { count: 'exact', head: true }).gte('created_at', from).lt('created_at', until);
    if (type) query = query.eq('type', type);
    const result = await query;
    if (result.error || result.count === null) throw new Error('Comptage indisponible');
    return result.count;
  };
  const [movies, series, previous, preview] = await Promise.all([
    count(today, now.toISOString(), 'movie'), count(today, now.toISOString(), 'series'), count(yesterday, today),
    client.from('media').select('id,title,type,poster,created_at').gte('created_at', today).lt('created_at', now.toISOString()).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(60),
  ]);
  if (preview.error) throw new Error('Nouveautés indisponibles');
  return { movies, series, yesterday: previous, total: movies + series, items: preview.data || [] };
}
