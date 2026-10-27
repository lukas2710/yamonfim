import { NextResponse } from 'next/server';
import { fetchEpisodeCredits } from '@/lib/episode-credits-providers';
import { storedCredits, storeCredits } from '@/lib/episode-credits-store';
import { playbackCreditsMarker } from '@/lib/episode-credits';

// Public catalogue metadata only. No viewing history, account IDs or tokens are
// sent to either timestamp provider. Their failure must never block playback.
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const tmdb = params.get('tmdb') || '';
  const media = params.get('media') || '';
  const season = Number(params.get('season')), episode = Number(params.get('episode')), duration = Number(params.get('duration'));
  if ((!/^[1-9]\d{0,9}$/.test(tmdb) && !/^[\w-]{1,100}$/.test(media)) || !Number.isInteger(season) || season < 1 || season > 1000 || !Number.isInteger(episode) || episode < 1 || episode > 10000 || !Number.isFinite(duration) || duration < 300 || duration > 28800) {
    return NextResponse.json({ error: 'Épisode ou durée invalide' }, { status: 400 });
  }
  const keys = [...(media ? [`media:${media}`] : []), ...(tmdb ? [`tmdb:${tmdb}`] : [])];
  const stored = await storedCredits(keys, season, episode, duration);
  if (stored.hit) return NextResponse.json({ marker: playbackCreditsMarker(stored.marker, duration), cached: true }, { headers: { 'Cache-Control': 'no-store' } });
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(20000)]);
  const { marker, incomplete } = await fetchEpisodeCredits(tmdb, season, episode, { duration, signal, includeSkipDb: true });
  // Record every attempted lookup so the admin page no longer calls it unverified.
  // Transient service failures expire after a minute and are retried on next playback.
  const saved = await storeCredits(tmdb ? `tmdb:${tmdb}` : keys[0], season, episode, duration, marker, incomplete);
  return NextResponse.json({ marker: playbackCreditsMarker(marker, duration), cached: false, saved, incomplete }, { headers: { 'Cache-Control': 'no-store' } });
}
