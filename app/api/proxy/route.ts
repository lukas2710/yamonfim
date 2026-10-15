import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');
  if (!url) {
    return new NextResponse('URL manquante', { status: 400 });
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://iptv-org.github.io/'
      },
      signal: AbortSignal.timeout(5000) // Timeout de 5 secondes pour éviter le blocage
    });

    if (!response.ok) {
      return new NextResponse('Flux distant inaccessible', { status: response.status });
    }

    const contentType = response.headers.get('content-type') || 'application/vnd.apple.mpegurl';
    
    // Si c'est un fichier M3U8, on peut intercepter le texte pour réécrire les URLs relatives si besoin, 
    // sinon on le transmet directement en ArrayBuffer (plus propre pour les flux vidéo binaires).
    const data = await response.arrayBuffer();

    return new NextResponse(data, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    return new NextResponse('Erreur de connexion au flux', { status: 504 });
  }
}