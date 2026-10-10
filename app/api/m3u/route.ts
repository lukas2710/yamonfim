import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Remplace par l'URL brute de ta playlist .m3u ou .m3u8 hébergée (sur GitHub ou ailleurs)
    const externalPlaylistUrl = 'https://raw.githubusercontent.com/.../playlist_france.m3u8';

    const response = await fetch(externalPlaylistUrl);
    const m3uText = await response.text();

    return new NextResponse(m3uText, {
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