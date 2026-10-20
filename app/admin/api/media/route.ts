import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseUrl, supabaseAnonKey } from '@/lib/supabase';
import { checkContentDuplicate } from '@/lib/content-duplicates';
import { duplicateErrorMessage } from '@/lib/content-identity';

async function authenticatedClient(request: Request) {
  const token = request.headers.get('authorization');
  if (!token?.startsWith('Bearer ')) return null;
  const client = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: token } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data: { user }, error } = await client.auth.getUser(token.slice(7));
  return error || !user ? null : { client, user };
}

export async function GET(request: Request) {
  const account = await authenticatedClient(request);
  if (!account) return NextResponse.json({ error: 'Connexion requise' }, { status: 401 });
  const { data, error } = await account.client.from('media').select('*').order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: 'Catalogue indisponible' }, { status: 502 });
  return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request) {
  const account = await authenticatedClient(request);
  if (!account) return NextResponse.json({ error: 'Connexion requise' }, { status: 401 });
  if (account.user.email !== 'lukas.leclerc312@gmail.com') return NextResponse.json({ error: 'Accès administrateur requis' }, { status: 403 });
  try {
    const body = await request.json();
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const videoUrl = typeof body.videoUrl === 'string' ? body.videoUrl.trim() : '';
    if (!title || !videoUrl || !['http:', 'https:'].includes(new URL(videoUrl).protocol)) return NextResponse.json({ error: 'Titre et adresse vidéo valides obligatoires' }, { status: 400 });
    const type = body.type === 'series' ? 'series' : 'movie';
    const tmdb_id = typeof body.tmdb_id === 'string' || typeof body.tmdb_id === 'number' ? String(body.tmdb_id) : null;
    let existing;
    try { existing = await checkContentDuplicate(account.client, { title, type, tmdb_id }, 'media'); }
    catch { return NextResponse.json({ error: 'Vérification des doublons indisponible. Aucun titre ajouté. Réessaie.' }, { status: 503 }); }
    if (existing) return NextResponse.json({ error: 'Ce titre est déjà disponible dans le catalogue.' }, { status: 409 });
    const { data, error } = await account.client.from('media').insert({ title, type, tmdb_id, poster: typeof body.poster === 'string' ? body.poster : '', url: videoUrl, embedUrl: type === 'movie' ? videoUrl : '', description: typeof body.description === 'string' ? body.description : '' }).select().single();
    if (error) return NextResponse.json({ error: duplicateErrorMessage(error, 'Le titre n’a pas été enregistré.') }, { status: error.code === '23505' ? 409 : 502 });
    return NextResponse.json({ success: true, item: data }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Données invalides' }, { status: 400 });
  }
}
