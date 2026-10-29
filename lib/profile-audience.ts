export type ProfileMode = 'standard' | 'kids' | 'junior';
export type Audience = { audience?: string | null; release_year?: number | null; title?: string; genres?: string[] | null };
// An age rating alone is not enough: « Tous publics » also covers adult dramas.
// Kids and Junior only show titles made for children (TMDB genres in French).
// Mangas lose « Animation », so one counts only when also Familial or Kids.
export const CHILDREN_GENRES = ['Animation', 'Familial', 'Kids'];
export const isChildrenTitle = (item: Audience) => !!item.genres?.some(genre => CHILDREN_GENRES.includes(genre));
export function canWatch(item: Audience, mode: string = 'standard') {
  if (mode === 'standard') return true;
  if (!isChildrenTitle(item)) return false;
  return item.audience === 'kids' || (mode === 'junior' && item.audience === 'junior');
}
export function releaseYear(item: Audience): number | null {
  if (item.release_year && item.release_year >= 1888 && item.release_year <= 2100) return item.release_year;
  const match = /\((18\d{2}|19\d{2}|20\d{2}|2100)\)\s*$/.exec(item.title || '');
  return match ? Number(match[1]) : null;
}
