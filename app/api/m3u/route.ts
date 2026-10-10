import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  const { data: mediaList, error } = await supabase
    .from('media')
    .select('*')
    .order('created_at', { ascending: false });

  if (error || !mediaList) {
    return new NextResponse('#EXTM3U\n', {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  let m3uContent = '#EXTM3U\n';

  mediaList.forEach((item) => {
    const group = item.type === 'movie' ? 'Films' : 'Séries';
    const poster = item.poster || '';
    const title = item.title || 'Titre inconnu';
    const streamUrl = item.url || '';

    m3uContent += `#EXTINF:-1 tvg-logo="${poster}" group-title="${group}",${title}\n`;
    m3uContent += `${streamUrl}\n`;
  });

  return new NextResponse(m3uContent, {
    status: 200,
    headers: {
      'Content-Type': 'audio/x-mpegurl; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
    },
  });
}