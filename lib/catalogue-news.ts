import { createClient } from '@supabase/supabase-js';
import { getStore } from '@netlify/blobs';
import { supabaseUrl, supabaseAnonKey } from './supabase';
import { readCatalogueSnapshot } from './catalogue-snapshot';

// Daily news for the administrator, from TMDB public data only: seasons and
// episodes aired for series already on the site, and recent digital releases.
export const NEWS_DAYS = 7, MOVIE_DAYS = 14;
// missingFrom: first aired episode absent from the site, null when the site has them all.
export type SeriesNews = { tmdb: number; mediaId: string; title: string; poster: string; season: number; episode: number; airDate: string; newSeason: boolean; missingFrom: number | null };
export type MovieNews = { tmdb: number; title: string; poster: string; releaseDate: string; mediaId: string | null };
export type CatalogueNews = { at: number; series: SeriesNews[]; movies: MovieNews[] };
type SiteSeason = { seasonNumber: number; episodes?: { number: number }[] };
type LastEpisode = { season_number?: number; episode_number?: number; air_date?: string } | null | undefined;

// The site often lists announced episodes ahead of broadcast, so the news is the
// last episode actually aired, compared with what the site holds.
export function seriesNewsEntry(seasons: SiteSeason[], last: LastEpisode, seasonStart: string | null | undefined, since: string) {
  const season = Number(last?.season_number), episode = Number(last?.episode_number);
  if (!Number.isInteger(season) || season < 1 || !Number.isInteger(episode) || episode < 1 || !last?.air_date || last.air_date < since) return null;
  const present = seasons.find(item => item.seasonNumber === season);
  const known = Math.max(0, ...(present?.episodes || []).map(item => Number(item.number) || 0));
  return { season, episode, airDate: last.air_date, newSeason: episode === 1 || !!seasonStart && seasonStart >= since, missingFrom: known >= episode ? null : known + 1 };
}

const day = (offset: number) => new Date(Date.now() - offset * 86400000).toISOString().slice(0, 10);
const poster = (path: unknown) => typeof path === 'string' && path ? `https://image.tmdb.org/t/p/w185${path}` : '';
async function mapLimit<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>) {
  const results: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) { const index = next++; results[index] = await task(items[index]); }
  }));
  return results;
}

export async function buildCatalogueNews(apiKey: string): Promise<CatalogueNews> {
  const tmdb = async (path: string, params: Record<string, string> = {}) => {
    const url = `https://api.themoviedb.org/3/${path}?${new URLSearchParams({ api_key: apiKey, language: 'fr-FR', ...params })}`;
    for (let attempt = 0; attempt < 3; attempt++) {
      const response = await fetch(url, { signal: AbortSignal.timeout(10000) }).catch(() => null);
      if (response?.status === 429) { await new Promise(resolve => setTimeout(resolve, 1000)); continue; }
      return response?.ok ? response.json() : null;
    }
    return null;
  };
  const db = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  // Reading the titles from Supabase is slow from Netlify: reuse the prepared catalogue.
  const snapshot = (await readCatalogueSnapshot())?.rows as { id: string; title: string; type: string; tmdb_id: unknown }[] | undefined;
  const siteRows = async (type: 'series' | 'movie') => {
    const all: { id: string; title: string; tmdb_id: unknown }[] = snapshot?.filter(row => row.type === type) || [];
    for (let offset = 0; !snapshot; offset += 1000) {
      const { data, error } = await db.from('media').select('id,title,tmdb_id').eq('type', type).order('id').range(offset, offset + 999);
      if (error) throw error;
      all.push(...data); if (data.length < 1000) break;
    }
    return new Map(all.filter(row => /^[1-9]\d*$/.test(String(row.tmdb_id))).map(row => [Number(row.tmdb_id), row]));
  };
  const [siteSeries, siteMovies] = await Promise.all([siteRows('series'), siteRows('movie')]);
  const since = day(NEWS_DAYS), today = day(0);

  // Every series that aired an episode in the window, kept when it is on the site.
  const first = await tmdb('discover/tv', { 'air_date.gte': since, 'air_date.lte': today, page: '1' });
  const pages = Math.min(500, Number(first?.total_pages) || 1);
  const rest = await mapLimit(Array.from({ length: pages - 1 }, (_, index) => index + 2), 15, page => tmdb('discover/tv', { 'air_date.gte': since, 'air_date.lte': today, page: String(page) }));
  const aired = new Set([first, ...rest].flatMap(result => (result?.results || []).map((show: { id: number }) => show.id)).filter(id => siteSeries.has(id)));
  const ids = [...aired], series: SeriesNews[] = [];
  const chunks = Array.from({ length: Math.ceil(ids.length / 40) }, (_, index) => ids.slice(index * 40, index * 40 + 40));
  await mapLimit(chunks, 4, async chunk => {
    const { data } = await db.from('media').select('id,tmdb_id,seasons').eq('type', 'series').in('tmdb_id', chunk.map(String));
    const details = await mapLimit(chunk, 8, id => tmdb(`tv/${id}`));
    chunk.forEach((id, index) => {
      const site = siteSeries.get(id)!, row = data?.find(item => String(item.tmdb_id) === String(id));
      const detail = details[index], last = detail?.last_episode_to_air;
      const seasonStart = (detail?.seasons as { season_number?: number; air_date?: string }[] | undefined)?.find(item => item.season_number === last?.season_number)?.air_date;
      const entry = seriesNewsEntry((row?.seasons || []) as SiteSeason[], last, seasonStart, since);
      if (entry) series.push({ tmdb: id, mediaId: String(row?.id ?? site.id), title: site.title, poster: poster(detail?.poster_path), ...entry });
    });
  });
  // Popular digital and physical releases of the last two weeks, worldwide.
  const releases = await mapLimit([1, 2, 3, 4, 5], 5, page => tmdb('discover/movie', { 'release_date.gte': day(MOVIE_DAYS), 'release_date.lte': today, with_release_type: '4|5', sort_by: 'popularity.desc', page: String(page) }));
  const seen = new Set<number>(), movies: MovieNews[] = [];
  for (const movie of releases.flatMap(result => result?.results || []) as { id: number; title: string; poster_path?: string; release_date?: string }[]) {
    if (seen.has(movie.id)) continue;
    seen.add(movie.id);
    movies.push({ tmdb: movie.id, title: movie.title, poster: poster(movie.poster_path), releaseDate: movie.release_date || '', mediaId: siteMovies.has(movie.id) ? String(siteMovies.get(movie.id)!.id) : null });
  }
  series.sort((a, b) => b.airDate.localeCompare(a.airDate) || a.title.localeCompare(b.title, 'fr'));
  return { at: Date.now(), series, movies };
}

const STORE = 'catalogue', KEY = 'news';
export async function readCatalogueNews(): Promise<CatalogueNews | null> {
  try { return await getStore(STORE).get(KEY, { type: 'json' }) as CatalogueNews | null; } catch { return null; }
}
export async function writeCatalogueNews(news: CatalogueNews) {
  try { await getStore(STORE).setJSON(KEY, news); return true; } catch { return false; }
}
