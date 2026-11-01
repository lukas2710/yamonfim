export type TmdbRating = { rating: number; votes: number; anime: boolean };
export type HomeRankings = { at: number; ratings: Record<string, TmdbRating>; trending: { movie: string[]; series: string[] } };
export type RankedTitle = { id: string | number; type: string; tmdb_id?: string | number; genres?: string[]; tmdbAnime?: boolean };
export const tmdbKey = (item: RankedTitle) => `${item.type === 'series' ? 'tv' : 'movie'}:${item.tmdb_id}`;
export const minimumVotes = (type: string) => type === 'series' ? 150 : 300;
export function bestRated<T extends RankedTitle>(items: T[], rankings: HomeRankings | null): T[] {
  if (!rankings) return [];
  return items.filter(item => {
    const score = rankings.ratings[tmdbKey(item)];
    return score && score.rating > 0 && score.votes >= minimumVotes(item.type);
  }).sort((a, b) => {
    const left = rankings.ratings[tmdbKey(a)], right = rankings.ratings[tmdbKey(b)];
    return right.rating - left.rating || right.votes - left.votes || String(a.id).localeCompare(String(b.id));
  });
}
export function weeklyTrending<T extends RankedTitle>(items: T[], rankings: HomeRankings | null, type: 'movie' | 'series'): T[] {
  if (!rankings) return [];
  const order = new Map(rankings.trending[type].map((id, index) => [id, index]));
  return items.filter(item => item.type === type && order.has(String(item.tmdb_id))).sort((a, b) => order.get(String(a.tmdb_id))! - order.get(String(b.tmdb_id))!);
}
