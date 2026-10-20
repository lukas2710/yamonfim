export interface EpisodeClock { durationMs: number; elapsedMs: number; startedAt: number | null }
export function episodeDurationSeconds(episodeMinutes?: number, seriesMinutes?: number) {
  const minutes = [episodeMinutes, seriesMinutes, 45].find(value => Number.isFinite(value) && Number(value) > 0)!;
  return Math.round(minutes * 60);
}
export function createEpisodeClock(durationSeconds: number, now: number, elapsedSeconds = 0): EpisodeClock {
  return { durationMs: Math.max(1, durationSeconds) * 1000, elapsedMs: Math.max(0, elapsedSeconds) * 1000, startedAt: now };
}
export function elapsedEpisodeTime(clock: EpisodeClock, now: number) {
  return Math.min(clock.durationMs, clock.elapsedMs + (clock.startedAt === null ? 0 : Math.max(0, now - clock.startedAt)));
}
export function pauseEpisodeClock(clock: EpisodeClock, now: number): EpisodeClock {
  return { ...clock, elapsedMs: elapsedEpisodeTime(clock, now), startedAt: null };
}
export function resumeEpisodeClock(clock: EpisodeClock, now: number): EpisodeClock {
  return clock.startedAt === null ? { ...clock, startedAt: now } : clock;
}
