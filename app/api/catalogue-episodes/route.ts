import { createClient } from '@supabase/supabase-js';
import { supabaseUrl, supabaseAnonKey } from '@/lib/supabase';
const cache = new Map<string, { at: number; keys: string[] }>();
export async function GET(request: Request) {
  const ids = [...new Set((new URL(request.url).searchParams.get('ids') || '').split(',').filter(Boolean))];
  if (!ids.length || ids.length > 10 || ids.some(id => !/^[\w-]{1,100}$/.test(id))) return Response.json({ error: 'Identifiants invalides' }, { status: 400 });
  const missing = ids.filter(id => !cache.has(id) || Date.now() - cache.get(id)!.at > 300000);
  if (missing.length) {
    const client = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await client.from('media').select('id,seasons').eq('type', 'series').in('id', missing).abortSignal(AbortSignal.timeout(12000));
    if (error) return Response.json({ error: 'Épisodes indisponibles' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
    for (const row of data || []) {
      const keys: string[] = [];
      // Specials (season 0) are optional: skipping them must not leave a series unfinished.
      if (Array.isArray(row.seasons)) row.seasons.forEach((season, s) => { if (season?.seasonNumber !== 0 && Array.isArray(season?.episodes)) season.episodes.forEach((_: unknown, e: number) => keys.push(`s${s}_e${e}`)); });
      cache.set(String(row.id), { at: Date.now(), keys });
    }
    while (cache.size > 500) cache.delete(cache.keys().next().value!);
  }
  return Response.json(Object.fromEntries(ids.filter(id => cache.has(id)).map(id => [id, cache.get(id)!.keys])), { headers: { 'Cache-Control': 'public, max-age=60', 'Netlify-CDN-Cache-Control': 'public, s-maxage=300' } });
}
