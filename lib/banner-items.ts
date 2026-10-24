// A banner entry is a media id ("156") or a single season of a series ("156:s3").
export interface BannerEntry { mediaId: string; season: number | null }
export interface SeasonSummary { seasonNumber?: number; poster_path?: string; episodes?: unknown[] }

export function parseBannerEntry(value: unknown): BannerEntry {
  const text = String(value ?? '');
  const match = /^(.+):s(\d+)$/.exec(text);
  return match ? { mediaId: match[1], season: Number(match[2]) } : { mediaId: text, season: null };
}

export const bannerEntry = (mediaId: string | number, season: number | null = null) => season === null ? String(mediaId) : `${mediaId}:s${season}`;

// Seasons are stored in order but may skip numbers: look the season up by its number.
export function findSeason(seasons: SeasonSummary[] | null | undefined, seasonNumber: number) {
  if (!Array.isArray(seasons)) return null;
  const index = seasons.findIndex((s, i) => (s.seasonNumber ?? i + 1) === seasonNumber);
  return index < 0 ? null : { index, season: seasons[index] };
}
