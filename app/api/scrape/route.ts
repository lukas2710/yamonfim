import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import axios from 'axios';

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

    const response = await axios.get(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      timeout: 8000,
      validateStatus: (status) => status < 500,
    });

    if (response.status !== 200) {
      return NextResponse.json(
        {
          success: false,
          error: `Le site cible refuse l acces (Code HTTP: ${response.status}).`,
        },
        { status: 400 }
      );
    }

    const $ = cheerio.load(response.data);

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

    let videoUrl = rawSrc;
    if (videoUrl.startsWith('//')) {
      videoUrl = `https:${videoUrl}`;
    } else if (videoUrl.startsWith('/')) {
      const parsedUrl = new URL(url);
      videoUrl = `${parsedUrl.origin}${videoUrl}`;
    }

    return NextResponse.json({ success: true, videoUrl });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: 'Erreur lors du scraping de la page.',
        details: error?.message || 'Erreur inconnue',
      },
      { status: 500 }
    );
  }
}