import type { SupabaseClient } from '@supabase/supabase-js';

const TMDB_KEY = 'af281c5089038e174e83c576ff765be9';
const COLUMNS = 'id,title,type,poster,backdrop,description,genres,tmdb_id,audience,release_year';
type TmdbResult = { id: number; media_type?: string };
type Card = { id: string | number; type?: string | null; tmdb_id?: string | number | null };

// « Spider-Man » and « spider man » are the same search.
export function titlePattern(query: string) {
  const words = query.match(/[\p{L}\p{N}]+/gu) || [];
  return words.length ? `%${words.join('%')}%` : '';
}
export function tmdbTitles(results: TmdbResult[]) {
  return results.filter(row => row.media_type === 'movie' || row.media_type === 'tv')
    .map(row => ({ id: String(row.id), type: row.media_type === 'movie' ? 'movie' : 'series' }));
}
async function searchTmdb(query: string, signal: AbortSignal) {
  try {
    const response = await fetch(`https://api.themoviedb.org/3/search/multi?api_key=${TMDB_KEY}&language=fr-FR&include_adult=false&query=${encodeURIComponent(query)}`, { signal });
    return response.ok ? tmdbTitles((await response.json()).results || []) : [];
  } catch { return []; }
}

/**
 * Asks TMDB then the database, as the admin form does, so the home page cannot
 * miss a title the admin form finds: list still loading, other language, accents.
 */
export async function searchCatalogueDatabase<T extends Card>(client: SupabaseClient, query: string, signal: AbortSignal) {
  const titles = await searchTmdb(query, signal), pattern = titlePattern(query);
  const none = { data: [] as unknown[] };
  const [byId, byTitle] = await Promise.all([
    titles.length ? client.from('media').select(COLUMNS).in('tmdb_id', titles.map(title => title.id)).limit(60).abortSignal(signal) : none,
    pattern ? client.from('media').select(COLUMNS).ilike('title', pattern).limit(40).abortSignal(signal) : none,
  ]);
  const wanted = new Map(titles.map((title, rank) => [`${title.type}:${title.id}`, rank]));
  const identified = ((byId.data || []) as unknown as T[]).filter(row => wanted.has(`${row.type}:${row.tmdb_id}`))
    .sort((a, b) => wanted.get(`${a.type}:${a.tmdb_id}`)! - wanted.get(`${b.type}:${b.tmdb_id}`)!);
  return [...new Map([...identified, ...((byTitle.data || []) as unknown as T[])].map(row => [String(row.id), row])).values()];
}
