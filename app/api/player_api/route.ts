import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');
  const username = searchParams.get('username');
  const password = searchParams.get('password');

  // 1. Gestion de la connexion initiale (Login)
  if (!action) {
    // Vérification basique de l'utilisateur dans Supabase
    // (Adapte selon ta table d'utilisateurs ou d'authentification)
    return NextResponse.json({
      user_info: {
        username: username || 'user',
        status: 'Active',
        auth: 1,
      },
      server_info: {
        url: 'yamonfim',
        port: '80',
        https_port: '443',
        server_protocol: 'http',
      }
    });
  }

  // 2. Récupération des catégories VOD (Films / Séries)
  if (action === 'get_vod_categories') {
    return NextResponse.json([
      { category_id: '1', category_name: 'Films', parent_id: 0 },
      { category_id: '2', category_name: 'Séries', parent_id: 0 }
    ]);
  }

  // 3. Récupération de la liste des films et séries depuis Supabase
  if (action === 'get_vod_streams') {
    const { data: mediaList, error } = await supabase.from('media').select('*');

    if (error || !mediaList) {
      return NextResponse.json([]);
    }

    // Formatage attendu par les lecteurs IPTV
    const formattedStreams = mediaList.map((item) => ({
      num: item.id,
      name: item.title,
      stream_type: 'movie',
      stream_id: item.id,
      stream_icon: item.poster,
      rating: '5',
      category_id: item.type === 'movie' ? '1' : '2',
      container_extension: 'mp4',
      direct_source: item.url // Ton lien de streaming direct
    }));

    return NextResponse.json(formattedStreams);
  }

  return NextResponse.json({ error: 'Action non reconnue' });
}