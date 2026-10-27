export const MAX_SOURCE_EMBEDS = 40;
export interface CatalogueSource { id: string; type: 'movie' | 'tv'; season: number; episode: number; embeds?: string[] }
// TMDB combines Netflix parts 1+2; Moviez numbers all four parts separately.
export function moviezEpisode(id: string, season: number, episode: number) {
  if (id !== '96677') return { season, episode };
  if (season === 1 && episode > 5 && episode <= 10) return { season: 2, episode: episode - 5 };
  if (season === 2) return { season: 3, episode };
  if (season === 3) return { season: 4, episode };
  return { season, episode };
}
export function canonicalMoviezEpisode(id: string, season: number, episode: number) {
  if (id !== '96677') return { season, episode };
  if (season === 2 && episode <= 5) return { season: 1, episode: episode + 5 };
  if (season === 3) return { season: 2, episode };
  if (season === 4) return { season: 3, episode };
  return { season, episode };
}
export function uniqueEmbeds(values: unknown[]): string[] {
  return [...new Set(values.filter((value): value is string => {
    if (typeof value !== 'string' || value.length > 4096) return false;
    try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password && !url.port; } catch { return false; }
  }))].slice(0, MAX_SOURCE_EMBEDS);
}
export function catalogueSource(value: string): CatalogueSource {
  const url = new URL(value, 'https://local.invalid');
  if (url.hostname === 'api.moviez.ac') {
    const match = url.pathname.match(/^\/(?:serie\/(\d+)\/(\d+)\/(\d+)|(\d+))\/?$/);
    if (!match || url.protocol !== 'https:' || url.username || url.password || url.port) throw new Error('Source invalide');
    const id = match[1] || match[4];
    const position = match[1] ? canonicalMoviezEpisode(id, Number(match[2]), Number(match[3])) : { season: 1, episode: 1 };
    return { id, type: match[1] ? 'tv' : 'movie', ...position };
  }
  if (url.pathname !== '/api/catalogue-player') throw new Error('Source invalide');
  const id = url.searchParams.get('tmdb') || '';
  const type = url.searchParams.get('type');
  const season = Number(url.searchParams.get('season') || 1), episode = Number(url.searchParams.get('episode') || 1);
  if (!/^\d{1,10}$/.test(id) || !['movie', 'tv'].includes(type || '') || !Number.isSafeInteger(season) || season < 1 || season > 1000 || !Number.isSafeInteger(episode) || episode < 1 || episode > 10000) throw new Error('Source invalide');
  const embeds = uniqueEmbeds(url.searchParams.getAll('embed'));
  return { id, type: type as 'movie' | 'tv', season, episode, ...(embeds.length ? { embeds } : {}) };
}
export function cataloguePlayer(source: CatalogueSource) {
  const params = new URLSearchParams({ tmdb: source.id, type: source.type, season: String(source.season), episode: String(source.episode) });
  for (const embed of uniqueEmbeds(source.embeds || [])) params.append('embed', embed);
  return `/api/catalogue-player?${params}`;
}
export function primaryEmbed(source: CatalogueSource) {
  const position = moviezEpisode(source.id, source.season, source.episode);
  return `https://api.moviez.ac/${source.type === 'movie' ? source.id : `serie/${source.id}/${position.season}/${position.episode}`}`;
}
export function isCataloguePlayer(value: string) {
  try { return new URL(value, 'https://local.invalid').pathname === '/api/catalogue-player'; } catch { return false; }
}
export function isSupportedEmbed(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'embedorigin.cc' && !url.port && !url.username && !url.password && /^\/e\/[a-z0-9]{12}\/?$/.test(url.pathname);
  } catch { return false; }
}
