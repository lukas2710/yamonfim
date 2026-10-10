import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as cheerio from 'cheerio';

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: mediaList, error } = await supabase
      .from('media')
      .select('*');

    if (error || !mediaList) {
      return new NextResponse('#EXTM3U\n', {
        status: 200,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }

    let m3uContent = '#EXTM3U\n';

    for (const item of mediaList) {
      const group = item.type === 'movie' ? 'Films' : 'Séries';
      const poster = item.poster || '';
      const title = item.title || 'Titre inconnu';
      let directUrl = item.url || '';

      // Si l'URL stockée est une page web ou nécessite une extraction Cheerio
      if (directUrl && !directUrl.endsWith('.mp4') && !directUrl.endsWith('.m3u8')) {
        try {
          const response = await fetch(directUrl);
          const html = await response.text();
          const $ = cheerio.load(html);
          
          // Adapte ce sélecteur selon la structure de la page source que tu scrapes
          const extracted = $('video source').attr('src') \vert{}\vert{}$('iframe').attr('src');
          if (extracted) {
            directUrl = extracted;
          }
        } catch {
          // Garde l'URL originale si l'extraction échoue
        }
      }

      m3uContent += `#EXTINF:-1 tvg-logo="${poster}" group-title="${group}",${title}\n`;
      m3uContent += `${directUrl}\n`;
    }

    return new NextResponse(m3uContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    console.error(err);
    return new NextResponse('#EXTM3U\n', {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}