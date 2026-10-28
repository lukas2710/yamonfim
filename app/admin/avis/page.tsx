'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import SectionNavigation from '@/components/SectionNavigation';
import { supabase } from '@/lib/supabase';
type Feedback = { id: string; user_id: string; rating: number; discovery: string; message: string; created_at: string };
const sources: Record<string,string> = {tiktok:'TikTok',instagram:'Instagram',youtube:'YouTube',ami:'Un proche',recherche:'Moteur de recherche',autre:'Autre'};
export default function FeedbackAdmin() {
 const router = useRouter(); const [rows, setRows] = useState<Feedback[]>([]); const [ready, setReady] = useState(false); const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [more, setMore] = useState(false);
 const load = useCallback(async (offset = 0) => {
  setBusy(true); setError('');
  try {
   const { data: { user } } = await supabase.auth.getUser();
   if (user?.email !== 'lukas.leclerc312@gmail.com') { router.replace('/'); return; }
   setReady(true);
   const { data, error } = await supabase.from('site_feedback').select('*').order('created_at', {ascending:false}).order('id').range(offset, offset + 99);
   if (error) throw error;
   setRows(previous => offset ? [...previous, ...(data || [])] : data || []); setMore(data?.length === 100);
  } catch { setError('Impossible de charger les réponses. Vérifie la migration 20261028_family_feedback.sql.'); } finally { setBusy(false); }
 }, [router]);
 useEffect(() => { const timer = setTimeout(() => void load(), 0); return () => clearTimeout(timer); }, [load]);
 if (!ready) return <main className="p-10">Vérification…{error}</main>;
 return <main className="min-h-screen p-6"><SectionNavigation admin /><h1 className="my-6 text-3xl font-bold">Avis et découverte du site</h1><p className="text-zinc-400">{rows.length} réponses chargées · Note moyenne : {rows.length ? (rows.reduce((sum,r) => sum+r.rating,0)/rows.length).toFixed(1) : '—'} / 5</p><div className="my-5 flex flex-wrap gap-3">{Object.entries(sources).map(([key,name]) => <span key={key} className="rounded-xl bg-zinc-900 p-3">{name} : {rows.filter(row => row.discovery === key).length}</span>)}</div><button disabled={busy} onClick={() => void load()} className="mb-5 rounded-full bg-red-600 px-5 py-3">Actualiser</button>{error && <p role="alert">{error}</p>}{!rows.length && !busy && !error && <p>Aucune réponse pour le moment.</p>}<div className="space-y-3">{rows.map(row => <article key={row.id} className="rounded-xl border border-white/10 p-5"><p className="font-bold">{row.rating} / 5 · {sources[row.discovery] || row.discovery}</p><time className="text-xs text-zinc-400">{new Date(row.created_at).toLocaleString('fr-FR', {timeZone:'Europe/Paris'})}</time><p className="mt-3 whitespace-pre-wrap break-words">{row.message || 'Sans commentaire'}</p><p className="mt-3 text-xs text-zinc-500">Compte : {row.user_id}</p></article>)}</div>{more && <button disabled={busy} onClick={() => void load(rows.length)} className="mt-5 rounded-full bg-zinc-800 px-5 py-3">Charger les réponses précédentes</button>}</main>;
}
