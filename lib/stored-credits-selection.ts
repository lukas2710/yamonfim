import { playbackCreditsMarker, type CreditsMarker } from './episode-credits';

export interface StoredCreditsRow {
  start_sec: number | null; duration_ms: number;
  source: CreditsMarker['source'] | 'missing'; expires_at: string | null;
}
export function selectStoredCredits(rows: StoredCreditsRow[], duration: number, now: number) {
  // Same priority as the admin list: manual, then the first available automatic
  // timestamp. A different runtime must not silently replace it with 30 seconds.
  const manual = rows.find(row => row.source === 'admin');
  const automatic = rows.find(row => row.source !== 'admin' && row.source !== 'missing' && row.start_sec !== null && row.expires_at && Date.parse(row.expires_at) > now);
  const selected = manual || automatic;
  if (selected && selected.source !== 'missing') {
    const marker = playbackCreditsMarker({ start: selected.start_sec!, duration: selected.duration_ms / 1000, source: selected.source }, duration);
    return { marker, hit: true };
  }
  const missing = rows.some(row => row.source === 'missing' && Math.abs(row.duration_ms / 1000 - duration) <= 2 && row.expires_at && Date.parse(row.expires_at) > now);
  return { marker: null, hit: missing };
}
