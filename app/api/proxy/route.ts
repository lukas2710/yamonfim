import { NextRequest, NextResponse } from 'next/server';
import { fetchPublicRemote, readRemoteText } from '@/lib/public-remote';
import { rewritePlaylist, selectHlsAudio, selectTvHls } from '@/lib/remote-stream';

export async function GET(req: NextRequest) {
  const target = req.nextUrl.searchParams.get('url');
  if (!target) return new NextResponse('URL manquante', { status: 400 });
  try {
    const headers: Record<string, string> = { 'User-Agent': 'Mozilla/5.0' };
    const range = req.headers.get('range');
    if (range) headers.Range = range;
    const { response, url } = await fetchPublicRemote(target, AbortSignal.any([req.signal, AbortSignal.timeout(15000)]), headers);
    if (!response.ok) { await response.body?.cancel(); return new NextResponse('Flux distant inaccessible', { status: 502 }); }
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const playlist = /mpegurl/i.test(contentType) || /\.m3u8?$/i.test(url.pathname);
    if (playlist) {
      const text = await readRemoteText(response, 2_000_000);
      if (text.length > 2_000_000 || !text.trimStart().startsWith('#EXTM3U')) return new NextResponse('Liste de lecture invalide', { status: 502 });
      const audio = req.nextUrl.searchParams.get('audio') || '';
      const tv = req.nextUrl.searchParams.get('profile') === 'android-tv';
      return new NextResponse(rewritePlaylist(selectHlsAudio(tv ? selectTvHls(text) : text, audio), url.href, tv), { headers: { 'Content-Type': 'application/vnd.apple.mpegurl', 'Cache-Control': 'no-store' } });
    }
    if (!/^(video\/|audio\/|application\/(octet-stream|mp4|vnd\.apple\.mpegurl|x-mpegurl))/i.test(contentType)) {
      await response.body?.cancel();
      return new NextResponse('Format de flux non accepté', { status: 415 });
    }
    const outgoing = new Headers({ 'Content-Type': contentType, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox" });
    for (const key of ['content-range', 'accept-ranges']) { const value = response.headers.get(key); if (value) outgoing.set(key, value); }
    return new NextResponse(response.body, { status: response.status, headers: outgoing });
  } catch {
    return new NextResponse('Adresse invalide ou flux inaccessible', { status: 502 });
  }
}
