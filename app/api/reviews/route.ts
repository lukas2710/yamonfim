import { createClient } from '@supabase/supabase-js';
import { supabaseUrl, supabaseAnonKey } from '@/lib/supabase';
import { collectVipReviews, type VipReviews } from '@/lib/feedback-reviews';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
let cached: { at: number; data: VipReviews } | null = null;
let pending: Promise<VipReviews> | null = null;
async function member(request: Request) {
  const token = request.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return null;
  const client = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.getUser(token);
  return error ? null : data.user;
}
function database() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Configuration des avis indisponible');
  return createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}
async function collected() {
  const db = database(), publications = [], feedback = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await db.from('site_reviews').select('user_id,display_name,rating,comment').order('user_id').range(offset, offset + 999);
    if (error) throw error;
    publications.push(...data); if (data.length < 1000) break;
  }
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await db.from('site_feedback').select('id,user_id,rating,message,created_at').neq('message', '').order('created_at', { ascending: false }).order('id').range(offset, offset + 999);
    if (error) throw error;
    feedback.push(...data); if (data.length < 1000) break;
  }
  return collectVipReviews(feedback, publications);
}
export async function GET(request: Request) {
  if (!await member(request)) return Response.json({ error: 'Connexion requise' }, { status: 401 });
  try {
    if (!cached || Date.now() - cached.at > 60000) {
      pending ??= collected().finally(() => { pending = null; });
      cached = { at: Date.now(), data: await pending };
    }
    return Response.json(cached.data, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch { return Response.json({ error: 'Les avis sont momentanément indisponibles.' }, { status: 503 }); }
}
export async function POST(request: Request) {
  const user = await member(request);
  if (!user) return Response.json({ error: 'Connexion requise' }, { status: 401 });
  try {
    const body = await request.json();
    const display_name = typeof body.display_name === 'string' ? body.display_name.trim() : '';
    const comment = typeof body.comment === 'string' ? body.comment.trim() : '';
    if (display_name.length < 2 || display_name.length > 50 || comment.length < 10 || comment.length > 1000 || !Number.isInteger(body.rating) || body.rating < 1 || body.rating > 5) return Response.json({ error: 'Pseudo, commentaire et note valides requis.' }, { status: 400 });
    const db = database();
    const { data: previous } = await db.from('site_feedback').select('discovery').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
    const { error: feedbackError } = await db.from('site_feedback').insert({ user_id: user.id, rating: body.rating, message: comment, discovery: previous?.discovery || 'autre' });
    if (feedbackError) throw feedbackError;
    const { error } = await db.from('site_reviews').upsert({ user_id: user.id, display_name, rating: body.rating, comment }, { onConflict: 'user_id' });
    if (error) throw error;
    cached = null;
    return Response.json({ saved: true }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch { return Response.json({ error: 'Ton avis n’a pas pu être enregistré. Réessaie.' }, { status: 503 }); }
}
