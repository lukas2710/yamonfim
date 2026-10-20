import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { fetchPublicRemote, readRemoteText } from '@/lib/public-remote';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);

    if (!body || !body.url) {
      return NextResponse.json(
        { success: false, error: 'URL manquante dans la requête.' },
        { status: 400 }
      );
    }

    const { url } = body;

    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { success: false, error: 'L URL fournie est invalide.' },
        { status: 400 }
      );
    }

    const { response, url: finalUrl } = await fetchPublicRemote(url, AbortSignal.timeout(8000), { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'fr-FR,fr;q=0.9' });

    if (response.status !== 200) {
      await response.body?.cancel();
      return NextResponse.json(
        {
          success: false,
          error: `Le site cible refuse l acces (Code HTTP: ${response.status}).`,
        },
        { status: 400 }
      );
    }

    const html = await readRemoteText(response, 5_000_000);
    const $ = cheerio.load(html);

    const iframeSrc = $('iframe').first().attr('src');
    const sourceSrc = $('video source').first().attr('src');
    const videoSrc = $('video').first().attr('src');

    const rawSrc = iframeSrc ? iframeSrc : sourceSrc ? sourceSrc : videoSrc;

    if (!rawSrc) {
      return NextResponse.json(
        { success: false, error: 'Aucun lecteur vidéo ou iframe trouvé sur cette page.' },
        { status: 404 }
      );
    }

    const resolved = new URL(rawSrc, finalUrl);
    if (!['http:', 'https:'].includes(resolved.protocol)) throw new Error('Lecteur invalide');
    const videoUrl = resolved.href;

    return NextResponse.json({ success: true, videoUrl });
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: 'Erreur lors du scraping de la page.',
      },
      { status: 500 }
    );
  }
}
