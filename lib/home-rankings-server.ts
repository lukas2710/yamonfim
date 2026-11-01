import { getStore } from '@netlify/blobs';
import type { HomeRankings } from './home-rankings';

const store = () => getStore('home-rankings');
export async function readHomeRankings(): Promise<HomeRankings | null> {
  try { return await store().get('tmdb-v1', { type: 'json' }) as HomeRankings | null; } catch { return null; }
}
export async function writeHomeRankings(data: HomeRankings) {
  try { await store().setJSON('tmdb-v1', data); } catch { /* Local builds have no Blobs context. */ }
}

// Bounded discovery queries, shared across visitors; never fetch one detail per
// catalogue title. TV uses its own official genre IDs (Action & Adventure etc.).
const movieGenres = [28, 12, 16, 35, 80, 99, 18, 10751, 14, 27, 9648, 10749, 878, 53];
const tvGenres = [10759, 16, 35, 80, 99, 18, 10751, 9648, 10765];
type Entry = { id: number; vote_average: number; vote_count: number; original_language?: string; origin_country?: string[]; genre_ids?: number[] };
export async function buildHomeRankings(apiKey: string, fetcher: typeof fetch = fetch): Promise<HomeRankings> {
  const output: HomeRankings = { at: Date.now(), ratings: {}, trending: { movie: [], series: [] } };
  const jobs: { path: string; type: 'movie' | 'tv'; page: number; genre?: number }[] = [];
  for (const type of ['movie', 'tv'] as const) {
    for (const genre of type === 'movie' ? movieGenres : tvGenres) for (let page = 1; page <= 3; page++) jobs.push({ path: `discover/${type}`, type, genre, page });
    for (let page = 1; page <= 5; page++) jobs.push({ path: `trending/${type}/week`, type, page });
  }
  const results: { job: typeof jobs[number]; entries: Entry[] }[] = [];
  const signal = AbortSignal.timeout(22000);
  let index = 0;
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (index < jobs.length && !signal.aborted) {
      const job = jobs[index++];
      const params = new URLSearchParams({ api_key: apiKey, language: 'fr-FR', page: String(job.page) });
      if (job.genre) {
        params.set('sort_by', 'vote_average.desc'); params.set('vote_count.gte', job.type === 'movie' ? '300' : '150');
        params.set('with_genres', String(job.genre)); params.set('include_adult', 'false');
      }
      try {
        const response = await fetcher(`https://api.themoviedb.org/3/${job.path}?${params}`, { signal });
        if (!response.ok) continue;
        const data = await response.json();
        if (Array.isArray(data.results)) results.push({ job, entries: data.results });
      } catch { /* A provider failure must not block the home page. */ }
    }
  }));
  // A partial run is never published as a complete ranking snapshot.
  if (results.length !== jobs.length) throw new Error('Classements TMDB temporairement indisponibles');
  for (const { job, entries } of results.sort((a, b) => a.job.page - b.job.page)) {
    for (const entry of entries) {
      if (!Number.isInteger(entry.id) || !Number.isFinite(entry.vote_average) || !Number.isFinite(entry.vote_count)) continue;
      output.ratings[`${job.type}:${entry.id}`] = { rating: entry.vote_average, votes: entry.vote_count, anime: !!entry.genre_ids?.includes(16) && (entry.original_language === 'ja' || !!entry.origin_country?.includes('JP')) };
      if (!job.genre) output.trending[job.type === 'tv' ? 'series' : 'movie'].push(String(entry.id));
    }
  }
  return output;
}
