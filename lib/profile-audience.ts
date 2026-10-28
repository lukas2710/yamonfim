export type ProfileMode = 'standard' | 'kids' | 'junior';
export type Audience = { audience?: string | null; release_year?: number | null; title?: string };
export function canWatch(item: Audience, mode: string = 'standard') {
  if (mode === 'standard') return true;
  return item.audience === 'kids' || (mode === 'junior' && item.audience === 'junior');
}
export function releaseYear(item: Audience): number | null {
  if (item.release_year && item.release_year >= 1888 && item.release_year <= 2100) return item.release_year;
  const match = /\((18\d{2}|19\d{2}|20\d{2}|2100)\)\s*$/.exec(item.title || '');
  return match ? Number(match[1]) : null;
}
