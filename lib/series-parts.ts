interface Episode { number: number; sourcePosition?: { s: number; e: number } }
interface Season<E extends Episode> { seasonNumber: number; episodes: E[] }
export function isLupin(item: { title?: string; tmdb_id?: unknown }) { return String(item.tmdb_id || '') === '96677' || /^lupin(?:\s*\(\d{4}\))?$/i.test(item.title || ''); }
export function normalizeSeriesParts<E extends Episode, S extends Season<E>, T extends { title?: string; tmdb_id?: unknown; seasons?: S[] | null }>(item: T): T {
  if (!isLupin(item) || !item.seasons || item.seasons.length !== 3 || item.seasons[0].episodes.length !== 10) return item;
  const originals = item.seasons.map((season, s) => ({ ...season, episodes: season.episodes.map((episode, e) => ({ ...episode, sourcePosition: episode.sourcePosition || { s, e } })) }));
  const first = originals[0];
  const parts = [
    { ...first, seasonNumber: 1, episodes: first.episodes.slice(0, 5) },
    { ...first, seasonNumber: 2, episodes: first.episodes.slice(5) },
    { ...originals[1], seasonNumber: 3 }, { ...originals[2], seasonNumber: 4 },
  ].map(season => ({ ...season, episodes: season.episodes.map((episode, e) => ({ ...episode, number: e + 1 })) }));
  return { ...item, seasons: parts } as T;
}
export function displayToStored(item: { seasons?: Season<Episode>[] | null }, s: number, e: number) {
  return item.seasons?.[s]?.episodes[e]?.sourcePosition || { s, e };
}
export function storedToDisplay(item: { seasons?: Season<Episode>[] | null }, s: number, e: number) {
  for (const [si, season] of (item.seasons || []).entries()) for (const [ei, episode] of season.episodes.entries()) {
    if (episode.sourcePosition?.s === s && episode.sourcePosition.e === e) return { s: si, e: ei };
  }
  return { s, e };
}
export function remapWatchedKey(item: { seasons?: Season<Episode>[] | null }, key: string, direction: 'display' | 'stored') {
  const match = key.match(/^s(\d+)_e(\d+)$/);
  if (!match) return key;
  const position = (direction === 'display' ? storedToDisplay : displayToStored)(item, Number(match[1]), Number(match[2]));
  return `s${position.s}_e${position.e}`;
}
