'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import SectionNavigation from '@/components/SectionNavigation';
import { supabase } from '@/lib/supabase';
import { fetchCatalogueRows } from '@/lib/catalogue';
import { releaseYear } from '@/lib/profile-audience';
import { classificationLabel, needsFamilyReview, suggestedAudience, type FamilyClassification } from '@/lib/tmdb-certification';

type Item = { id:string; title:string; type:string; poster:string; tmdb_id:string|null; audience:string; release_year:number|null; family_classification:FamilyClassification|null };
type Filter = 'pending' | 'unanalysed' | 'missing' | 'kids' | 'junior' | 'standard' | 'all';
const FILTERS: [Filter,string][] = [['pending','À traiter'],['unanalysed','Non analysés'],['missing','À vérifier'],['kids','Kids'],['junior','Junior'],['standard','Standard'],['all','Tous les titres']];
const inputClass = 'rounded-xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm';
const audienceNames: Record<string,string> = {kids:'Kids',junior:'Junior',standard:'Standard'};
function matchesFilter(item:Item, filter:Filter) {
  if (filter === 'all') return true;
  if (filter === 'pending') return needsFamilyReview(item);
  if (filter === 'unanalysed') return !item.family_classification;
  if (filter === 'missing') return !!item.family_classification && needsFamilyReview(item);
  return item.audience === filter;
}

export default function FamilyAdmin() {
  const router = useRouter();
  const [items,setItems] = useState<Item[]>([]);
  const [query,setQuery] = useState('');
  const [filter,setFilter] = useState<Filter>('pending');
  const [type,setType] = useState('all');
  const [limit,setLimit] = useState(60);
  const [error,setError] = useState('');
  const [ready,setReady] = useState(false);
  const [loaded,setLoaded] = useState(false);
  const [saving,setSaving] = useState('');
  const [status,setStatus] = useState('');
  const [scanning,setScanning] = useState(false);
  const [progress,setProgress] = useState({done:0,total:0,failed:0});
  const [rowErrors,setRowErrors] = useState<Record<string,string>>({});
  const stop = useRef(false);
  const alive = useRef(true);
  const scanningRef = useRef(false);
  useEffect(() => {
    alive.current = true;
    void (async () => {
      const {data:{user}} = await supabase.auth.getUser();
      if (user?.email !== 'lukas.leclerc312@gmail.com') { router.replace('/'); return; }
      if (!alive.current) return;
      setReady(true);
      const rows = await fetchCatalogueRows<Item>(supabase,'id,title,type,poster,tmdb_id,audience,release_year,family_classification');
      if (alive.current) { setItems(rows.map(row=>({...row,id:String(row.id)}))); setLoaded(true); }
    })().catch(() => { if (alive.current) setError('Chargement impossible. Vérifie la migration 20261028_tmdb_family.sql puis recharge la page.'); });
    return () => { alive.current=false; stop.current=true; };
  },[router]);
  const counts = useMemo(()=>Object.fromEntries(FILTERS.map(([key])=>[key,items.filter(item=>matchesFilter(item,key)).length])),[items]);
  const visible = useMemo(()=>items.filter(item=>matchesFilter(item,filter) && (type==='all'||item.type===type) && item.title.toLocaleLowerCase().includes(query.toLocaleLowerCase())),[items,filter,type,query]);
  function change(id:string,patch:Partial<Item>) { setItems(rows=>rows.map(row=>row.id===id?{...row,...patch}:row)); }
  async function save(item:Item) {
    if (item.release_year !== null && (!Number.isInteger(item.release_year)||item.release_year<1888||item.release_year>2100)) { setError('Choisis une année entre 1888 et 2100.'); return; }
    if (item.tmdb_id && !/^[1-9][0-9]{0,9}$/.test(item.tmdb_id.trim())) { setError('L’identifiant TMDB doit être un nombre positif.'); return; }
    setSaving(item.id); setError(''); setStatus('');
    const tmdbId = item.tmdb_id?.trim() || null;
    const metadata: FamilyClassification = item.family_classification?.tmdb_id === tmdbId ? {...item.family_classification,manual:true} : {
      source:'tmdb',checked_at:new Date().toISOString(),status:tmdbId?'missing_rating':'missing_id',tmdb_id:tmdbId||'',media_type:item.type==='series'?'tv':'movie',country:null,certification:null,min_age:null,adult:false,manual:true,
    };
    try {
      const result = await supabase.from('media').update({audience:item.audience,release_year:item.release_year,tmdb_id:tmdbId,family_classification:metadata}).eq('id',item.id).select('id').single();
      if (result.error) throw result.error;
      change(item.id,{family_classification:metadata}); setStatus('Choix manuel enregistré : '+item.title);
    } catch { setError('Enregistrement impossible. Vérifie l’identifiant TMDB et réessaie.'); }
    finally { setSaving(''); }
  }
  async function analyse(selection:Item[], refresh=false) {
    if (scanningRef.current||!selection.length) return;
    scanningRef.current=true; stop.current=false; setScanning(true); setError(''); setStatus(''); setRowErrors({});
    setProgress({done:0,total:selection.length,failed:0});
    let done=0,failed=0;
    try {
      for (let offset=0;offset<selection.length&&!stop.current;offset+=4) {
        const batch = selection.slice(offset,offset+4);
        const {data:{session}} = await supabase.auth.getSession();
        if (!session) throw new Error('Session expirée. Reconnecte-toi.');
        const response = await fetch('/api/admin/family-classification',{method:'POST',signal:AbortSignal.timeout(55000),headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({ids:batch.map(item=>item.id),refresh})});
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error||'Analyse indisponible. Réessaie.');
        if (!alive.current) return;
        const results = payload.results as {id:string;audience?:string;family_classification?:FamilyClassification;error?:string}[];
        setItems(rows=>rows.map(row=>{const saved=results.find(result=>String(result.id)===row.id&&!result.error);return saved?{...row,audience:saved.audience!,family_classification:saved.family_classification!}:row;}));
        for (const row of results) if (row.error) { failed++; setRowErrors(errors=>({...errors,[String(row.id)]:row.error!})); }
        done+=batch.length; setProgress({done,total:selection.length,failed});
        // Stop a service-wide outage instead of sending thousands of failing requests.
        if (results.every(row=>!!row.error)) throw new Error('Ce lot n’a pas pu être analysé. Les résultats précédents sont conservés. Réessaie dans un instant.');
      }
      if (alive.current) setStatus(stop.current?'Analyse arrêtée. Les résultats déjà enregistrés sont conservés.':`Analyse terminée : ${done-failed} titres traités, ${failed} erreur(s). Les titres sans âge exploitable restent à vérifier.`);
    } catch (e) { if (alive.current) setError(e instanceof Error?e.message:'Analyse interrompue. Les résultats déjà enregistrés sont conservés.'); }
    finally { scanningRef.current=false; if (alive.current) setScanning(false); }
  }
  // Same batch loop, reading each title's stream to find titles without French audio.
  async function scanLanguages(selection:Item[]) {
    if (scanningRef.current||!selection.length) return;
    scanningRef.current=true; stop.current=false; setScanning(true); setError(''); setStatus(''); setRowErrors({});
    setProgress({done:0,total:selection.length,failed:0});
    let done=0,failed=0,foreign=0;
    try {
      for (let offset=0;offset<selection.length&&!stop.current;offset+=4) {
        const batch = selection.slice(offset,offset+4);
        const {data:{session}} = await supabase.auth.getSession();
        if (!session) throw new Error('Session expirée. Reconnecte-toi.');
        const response = await fetch('/api/admin/language-scan',{method:'POST',signal:AbortSignal.timeout(58000),headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({ids:batch.map(item=>item.id)})});
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error||'Détection indisponible. Réessaie.');
        if (!alive.current) return;
        for (const row of payload.results as {id:string;foreign?:boolean;error?:string}[]) {
          if (row.error) { failed++; setRowErrors(errors=>({...errors,[String(row.id)]:row.error!})); }
          else if (row.foreign) foreign++;
        }
        done+=batch.length; setProgress({done,total:selection.length,failed});
      }
      if (alive.current) setStatus(stop.current?'Détection arrêtée. Les résultats déjà enregistrés sont conservés.':`Détection terminée : ${foreign} titre(s) sans VF placés dans Langue étrangère, ${failed} non vérifié(s).`);
    } catch (e) { if (alive.current) setError(e instanceof Error?e.message:'Détection interrompue. Les résultats déjà enregistrés sont conservés.'); }
    finally { scanningRef.current=false; if (alive.current) setScanning(false); }
  }
  if (!ready) return <main className="p-10">Vérification…{error}</main>;
  return <main className="min-h-screen px-4 py-6 sm:px-8">
    <SectionNavigation admin />
    <div className="mx-auto max-w-6xl space-y-7 pb-16">
      <header className="pt-6"><p className="text-xs font-bold uppercase tracking-[.2em] text-red-400">LES BONS TITRES, AU BON ÂGE</p><h1 className="mt-3 text-3xl font-bold sm:text-4xl">Kids & Junior</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-400">TMDB fournit la classification d’âge : Kids : titres tous publics ou déconseillés aux moins de 6 ans. Junior (enfants de moins de 12 ans) : jusqu’aux titres déconseillés aux moins de 10 ans ; un titre « -12 » ou plus reste réservé aux profils standard. La France est prioritaire ; à défaut, le pays utilisé est indiqué. Sans âge fiable ou sans fiche TMDB, le titre reste à vérifier et n’entre pas automatiquement dans le catalogue enfants. Tes choix manuels sont conservés.</p></header>
      <section className="rounded-3xl border border-red-400/20 bg-gradient-to-br from-red-950/40 to-zinc-950 p-5 sm:p-7" aria-label="Analyse TMDB">
        <div className="flex flex-wrap items-start justify-between gap-5"><div><h2 className="text-xl font-bold">Retrouve les titres qui demandent ton attention</h2><p className="mt-2 text-sm text-zinc-400">{counts.pending||0} à traiter · {counts.kids||0} Kids · {counts.junior||0} Junior</p><p className="mt-2 text-xs text-zinc-500">L’analyse enregistre les âges, classe les titres et range l’animation japonaise dans Mangas. « Détecter les langues » lit le flux de chaque titre et range ceux sans VF dans Langue étrangère (plus long : quelques secondes par titre). Aucun film, série ou lien de lecture n’est supprimé.</p></div>
          {scanning?<button onClick={()=>{stop.current=true;setStatus('Arrêt après le lot en cours…');}} className={inputClass}>Arrêter après ce lot</button>:<div className="flex flex-wrap gap-3"><button disabled={!loaded||!!saving||!visible.length} onClick={()=>void analyse(visible)} className="rounded-full bg-red-600 px-6 py-3 text-sm font-bold disabled:opacity-40">Analyser et classer {visible.length} titre{visible.length>1?'s':''}</button><button disabled={!loaded||!!saving||!visible.length} onClick={()=>void scanLanguages(visible)} title="Lit les pistes audio de chaque titre : sans VF, il passe dans Langue étrangère" className="rounded-full border border-white/15 bg-white/5 px-6 py-3 text-sm font-bold disabled:opacity-40">Détecter les langues ({visible.length})</button></div>}</div>
        {scanning&&<div className="mt-5" role="status"><p className="mb-2 text-sm">{progress.done} / {progress.total} traités{progress.failed?` · ${progress.failed} erreur(s)`:''} · garde cette page ouverte</p><progress aria-label="Progression de l’analyse TMDB" max={progress.total||1} value={progress.done} className="h-2 w-full accent-red-500" /></div>}
      </section>
      <div className="flex flex-wrap gap-2" aria-label="Filtrer le classement">{FILTERS.map(([key,label])=><button key={key} aria-pressed={filter===key} onClick={()=>{setFilter(key);setLimit(60);}} className={`rounded-full border px-4 py-2 text-sm ${filter===key?'border-white bg-white text-black':'border-white/10 bg-white/5 text-zinc-300'}`}>{label} <span className="ml-1 opacity-60">{counts[key]||0}</span></button>)}</div>
      <div className="flex flex-wrap gap-3"><input aria-label="Chercher un titre" placeholder="Chercher un film ou une série…" value={query} onChange={e=>{setQuery(e.target.value);setLimit(60);}} className={`${inputClass} min-w-52 flex-1`} /><select aria-label="Type de contenu" value={type} onChange={e=>{setType(e.target.value);setLimit(60);}} className={inputClass}><option value="all">Films et séries</option><option value="movie">Films</option><option value="series">Séries</option></select></div>
      {error&&<p role="alert" className="rounded-xl bg-red-950/40 p-4 text-sm text-red-200">{error}</p>}{status&&<p role="status" className="text-sm text-zinc-300">{status}</p>}
      {!loaded&&!error&&<p role="status" className="text-zinc-400">Chargement du catalogue…</p>}
      {loaded&&!visible.length&&<div className="rounded-2xl border border-white/10 p-8 text-center text-zinc-400">Aucun titre dans ce filtre.{filter==='pending'?' Les titres classés sont disponibles dans Kids, Junior ou Standard.':''}</div>}
      <div className="space-y-4">{visible.slice(0,limit).map(item=>{const metadata=item.family_classification,suggestion=metadata?suggestedAudience(metadata):null;return <article key={item.id} className="flex gap-4 rounded-2xl border border-white/10 bg-white/[.02] p-4 sm:p-5">
        {item.poster&&<img alt="" loading="lazy" src={item.poster} className="hidden h-32 w-20 shrink-0 rounded-xl object-cover sm:block" />}
        <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">{item.title}</h2><span className={`rounded-full px-3 py-1 text-xs font-bold ${item.audience==='kids'?'bg-emerald-400/10 text-emerald-300':item.audience==='junior'?'bg-sky-400/10 text-sky-300':'bg-zinc-800 text-zinc-300'}`}>{audienceNames[item.audience]||'Standard'}</span></div>
          <p className="mt-1 text-xs text-zinc-500">{item.type==='series'?'Série':'Film'}{metadata?.manual?' · Choix manuel':''}</p>
          <p className={`mt-3 text-sm ${needsFamilyReview(item)?'text-amber-200':'text-zinc-300'}`}>{classificationLabel(metadata)}{suggestion&&!metadata?.manual?` → ${audienceNames[suggestion]}`:''}</p>
          {metadata?.tmdb_title&&<p className="mt-1 text-xs text-zinc-500">Fiche TMDB : {metadata.tmdb_title}</p>}
          {rowErrors[item.id]&&<p role="alert" className="mt-2 text-sm text-red-300">{rowErrors[item.id]}</p>}
          <div className="mt-4 flex flex-wrap gap-3"><select disabled={scanning||!!saving} aria-label={'Public de '+item.title} value={item.audience} onChange={e=>change(item.id,{audience:e.target.value})} className={inputClass}><option value="standard">Standard</option><option value="kids">Kids</option><option value="junior">Junior</option></select>
            <input disabled={scanning||!!saving} aria-label={'Année de '+item.title} type="number" min={1888} max={2100} placeholder="Année" value={item.release_year??releaseYear(item)??''} onChange={e=>change(item.id,{release_year:e.target.value?Number(e.target.value):null})} className={`${inputClass} w-28`} />
            <input disabled={scanning||!!saving} aria-label={'Identifiant TMDB de '+item.title} inputMode="numeric" placeholder="ID TMDB" value={item.tmdb_id||''} onChange={e=>change(item.id,{tmdb_id:e.target.value,family_classification:null})} className={`${inputClass} w-32`} />
            <button disabled={scanning||!!saving} onClick={()=>void save(item)} className="rounded-full bg-white px-5 py-3 text-sm font-bold text-black disabled:opacity-40">{saving===item.id?'Enregistrement…':'Valider mon choix'}</button>
            <button disabled={scanning||!!saving} onClick={()=>void analyse([item],true)} className={inputClass}>Vérifier sur TMDB</button>
            <a href={metadata?.tmdb_id?`https://www.themoviedb.org/${metadata.media_type}/${metadata.tmdb_id}`:`https://www.themoviedb.org/search?query=${encodeURIComponent(item.title)}`} target="_blank" rel="noreferrer" className="self-center text-xs text-zinc-400 underline">{metadata?.tmdb_id?'Ouvrir la fiche TMDB ↗':'Rechercher la fiche TMDB ↗'}</a>
          </div>
        </div>
      </article>;})}</div>
      {visible.length>limit&&<button onClick={()=>setLimit(value=>value+60)} className={inputClass}>Afficher plus ({Math.min(limit,visible.length)} / {visible.length})</button>}
      <footer className="border-t border-white/10 pt-5 text-xs text-zinc-500">Classifications fournies par <a href="https://www.themoviedb.org" target="_blank" rel="noreferrer" className="underline">TMDB</a>. Ce produit utilise l’API TMDB mais n’est ni approuvé ni certifié par TMDB. Une classification peut varier selon le pays ou la version ; tu peux toujours ajuster le public manuellement.</footer>
    </div>
  </main>;
}
