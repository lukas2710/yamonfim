export interface CreditsMarker { start: number; duration: number; referenceDuration?: number; source: 'TheIntroDB' | 'IntroDB' | 'SkipDB' | 'admin' }
// Small muxing/padding differences occur even for the same episode release.
export const CREDITS_DURATION_TOLERANCE = 10;
const validDuration = (duration: number) => Number.isFinite(duration) && duration >= 300 && duration <= 28800;
export function compatibleCredits(start: unknown, referenceDuration: unknown, duration: number) {
  return typeof start === 'number' && Number.isFinite(start) && typeof referenceDuration === 'number' && Number.isFinite(referenceDuration)
    && validDuration(duration) && Math.abs(referenceDuration - duration) <= CREDITS_DURATION_TOLERANCE
    && start >= duration * .7 && start < duration && duration - start <= 900;
}
export function playbackCreditsMarker(marker: CreditsMarker | null, duration: number): CreditsMarker | null {
  if (!marker) return null;
  if (!Number.isFinite(duration) || duration <= 0 || !Number.isFinite(marker.start) || marker.start < 0 || marker.start >= duration) return null;
  // TV 2.4.1 compares marker.duration to the player clock within two seconds.
  // Apply the timestamp shown in administration on the actual playback clock.
  // Keep its reference duration for provenance, without rejecting a saved time.
  return { ...marker, referenceDuration: marker.referenceDuration ?? marker.duration, duration };
}
export function introDbCredits(payload: unknown, season: number, episode: number, duration: number): CreditsMarker | null {
  const data = payload as { type?: string; season?: number; episode?: number; group_duration_ms?: number; credits?: { start_ms?: number; end_ms?: number | null; confidence?: number }[] } | null;
  if (data?.type !== 'tv' || data.season !== season || data.episode !== episode || !Array.isArray(data.credits)) return null;
  const reference = typeof data.group_duration_ms === 'number' ? data.group_duration_ms / 1000 : NaN;
  // Only the final, open-ended credits segment: never skip an intervening scene.
  const segment = [...data.credits].filter(item => item && item.end_ms === null && typeof item.start_ms === 'number' && typeof item.confidence === 'number' && item.confidence >= .8).sort((a, b) => b.start_ms! - a.start_ms!)[0];
  const start = segment?.start_ms === undefined ? NaN : segment.start_ms / 1000;
  return compatibleCredits(start, reference, duration) ? { start, duration: reference, source: 'TheIntroDB' } : null;
}
export function communityCredits(payload: unknown, imdb: string, season: number, episode: number, duration: number): CreditsMarker | null {
  const data = payload as { imdb_id?: string; media_type?: string; season?: number; episode?: number; no_outro?: boolean; post_credits?: unknown; outro?: { start_sec?: number; end_sec?: number; confidence?: number } } | null;
  if (data?.imdb_id !== imdb || data.media_type !== 'tv' || data.season !== season || data.episode !== episode || data.no_outro || data.post_credits) return null;
  const marker = data.outro;
  if (typeof marker?.confidence !== 'number' || marker.confidence < .9 || !compatibleCredits(marker.start_sec, marker.end_sec, duration)) return null;
  return { start: marker.start_sec!, duration: marker.end_sec!, source: 'IntroDB' };
}
export function reachedEpisodeCredits(currentTime: number, duration: number, marker: CreditsMarker | null) {
  return !!marker && compatibleCredits(marker.start, marker.duration, duration) && Number.isFinite(currentTime) && currentTime >= marker.start && currentTime <= duration;
}
export function skipDbCredits(payload: unknown, imdb: string, season: number, episode: number, duration: number): CreditsMarker | null {
  const data = payload as { imdb_id?: string; season?: number; episode?: number; segments?: { preview?: unknown; outro?: { start_ms?: number; end_ms?: number; confidence?: number; match?: string } } } | null;
  const segment = data?.segments?.outro;
  if (data?.imdb_id !== imdb || data.season !== season || data.episode !== episode || data.segments?.preview || segment?.match !== 'exact' || typeof segment.confidence !== 'number' || segment.confidence < .8) return null;
  const start = typeof segment.start_ms === 'number' ? segment.start_ms / 1000 : NaN;
  const end = typeof segment.end_ms === 'number' ? segment.end_ms / 1000 : NaN;
  return compatibleCredits(start, end, duration) ? { start, duration: end, source: 'SkipDB' } : null;
}
export function episodeCreditsDecision(currentTime: number, duration: number, marker: CreditsMarker | null, paused: boolean, offered: boolean, hasNext: boolean) {
  if (offered || !hasNext || !Number.isFinite(currentTime) || currentTime < 0 || !Number.isFinite(duration) || duration < 60 || currentTime > duration) return { advance: false, countdown: null };
  // Show the existing five-second notice when credits begin.
  const usable = playbackCreditsMarker(marker, duration);
  const target = usable
    ? Math.min(usable.start + 5, duration) : duration - 30;
  const remaining = target - currentTime;
  return { advance: !paused && currentTime >= target, countdown: remaining > 0 && remaining <= 5 ? Math.ceil(remaining) : null };
}
