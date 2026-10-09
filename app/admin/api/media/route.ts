import { NextResponse } from 'next/server';

// Simulation d'une base de données temporaire ou tu connectes ton Supabase ici
let mockDatabase: any[] = [];

// GET : Récupère tous les films pour la page d'accueil
export async function GET() {
  return NextResponse.json(mockDatabase);
}

// POST : Ajoute un film depuis le panneau admin
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { title, type, poster, year, videoUrl, episodeInfo } = body;

    if (!title || !videoUrl) {
      return NextResponse.json({ error: 'Titre et URL de la vidéo obligatoires' }, { status: 400 });
    }

    const newItem = {
      id: Date.now().toString(),
      title,
      type: type || 'movie',
      poster: poster || '',
      year: year || 2026,
      videoUrl,
      episodeInfo: episodeInfo || '',
    };

    // Si tu utilises Supabase, tu ferais un insert ici :
    // await supabase.from('media').insert([newItem]);

    mockDatabase.unshift(newItem); // Ajoute au début de la liste

    return NextResponse.json({ success: true, item: newItem });
  } catch (error: any) {
    return NextResponse.json({ error: 'Erreur serveur : ' + error.message }, { status: 500 });
  }
}