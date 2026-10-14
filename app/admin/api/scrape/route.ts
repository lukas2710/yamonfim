import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL valide requise' }, { status: 400 });
    }

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    if (!res.ok) {
      return NextResponse.json({ error: \Impossible de charger la page (Statut: \)\ }, { status: 400 });
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    let rawSrc =
      iframe.first().attr('src') ||
      video source.first().attr('src') ||
      video.first().attr('src');

    if (!rawSrc) {
      return NextResponse.json({ error: 'Aucun lecteur vidéo trouvé sur la page source' }, { status: 404 });
    }

    let embedUrl = rawSrc.trim();
    if (embedUrl.startsWith('//')) {
      embedUrl = 'https:' + embedUrl;
    } else if (embedUrl.startsWith('/')) {
      const parsedUrl = new URL(url);
      embedUrl = \\\\;
    }

    return NextResponse.json({ embedUrl });
  } catch (err: any) {
    console.error('Erreur Scrape:', err);
    return NextResponse.json({ error: err.message || 'Erreur lors du scraping de la page' }, { status: 500 });
  }
}
