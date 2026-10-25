export interface PlaybackPosition { s: number; e: number }
export function sameEpisode(a: PlaybackPosition | null, b: PlaybackPosition) { return !!a && a.s === b.s && a.e === b.e; }
export function isDirectVideo(value: string) {
  try { return /\.(mp4|webm|ogg|m4v|m3u8)$/i.test(new URL(value, 'https://local.invalid').pathname); } catch { return false; }
}
export function isMoviezPlayer(value: string) {
  try { return new URL(value).hostname === 'api.moviez.ac'; } catch { return false; }
}
export function isNativePlayback(value: string) {
  return isDirectVideo(value) || isMoviezPlayer(value);
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
/** Un film vu à 70 % ou plus quitte « Reprendre ». */
export const RESUME_HIDE_RATIO = 0.7;
export function isMostlyWatched(currentTime: number, duration: number) { return Number.isFinite(currentTime) && Number.isFinite(duration) && duration > 0 && currentTime / duration >= RESUME_HIDE_RATIO; }
export function isCompleted(currentTime: number, duration: number) { return duration > 0 && currentTime / duration >= .95; }

// Without editorial credits markers, use a conservative end window. Short clips
// and unknown/live durations must never trigger early episode advancement.
export function isEpisodeCreditsWindow(currentTime: number, duration: number) {
  if (!Number.isFinite(currentTime) || !Number.isFinite(duration) || duration < 300) return false;
  const creditsWindow = Math.min(90, duration * 0.1);
  return currentTime >= duration - creditsWindow && currentTime <= duration;
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
