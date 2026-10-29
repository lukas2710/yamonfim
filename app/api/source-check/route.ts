import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseUrl, supabaseAnonKey } from '@/lib/supabase';
import { catalogueSource, cataloguePlayer, isSupportedEmbed, type CatalogueSource } from '@/lib/catalogue-source';
import * as cheerio from 'cheerio';
import { resolveCatalogueStream, resolveEmbed, discoverCatalogueSource, embedOriginDuration, EXTRA_PROVIDER } from '@/lib/catalogue-stream';
import { fetchEpisodeCredits } from '@/lib/episode-credits-providers';
import { storedCredits, storeCredits } from '@/lib/episode-credits-store';

// While a series is extracted, time its final credits for the exact lengths of the
// collected releases, so the next episode starts at the right moment from the
// first viewing. Returns the credits start times found; never fails the check.
async function prefetchCredits(source: CatalogueSource, signal: AbortSignal) {
  if (source.type !== 'tv') return [];
  const deadline = AbortSignal.any([signal, AbortSignal.timeout(12000)]);
  const embeds = [...(source.extras || []), ...(source.embeds || [])].filter(isSupportedEmbed).slice(0, 3);
  const durations = (await Promise.all(embeds.map(embed => embedOriginDuration(embed, deadline).catch(() => null))))
    .filter((value): value is number => value !== null)
    .filter((value, index, all) => all.findIndex(other => Math.abs(other - value) <= 10) === index);
  const key = `tmdb:${source.id}`;
  const found = await Promise.all(durations.map(async duration => {
    try {
      const stored = await storedCredits([key], source.season, source.episode, duration);
      if (stored.hit) return stored.marker?.start ?? null;
      const { marker, incomplete } = await fetchEpisodeCredits(source.id, source.season, source.episode, { duration, signal: deadline });
      await storeCredits(key, source.season, source.episode, duration, marker, incomplete);
      return marker?.start ?? null;
    } catch { return null; }
  }));
  return found.filter((value): value is number => value !== null);
}

export const runtime = 'nodejs';
export async function POST(request: Request) {
  const headers = { 'Cache-Control': 'no-store' };
  try {
    const token = request.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1];
    if (!token) return NextResponse.json({ error: 'Connexion requise' }, { status: 401, headers });
    const auth = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await auth.auth.getUser(token);
    if (error || !data.user) return NextResponse.json({ error: 'Session expirée' }, { status: 401, headers });
    const body = await request.json();
    let input = typeof body.url === 'string' ? body.url.trim() : '';
    if (!input || input.length > 250000) return NextResponse.json({ available: false }, { headers });
    if (input.includes('<iframe')) input = cheerio.load(input)('iframe').first().attr('src') || '';
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(55000)]);
    let source;
    try { source = catalogueSource(input); } catch { source = null; }
    try {
      // Check extraction now, but store only the stable embed/reference, never
      // its signed temporary stream. Resolve a fresh stream at playback.
      if (source) {
        const collected = await discoverCatalogueSource(source, signal);
        const stream = await resolveCatalogueStream(collected, [], signal).catch(async error => {
          // A hand-added link is enough when Moviez and Movix have nothing.
          for (const extra of collected.extras || []) {
            try { await resolveEmbed(extra, signal); return { embed: extra, provider: EXTRA_PROVIDER }; } catch { if (signal.aborted) break; }
          }
          throw error;
        });
        const credits = await prefetchCredits(collected, signal);
        return NextResponse.json({ available: true, url: cataloguePlayer(collected), embed: stream.embed, embeds: collected.embeds, provider: stream.provider, streamVerified: true, credits }, { headers });
      }
      if (!isSupportedEmbed(input)) return NextResponse.json({ available: false }, { headers });
      await resolveEmbed(input, signal);
      return NextResponse.json({ available: true, url: input, embed: input, provider: 'EmbedOrigin', streamVerified: true }, { headers });
    } catch {
      return NextResponse.json({ available: false, error: 'Aucun lien compatible disponible : aucun flux HLS vérifié.' }, { headers });
    }
  } catch { return NextResponse.json({ error: 'Impossible de vérifier les sources. Réessaie.' }, { status: 502, headers }); }
}
