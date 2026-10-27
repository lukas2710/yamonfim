import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseUrl, supabaseAnonKey } from '@/lib/supabase';
import { catalogueSource, cataloguePlayer, isSupportedEmbed } from '@/lib/catalogue-source';
import * as cheerio from 'cheerio';
import { resolveCatalogueStream, resolveEmbed, discoverCatalogueSource } from '@/lib/catalogue-stream';

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
        const stream = await resolveCatalogueStream(collected, [], signal);
        return NextResponse.json({ available: true, url: cataloguePlayer(collected), embed: stream.embed, embeds: collected.embeds, provider: stream.provider, streamVerified: true }, { headers });
      }
      if (!isSupportedEmbed(input)) return NextResponse.json({ available: false }, { headers });
      await resolveEmbed(input, signal);
      return NextResponse.json({ available: true, url: input, embed: input, provider: 'EmbedOrigin', streamVerified: true }, { headers });
    } catch {
      return NextResponse.json({ available: false, error: 'Aucun lien compatible disponible : aucun flux HLS vérifié.' }, { headers });
    }
  } catch { return NextResponse.json({ error: 'Impossible de vérifier les sources. Réessaie.' }, { status: 502, headers }); }
}
