import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const res = await fetch('https://raw.githubusercontent.com/ZeroxarZ/iptv-fr/main/playlist_fr.m3u8', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      throw new Error(`Erreur GitHub: ${res.status}`);
    }

    const text = await res.text();
    const lines = text.split('\n');
    const channels = [];
    let currentChannel: { id?: string; name?: string; logo?: string; category?: string; streamUrl?: string } = {};

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (line.startsWith('#EXTINF:')) {
        const parts = line.split(',');
        const rawName = parts.length > 1 ? parts[parts.length - 1].trim() : 'Chaîne Inconnue';
        const cleanName = rawName.replace(/[ⒼⓎⒹ]/g, '').trim();
        
        const logoMatch = line.match(/tvg-logo="([^"]*)"/);
        const groupMatch = line.match(/group-title="([^"]*)"/);

        currentChannel = {
          id: `channel-${channels.length + 1}`,
          name: cleanName,
          logo: logoMatch ? logoMatch[1] : '',
          category: groupMatch ? groupMatch[1] : 'France'
        };
      } else if (line.startsWith('http://') || line.startsWith('https://')) {
        currentChannel.streamUrl = line;
        if (currentChannel.name && currentChannel.streamUrl) {
          channels.push(currentChannel);
        }
        currentChannel = {};
      }
    }

    return NextResponse.json({ success: true, count: channels.length, channels });
  } catch {
    return NextResponse.json({ success: false, error: 'La liste des chaînes est temporairement indisponible.' }, { status: 502 });
  }
}
