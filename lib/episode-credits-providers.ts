import { introDbCredits, communityCredits, skipDbCredits, type CreditsMarker } from './episode-credits';

export async function fetchEpisodeCredits(tmdb: string, season: number, episode: number, options: {
  duration?: number; signal: AbortSignal; includeSkipDb?: boolean; tmdbApiKey?: string; fetcher?: typeof fetch;
}) {
  let incomplete = false;
  const fetcher = options.fetcher || fetch;
  async function read(url: string) {
    try {
      const response = await fetcher(url, { signal: AbortSignal.any([options.signal, AbortSignal.timeout(5000)]), next: { revalidate: 3600 } });
      if (!response.ok && response.status !== 404) incomplete = true;
      return response.ok ? await response.json() : null;
    } catch { incomplete = true; return null; }
  }
  let marker: CreditsMarker | null = null;
  if (!tmdb) return { marker, incomplete: true };
  const query = new URLSearchParams({ tmdb_id: tmdb, season: String(season), episode: String(episode), details: 'true', merge_unknown: 'false', mapping: 'official' });
  if (options.duration) query.set('duration_ms', String(Math.round(options.duration * 1000)));
  const data = await read('https://api.theintrodb.org/v4/media?' + query);
  marker = introDbCredits(data, season, episode, options.duration ?? Number(data?.group_duration_ms) / 1000);
  const apiKey = options.tmdbApiKey ?? process.env.TMDB_API_KEY;
  if (!marker && apiKey && !options.signal.aborted) {
    const identities = await read(`https://api.themoviedb.org/3/tv/${tmdb}/external_ids?api_key=${encodeURIComponent(apiKey)}`);
    const imdb = identities?.imdb_id;
    if (typeof imdb === 'string' && /^tt\d{7,10}$/.test(imdb)) {
      const params = new URLSearchParams({ imdb_id: imdb, season: String(season), episode: String(episode) });
      const community = await read('https://api.introdb.app/segments?' + params);
      marker = communityCredits(community, imdb, season, episode, options.duration ?? Number(community?.outro?.end_sec));
      if (!marker && options.includeSkipDb && options.duration && !options.signal.aborted) {
        params.set('duration', String(options.duration)); params.set('adjust', 'none');
        marker = skipDbCredits(await read('https://api.skipdb.tv/api/segments?' + params), imdb, season, episode, options.duration);
      }
    } else if (!identities) incomplete = true;
  } else if (!marker && !apiKey) incomplete = true;
  return { marker, incomplete };
}
