import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseUrl, supabaseAnonKey } from '@/lib/supabase';
import { contentTmdbId } from '@/lib/content-identity';
import { classificationFromTmdb, suggestedAudience, type FamilyClassification } from '@/lib/tmdb-certification';
import { withMangaGenre } from '@/lib/catalogue-categories';

export const runtime = 'nodejs';
const headers = {'Cache-Control':'no-store'};
type Row = {id:string;title:string;type:string;tmdb_id:string|null;url:string|null;embedUrl:string|null;audience:string;genres:string[]|null;family_classification:FamilyClassification|null};
export async function POST(request: Request) {
  const token = request.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return NextResponse.json({error:'Connexion requise.'},{status:401,headers});
  const client = createClient(supabaseUrl,supabaseAnonKey,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false,autoRefreshToken:false}});
  const {data:{user},error:authError} = await client.auth.getUser(token);
  if (authError || !user) return NextResponse.json({error:'Session expirée. Reconnecte-toi.'},{status:401,headers});
  if (user.email !== 'lukas.leclerc312@gmail.com') return NextResponse.json({error:'Accès administrateur requis.'},{status:403,headers});
  const body = await request.json().catch(()=>null);
  if (!Array.isArray(body?.ids) || !body.ids.length || body.ids.length > 4 || body.ids.some((id:unknown)=>typeof id !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(id))) return NextResponse.json({error:'Sélectionne entre un et quatre titres.'},{status:400,headers});
  const key = process.env.TMDB_API_KEY;
  if (!key) return NextResponse.json({error:'La clé TMDB doit être configurée sur le serveur.'},{status:503,headers});
  const {data,error} = await client.from('media').select('id,title,type,tmdb_id,url,embedUrl,audience,genres,family_classification').in('id',[...new Set(body.ids)]);
  if (error) return NextResponse.json({error:'Les classifications ne peuvent pas être chargées. Vérifie la migration 20261028_tmdb_family.sql.'},{status:503,headers});
  const results: ({id:string;audience?:string;family_classification?:FamilyClassification;error?:string})[] = [];
  const queue = [...(data || [])] as Row[];
  async function worker() {
    while (queue.length) {
      const row = queue.shift()!;
      try {
        const id = contentTmdbId(row), type = row.type === 'series' ? 'tv' : 'movie';
        const previous = row.family_classification;
        const fresh = previous?.tmdb_id === id && previous.media_type === type && Date.now() - Date.parse(previous.checked_at) < 30 * 86400000 && typeof previous.manga === 'boolean';
        let classification: FamilyClassification;
        if (fresh && body.refresh !== true) classification = {...previous};
        else if (!id) classification = {source:'tmdb',checked_at:new Date().toISOString(),status:'missing_id',tmdb_id:'',media_type:type,country:null,certification:null,min_age:null,adult:false,manga:false};
        else {
          const url = new URL(`https://api.themoviedb.org/3/${type}/${id}`);
          url.searchParams.set('api_key',key!); url.searchParams.set('language','fr-FR'); url.searchParams.set('append_to_response',type === 'movie' ? 'release_dates' : 'content_ratings');
          const response = await fetch(url,{signal:AbortSignal.any([request.signal,AbortSignal.timeout(12000)]),cache:'no-store'});
          if (response.status === 404) classification = {source:'tmdb',checked_at:new Date().toISOString(),status:'not_found',tmdb_id:id,media_type:type,country:null,certification:null,min_age:null,adult:false,manga:false};
          else {
            if (!response.ok) throw new Error(response.status === 429 ? 'TMDB reçoit trop de demandes. Réessaie dans une minute.' : 'TMDB est indisponible. Réessaie.');
            const details = await response.json();
            if (String(details.id) !== id) throw new Error('La fiche TMDB ne correspond pas à cet identifiant.');
            classification = classificationFromTmdb(type,id,details);
          }
        }
        // Preserve every explicit manual choice, including pre-existing Kids/Junior profiles.
        const manual = previous?.manual === true || (!previous && row.audience !== 'standard');
        classification.manual = manual;
        const audience = manual ? row.audience : suggestedAudience(classification) || 'standard';
        let update = client.from('media').update({family_classification:classification,audience,genres:withMangaGenre(row.genres,classification.manga === true)}).eq('id',row.id).eq('audience',row.audience);
        update = previous ? update.eq('family_classification',JSON.stringify(previous)) : update.is('family_classification',null);
        const saved = await update.select('id,audience,genres,family_classification').maybeSingle();
        if (saved.error) throw new Error('Enregistrement impossible. Réessaie.');
        if (!saved.data) throw new Error('Ce titre a été modifié pendant l’analyse. Recharge la page.');
        results.push(saved.data);
      } catch (error) { results.push({id:row.id,error:error instanceof Error && !/fetch|abort|timeout/i.test(error.message) ? error.message : 'TMDB ne répond pas. Réessaie.'}); }
    }
  }
  await Promise.all([worker(),worker()]);
  for (const id of body.ids) if (!results.some(row=>row.id === id)) results.push({id,error:'Titre introuvable dans le catalogue.'});
  return NextResponse.json({results},{headers});
}
