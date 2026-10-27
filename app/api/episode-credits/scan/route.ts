import { NextResponse } from 'next/server';
import { adminDatabase, userFromRequest } from '@/lib/stripe-server';
import { fetchEpisodeCredits } from '@/lib/episode-credits-providers';
import { storeCredits } from '@/lib/episode-credits-store';
import { creditsTmdb } from '@/lib/credits-identity';

export const maxDuration = 30;
export async function POST(request: Request) {
  const headers = { 'Cache-Control': 'no-store' };
  const user = await userFromRequest(request);
  if (!user || user.email !== 'lukas.leclerc312@gmail.com') return NextResponse.json({ error: 'Accès administrateur requis.' }, { status: 403, headers });
  try {
    const body = await request.json();
    const season = Number(body.season), episode = Number(body.episode);
    if (!/^[\w-]{1,100}$/.test(String(body.mediaId || '')) || !Number.isInteger(season) || season < 1 || season > 1000 || !Number.isInteger(episode) || episode < 1 || episode > 10000) return NextResponse.json({ error: 'Épisode invalide.' }, { status: 400, headers });
    const db = adminDatabase();
    // Read the catalogue only. This endpoint writes exclusively episode_credits.
    const { data: media, error } = await db.from('media').select('id,type,tmdb_id,seasons').eq('id', body.mediaId).maybeSingle();
    if (error) throw error;
    const selectedSeason = (media?.seasons as { seasonNumber: number; episodes: { number: number; embedUrl?: string; runtime?: number }[] }[] | undefined)?.find(item => item.seasonNumber === season);
    const selectedEpisode = selectedSeason?.episodes.find(item => item.number === episode);
    if (media?.type !== 'series' || !selectedEpisode) return NextResponse.json({ error: 'Épisode absent du catalogue.' }, { status: 404, headers });
    const tmdb = creditsTmdb(media, selectedEpisode.embedUrl);
    const key = tmdb ? `tmdb:${tmdb}` : `media:${media.id}`;
    const { data: existing, error: lookupError } = await db.from('episode_credits').select('*').in('episode_key', [key, `media:${media.id}`]).eq('season', season).eq('episode', episode);
    if (lookupError) throw lookupError;
    const fresh = existing?.find(row => row.source === 'admin') || existing?.find(row => row.expires_at && Date.parse(row.expires_at) > Date.now() && row.source !== 'missing') || existing?.find(row => row.expires_at && Date.parse(row.expires_at) > Date.now());
    if (fresh) return NextResponse.json({ record: fresh, cached: true }, { headers });
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(20000)]);
    // Bulk import uses the provider's own release duration, never an estimated
    // catalogue runtime. Playback later checks it against the actual video.
    const { marker, incomplete } = await fetchEpisodeCredits(tmdb, season, episode, { signal });
    const duration = marker?.duration ?? Math.max(300, Math.min(28800, (Number(selectedEpisode.runtime) || 45) * 60));
    const saved = await storeCredits(key, season, episode, duration, marker, incomplete);
    if (!saved) return NextResponse.json({ error: 'Le minutage n’a pas pu être enregistré dans Supabase.' }, { status: 503, headers });
    const { data: record, error: readError } = await db.from('episode_credits').select('*').eq('episode_key', key).eq('season', season).eq('episode', episode).eq('duration_ms', Math.round(duration * 1000)).single();
    if (readError) throw readError;
    return NextResponse.json({ record, cached: false, incomplete }, { headers });
  } catch { return NextResponse.json({ error: 'Scan indisponible. Réessaie dans un instant.' }, { status: 502, headers }); }
}
