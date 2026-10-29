export const MAX_SOURCE_EMBEDS = 40;
export const MAX_EXTRA_LINKS = 10;
// extras: links added by hand in the admin, always offered in the player's source menu.
export interface CatalogueSource { id: string; type: 'movie' | 'tv'; season: number; episode: number; embeds?: string[]; extras?: string[] }
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
  const extras = uniqueEmbeds(url.searchParams.getAll('extra')).filter(isSupportedEmbed).slice(0, MAX_EXTRA_LINKS);
  return { id, type: type as 'movie' | 'tv', season, episode, ...(embeds.length ? { embeds } : {}), ...(extras.length ? { extras } : {}) };
}
export function cataloguePlayer(source: CatalogueSource) {
  const params = new URLSearchParams({ tmdb: source.id, type: source.type, season: String(source.season), episode: String(source.episode) });
  for (const embed of uniqueEmbeds(source.embeds || [])) params.append('embed', embed);
  for (const extra of uniqueEmbeds(source.extras || []).filter(isSupportedEmbed).slice(0, MAX_EXTRA_LINKS)) params.append('extra', extra);
  return `/api/catalogue-player?${params}`;
}

function storedSource(stored: string, fallback?: CatalogueSource): CatalogueSource | null {
  const src = stored.match(/<iframe[^>]*\ssrc=["']([^"']+)["']/i)?.[1]?.replace(/&amp;/g, '&') ?? stored.trim();
  if (!src) return fallback ? { ...fallback } : null;
  if (isSupportedEmbed(src)) return fallback ? { ...fallback, extras: [src] } : null;
  try { return catalogueSource(src); } catch { return null; }
}
export function extraLinks(stored: string) {
  return storedSource(stored)?.extras || [];
}
// Returns the new stored player URL, or null when the main link cannot carry extra sources.
export function withExtraLink(stored: string, link: string, fallback?: CatalogueSource) {
  const source = storedSource(stored, fallback), extra = link.trim();
  if (!source || !isSupportedEmbed(extra)) return null;
  return cataloguePlayer({ ...source, extras: [...(source.extras || []).filter(value => value !== extra), extra] });
}
export function withoutExtraLink(stored: string, link: string) {
  const source = storedSource(stored);
  return source ? cataloguePlayer({ ...source, extras: (source.extras || []).filter(value => value !== link) }) : stored;
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
