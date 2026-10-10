import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  // Récupération des contenus depuis Supabase
  const { data: mediaList, error } = await supabase
    .from('media')
    .select('*')
    .order('created_at', { ascending: false });

  if (error || !mediaList) {
    return new NextResponse('#EXTM3U\n', {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  // En-tête du fichier M3U
  let m3uContent = '#EXTM3U\n\n';

  // Boucle sur chaque élément pour construire les entrées M3U
  mediaList.forEach((item) => {
    const group = item.type === 'movie' ? 'Films' : 'Séries';
    const poster = item.poster || '';
    const title = item.title || 'Titre inconnu';
    const streamUrl = item.url || '';

    // Balise M3U avec titre, affiche et catégorie
    m3uContent += `#EXTINF:-1 tvg-logo="${poster}" group-title="${group}",${title}\n`;
    m3uContent += `${streamUrl}\n\n`;
  });

  return new NextResponse(m3uContent, {
    headers: {
      'Content-Type': 'audio/x-mpegurl; charset=utf-8',
      'Content-Disposition': 'inline; filename="yamonfim.m3u"',
    },
  });
}