import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  try {
    // Initialisation directe pour s'assurer que les clés sont lues côté serveur
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: mediaList, error } = await supabase
      .from('media')
      .select('*');

    if (error) {
      console.error('Erreur Supabase:', error);
      // Renvoie un M3U vide mais valide (200 OK) pour éviter que l'app plante
      return new NextResponse('#EXTM3U\n', {
        status: 200,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }

    let m3uContent = '#EXTM3U\n';

    if (mediaList) {
      mediaList.forEach((item) => {
        const group = item.type === 'movie' ? 'Films' : 'Séries';
        const poster = item.poster || '';
        const title = item.title || 'Titre inconnu';
        const streamUrl = item.url || '';

        m3uContent += `#EXTINF:-1 tvg-logo="${poster}" group-title="${group}",${title}\n`;
        m3uContent += `${streamUrl}\n`;
      });
    }

    return new NextResponse(m3uContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    console.error('Erreur API M3U:', err);
    return new NextResponse('#EXTM3U\n', {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}