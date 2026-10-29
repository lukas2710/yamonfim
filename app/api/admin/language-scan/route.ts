import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as cheerio from 'cheerio';
import { supabaseUrl, supabaseAnonKey } from '@/lib/supabase';
import { catalogueSource, isSupportedEmbed } from '@/lib/catalogue-source';
import { resolveBestCatalogueStream, resolveEmbed } from '@/lib/catalogue-stream';
import { hasFrenchAudio, withLanguageGenre, FOREIGN_GENRE } from '@/lib/catalogue-categories';

export const runtime = 'nodejs';
export const maxDuration = 60;
const headers = { 'Cache-Control': 'no-store' };
type Row = { id: string; type: string; url: string | null; embedUrl: string | null; genres: string[] | null; seasons: { episodes?: { embedUrl?: string }[] }[] | null };

// Reads the audio tracks published by a title's stream: a title whose tracks are
// named and contain no French one is tagged « Langue étrangère ». Unknown stays as is.
async function audioOf(stored: string, signal: AbortSignal) {
  const src = stored.includes('<iframe') ? cheerio.load(stored)('iframe').first().attr('src') || '' : stored.trim();
  if (isSupportedEmbed(src)) return (await resolveEmbed(src, signal)).audioTracks;
  return (await resolveBestCatalogueStream(catalogueSource(src), [], signal)).audioTracks;
}

export async function POST(request: Request) {
  const token = request.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return NextResponse.json({ error: 'Connexion requise.' }, { status: 401, headers });
  const client = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error: authError } = await client.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: 'Session expirée. Reconnecte-toi.' }, { status: 401, headers });
  if (user.email !== 'lukas.leclerc312@gmail.com') return NextResponse.json({ error: 'Accès administrateur requis.' }, { status: 403, headers });
  const body = await request.json().catch(() => null);
  if (!Array.isArray(body?.ids) || !body.ids.length || body.ids.length > 4 || body.ids.some((id: unknown) => typeof id !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(id))) return NextResponse.json({ error: 'Sélectionne entre un et quatre titres.' }, { status: 400, headers });
  const { data, error } = await client.from('media').select('id,type,url,embedUrl,genres,seasons').in('id', [...new Set(body.ids as string[])]);
  if (error) return NextResponse.json({ error: 'Les titres ne peuvent pas être chargés.' }, { status: 503, headers });
  const results = await Promise.all(((data || []) as Row[]).map(async row => {
    try {
      const stored = row.type === 'series' ? row.seasons?.flatMap(season => season.episodes || []).find(episode => episode.embedUrl?.trim())?.embedUrl || '' : row.embedUrl || row.url || '';
      if (!stored) return { id: String(row.id), french: null, error: 'Aucun lien de lecture.' };
      const french = hasFrenchAudio(await audioOf(stored, AbortSignal.any([request.signal, AbortSignal.timeout(40000)])));
      const genres = withLanguageGenre(row.genres, french);
      if (genres.length !== (row.genres || []).length || genres.some((genre, index) => genre !== row.genres?.[index])) {
        const saved = await client.from('media').update({ genres }).eq('id', row.id).select('id').maybeSingle();
        if (saved.error || !saved.data) throw new Error('save');
      }
      return { id: String(row.id), french, foreign: genres.includes(FOREIGN_GENRE) };
    } catch (cause) {
      return { id: String(row.id), french: null, error: cause instanceof Error && cause.message === 'save' ? 'Enregistrement impossible.' : 'Flux indisponible : langue non vérifiée.' };
    }
  }));
  for (const id of body.ids) if (!results.some(row => row.id === id)) results.push({ id, french: null, error: 'Titre introuvable dans le catalogue.' });
  return NextResponse.json({ results }, { headers });
}
