'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import SectionNavigation from '@/components/SectionNavigation';
import { supabase } from '@/lib/supabase';
import { fetchCatalogueRows } from '@/lib/catalogue';
import { releaseYear } from '@/lib/profile-audience';
type Item = { id: string; title: string; type: string; audience: string; release_year: number | null };
export default function FamilyAdmin() {
 const router = useRouter(); const [items, setItems] = useState<Item[]>([]); const [query, setQuery] = useState(''); const [error, setError] = useState(''); const [ready, setReady] = useState(false); const [saving, setSaving] = useState(''); const [status, setStatus] = useState('');
 useEffect(() => { void (async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (user?.email !== 'lukas.leclerc312@gmail.com') { router.replace('/'); return; }
  setReady(true);
  try { setItems(await fetchCatalogueRows<Item>(supabase, 'id,title,type,audience,release_year')); } catch { setError('Chargement impossible. Applique la migration 20261028_family_feedback.sql puis réessaie.'); }
 })().catch(() => setError('Connexion impossible.')); }, [router]);
 async function save(item: Item) {
  if (item.release_year !== null && (!Number.isInteger(item.release_year) || item.release_year < 1888 || item.release_year > 2100)) { setError('Choisis une année entre 1888 et 2100.'); return; }
  setSaving(item.id); setError(''); setStatus('');
  try { const { error } = await supabase.from('media').update({ audience: item.audience, release_year: item.release_year }).eq('id', item.id); if (error) throw error; setStatus('Enregistré : ' + item.title); }
  catch { setError('Enregistrement impossible. Réessaie.'); } finally { setSaving(''); }
 }
 function change(id: string, patch: Partial<Item>) { setItems(rows => rows.map(row => row.id === id ? {...row, ...patch} : row)); }
 if (!ready) return <main className="p-10">Vérification…{error}</main>;
 return <main className="min-h-screen p-6"><SectionNavigation admin /><h1 className="my-6 text-3xl font-bold">Catalogue Kids et Junior</h1><p className="max-w-3xl text-zinc-400">Valide chaque titre pour son public. Kids apparaît dans les deux univers enfants. Junior apparaît uniquement dans Junior. Les titres Standard restent exclus des profils enfants. Une animation peut être destinée aux adultes : vérifie le contenu avant de le classer.</p><input aria-label="Chercher un titre" placeholder="Chercher un film ou une série" value={query} onChange={e => setQuery(e.target.value)} className="my-6 w-full rounded-xl bg-zinc-900 p-3" />{error && <p role="alert" className="text-red-300">{error}</p>}{status && <p role="status">{status}</p>}<div className="space-y-3">{items.filter(item => item.title.toLocaleLowerCase().includes(query.toLocaleLowerCase())).slice(0,100).map(item => <div key={item.id} className="flex flex-wrap items-center gap-4 rounded-xl border border-white/10 p-4"><span className="min-w-48 flex-1">{item.title} · {item.type === 'series' ? 'Série' : 'Film'}</span><select aria-label={'Public de ' + item.title} value={item.audience} onChange={e => change(item.id, {audience:e.target.value})} className="rounded-lg bg-zinc-900 p-3"><option value="standard">Standard</option><option value="kids">Kids</option><option value="junior">Junior</option></select><input aria-label={'Année de ' + item.title} type="number" min={1888} max={2100} placeholder="Année" value={item.release_year ?? releaseYear(item) ?? ''} onChange={e => change(item.id, {release_year:e.target.value ? Number(e.target.value) : null})} className="w-28 rounded-lg bg-zinc-900 p-3" /><button disabled={!!saving} onClick={() => void save(item)} className="rounded-full bg-red-600 px-5 py-3">{saving === item.id ? 'Enregistrement…' : 'Enregistrer'}</button></div>)}</div><p className="mt-5 text-sm text-zinc-400">100 titres maximum affichés. Utilise la recherche pour retrouver les autres.</p></main>;
}
