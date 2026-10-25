export function playerTime(value: number): string {
  const seconds = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  const hours = Math.floor(seconds / 3600);
  return `${hours ? `${hours}:` : ''}${String(Math.floor(seconds / 60) % 60).padStart(hours ? 2 : 1, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}
export function playerSeek(value: number, duration: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(duration) || duration <= 0) return 0;
  return Math.max(0, Math.min(value, duration));
}

export interface PlayerAudioTrack { id: number; name: string; lang: string }
export function normalizedAudioLanguage(value: string): string {
  const language = value.trim().toLowerCase().split(/[-_]/)[0];
  return ({ fra: 'fr', fre: 'fr', eng: 'en', deu: 'de', ger: 'de', spa: 'es', ita: 'it', jpn: 'ja' } as Record<string, string>)[language] || language;
}
export function preferredAudioTrack(tracks: PlayerAudioTrack[], language: string): number | null {
  if (!language) return null;
  const preferred = normalizedAudioLanguage(language);
  return tracks.find(track => normalizedAudioLanguage(track.lang) === preferred)?.id ?? null;
}
export function frenchFirstAudioTracks(tracks: PlayerAudioTrack[]): PlayerAudioTrack[] {
  return [...tracks].sort((a, b) => Number(normalizedAudioLanguage(b.lang) === 'fr') - Number(normalizedAudioLanguage(a.lang) === 'fr'));
}
export function audioTrackLabel(track: PlayerAudioTrack): string {
  if (track.name) return track.name;
  try { return new Intl.DisplayNames(['fr'], { type: 'language' }).of(normalizedAudioLanguage(track.lang)) || `Piste ${track.id + 1}`; }
  catch { return `Piste ${track.id + 1}`; }
}
