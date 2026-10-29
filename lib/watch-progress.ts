import { isCataloguePlayer, isSupportedEmbed } from './catalogue-source';
import { reachedEpisodeCredits, type CreditsMarker } from './episode-credits';
export interface PlaybackPosition { s: number; e: number }
export function sameEpisode(a: PlaybackPosition | null, b: PlaybackPosition) { return !!a && a.s === b.s && a.e === b.e; }
export function isDirectVideo(value: string) {
  try { return /\.(mp4|webm|ogg|m4v|m3u8)$/i.test(new URL(value, 'https://local.invalid').pathname); } catch { return false; }
}
export function isMoviezPlayer(value: string) {
  try { return new URL(value).hostname === 'api.moviez.ac'; } catch { return false; }
}
export function isNativePlayback(value: string) {
  return isDirectVideo(value) || isMoviezPlayer(value) || isCataloguePlayer(value) || isSupportedEmbed(value);
}
export function nextEpisodePosition(seasons: { episodes: unknown[] }[] | undefined, position: PlaybackPosition): PlaybackPosition | null {
  if (!seasons?.[position.s]) return null;
  if (position.e < seasons[position.s].episodes.length - 1) return { s: position.s, e: position.e + 1 };
  for (let s = position.s + 1; s < seasons.length; s++) {
    if (seasons[s]?.episodes?.length) return { s, e: 0 };
  }
  return null;
}
export function playbackProgress(currentTime: number, duration: number) {
  const total = Number.isFinite(duration) && duration > 0 ? duration : 0;
  return { currentTime: Number.isFinite(currentTime) ? Math.max(0, total ? Math.min(currentTime, total) : currentTime) : 0, duration: total };
}
/** Un film quitte « Reprendre » quand il atteint son générique de fin (92 %). */
export const RESUME_HIDE_RATIO = 0.92;
/** Secondes rejouées à la reprise, pour retrouver le fil. */
export const RESUME_REWIND = 5;
export function resumeStart(time: number) { return Number.isFinite(time) && time > 30 ? time - RESUME_REWIND : 0; }
/** Un épisode quitté dans ses deux dernières minutes (ou à 95 %) est considéré comme vu. */
export function episodeFinished(currentTime: number, duration: number) {
  return Number.isFinite(currentTime) && Number.isFinite(duration) && duration > 0 && (currentTime / duration >= .95 || (duration >= 600 && duration - currentTime <= 120));
}
export interface ResumeRow { media_id: unknown; type?: string; current_time?: number | null; duration?: number | null; season_number?: number | null; episode_number?: number | null; updated_at?: string | null }
/** Entrées de « Reprendre », de la plus récente à la plus ancienne, depuis l'historique de lecture. */
export function continueWatchingEntries(rows: ResumeRow[], available: (id: string) => boolean) {
  const entries: { id: string; ratio: number; finished: boolean; seasonNumber: number; episodeNumber: number; series: boolean }[] = [];
  const seen = new Set<string>();
  for (const row of [...rows].sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')))) {
    const id = String(row.media_id), time = Number(row.current_time) || 0, duration = Number(row.duration) || 0;
    if (seen.has(id) || !available(id)) continue;
    const series = row.type === 'series';
    // A movie barely started or already at its credits does not need resuming.
    if (!series && (time < 60 || isMostlyWatched(time, duration))) continue;
    seen.add(id);
    entries.push({ id, series, ratio: duration > 0 ? Math.min(1, time / duration) : 0, finished: series && episodeFinished(time, duration),
      seasonNumber: Number(row.season_number) || 1, episodeNumber: Number(row.episode_number) || 1 });
  }
  return entries;
}
export function isMostlyWatched(currentTime: number, duration: number) { return Number.isFinite(currentTime) && Number.isFinite(duration) && duration > 0 && currentTime / duration >= RESUME_HIDE_RATIO; }
export function isCompleted(currentTime: number, duration: number) { return duration > 0 && currentTime / duration >= .95; }

// Compatibility for older callers; absent precise markers never mean credits.
export function isEpisodeCreditsWindow(currentTime: number, duration: number, marker: CreditsMarker | null = null) {
  return reachedEpisodeCredits(currentTime, duration, marker);
}

export async function commitEpisodeTransition(previous: PlaybackPosition | null, next: PlaybackPosition, markPrevious: (position: PlaybackPosition) => Promise<void>, saveCurrent: () => Promise<void>) {
  if (previous && !sameEpisode(previous, next)) await markPrevious(previous);
  await saveCurrent();
}

export function preparePlayerUrl(value: string, origin: string) {
  const url = new URL(value, origin);
  if (!['http:', 'https:'].includes(url.protocol)) return '';
  if (isDirectVideo(url.href)) return url.href;
  if (url.hostname === 'api.moviez.ac') url.searchParams.set('next', '0');
  url.searchParams.set('autoplay', '1');
  url.searchParams.set('color', 'e8213f');
  return url.href;
}
