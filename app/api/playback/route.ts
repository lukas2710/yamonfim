import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseUrl, supabaseAnonKey } from '@/lib/supabase';
import { catalogueSource, isSupportedEmbed, MAX_SOURCE_EMBEDS, primaryEmbed } from '@/lib/catalogue-source';
import { resolveBestCatalogueStream, resolveEmbed, CatalogueStreamError, discoverCatalogueSource } from '@/lib/catalogue-stream';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const headers = { 'Cache-Control': 'no-store' };
  try {
    const token = request.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1];
    if (!token) return NextResponse.json({ error: 'Connecte-toi pour lancer la lecture.' }, { status: 401, headers });
    const auth = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: { user }, error } = await auth.auth.getUser(token);
    if (error || !user) return NextResponse.json({ error: 'Session expirée. Reconnecte-toi.' }, { status: 401, headers });
    const body = await request.json().catch(() => null);
    let source;
    try { source = isSupportedEmbed(body?.url) ? body.url as string : catalogueSource(body?.url); }
    catch { return NextResponse.json({ error: 'Lecteur non pris en charge.' }, { status: 400, headers }); }
    const excluded = Array.isArray(body?.excluded) ? body.excluded.filter((value: unknown) => typeof value === 'string' && value.length <= 4096).slice(0, MAX_SOURCE_EMBEDS) : [];
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(55000)]);
    if (typeof body?.selected === 'string' && body.selected) {
      const collected = typeof source === 'string' ? null : source.embeds?.length ? source : await discoverCatalogueSource(source, signal);
      const allowed = collected ? [primaryEmbed(collected), ...(collected.embeds || [])] : [source];
      if (!allowed.includes(body.selected) || !(isSupportedEmbed(body.selected) || (typeof source !== 'string' && body.selected === primaryEmbed(source)))) return NextResponse.json({ error: 'Source non disponible pour ce titre.' }, { status: 400, headers });
      const stream = await resolveEmbed(body.selected, signal);
      return NextResponse.json({ url: `/api/proxy/stream.m3u8?url=${encodeURIComponent(stream.url)}`, audioTracks: stream.audioTracks, embed: body.selected, provider: new URL(body.selected).hostname, quality: stream.quality }, { headers });
    }
    const stream = typeof source === 'string'
      ? { ...await resolveEmbed(source, signal), embed: source, provider: 'EmbedOrigin' }
      : await resolveBestCatalogueStream(source, excluded, signal);
    return NextResponse.json({ url: `/api/proxy/stream.m3u8?url=${encodeURIComponent(stream.url)}`, audioTracks: stream.audioTracks, embed: stream.embed, provider: stream.provider, quality: stream.quality, alternatives: 'alternatives' in stream ? stream.alternatives : [{ embed: stream.embed, provider: stream.provider, quality: stream.quality }] }, { headers });
  } catch (error) {
    if (error instanceof CatalogueStreamError) return NextResponse.json({ error: error.message, attempted: error.attempted, hasMore: error.hasMore }, { status: 502, headers });
    return NextResponse.json({ error: 'Le flux vidéo est indisponible ou ne correspond pas au contenu. Réessaie dans un instant.' }, { status: 502, headers });
  }
}
