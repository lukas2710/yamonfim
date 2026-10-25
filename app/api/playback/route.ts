import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseUrl, supabaseAnonKey } from '@/lib/supabase';
import { moviezPlayerUrl } from '@/lib/moviez-player';
import { resolveMoviezStream } from '@/lib/moviez-stream';

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
    let source: string;
    try { source = moviezPlayerUrl(body?.url); }
    catch { return NextResponse.json({ error: 'Lecteur non pris en charge.' }, { status: 400, headers }); }
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(30000)]);
    const stream = await resolveMoviezStream(source, signal);
    return NextResponse.json({ url: `/api/proxy/stream.m3u8?url=${encodeURIComponent(stream.url)}`, audioTracks: stream.audioTracks }, { headers });
  } catch {
    return NextResponse.json({ error: 'Le flux vidéo est indisponible ou ne correspond pas au contenu. Réessaie dans un instant.' }, { status: 502, headers });
  }
}
