'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import SectionNavigation from '@/components/SectionNavigation';
import PageHero from '@/components/PageHero';
import { supabase } from '@/lib/supabase';
import { collectionItems, collectionPayload, safeCollectionImage, type CollectionMedia, type MediaCollection } from '@/lib/collections';

const ADMIN_EMAIL = 'lukas.leclerc312@gmail.com';
const empty = { title: '', description: '', cover_url: '', media_ids: [] as string[], active: true, position: 0 };
type Draft = typeof empty;
function storageError(code?: string) {
  if (code === '42P01' || code === 'PGRST205') return 'Le stockage des collections doit être activé dans Supabase avec le fichier de migration fourni. Tes films et séries restent disponibles.';
  if (code === '23505') return 'Une collection porte déjà ce nom. Choisis un autre nom ou modifie la collection existante.';
  return 'L’opération a échoué. Vérifie ta connexion et réessaie.';
}

export default function AdminCollectionsPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [catalogue, setCatalogue] = useState<CollectionMedia[]>([]);
  const [collections, setCollections] = useState<MediaCollection[]>([]);
  const [draft, setDraft] = useState<Draft>({ ...empty });
  const [editing, setEditing] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session || session.user.email?.toLowerCase() !== ADMIN_EMAIL) { router.replace('/'); return; }
        if (!alive) return;
        setAuthorized(true);
        const [media, groups] = await Promise.all([
          (async () => {
            const all: CollectionMedia[] = [];
            for (let offset = 0; ; offset += 1000) {
              const result = await supabase.from('media').select('id,title,type,poster,backdrop').order('id').range(offset, offset + 999);
              if (result.error) throw result.error;
              all.push(...(result.data || []));
              if ((result.data?.length || 0) < 1000) return all;
            }
          })(),
          supabase.from('media_collections').select('*').order('position').order('created_at'),
        ]);
        if (!alive) return;
        setCatalogue(media);
        if (groups.error) setError(storageError(groups.error.code));
        else { setCollections(groups.data || []); setReady(true); }
      } catch { if (alive) setError('Impossible de charger les collections et le catalogue. Actualise la page pour réessayer.'); }
      finally { if (alive) setLoading(false); }
    }
    void load();
    return () => { alive = false; };
  }, [router]);

  async function refresh() {
    const { data, error } = await supabase.from('media_collections').select('*').order('position').order('created_at');
    if (error) throw error;
    setCollections(data || []);
  }
  function reset() { setDraft({ ...empty, media_ids: [] }); setEditing(null); setSearch(''); }
  function toggle(id: string) {
    setDraft(value => ({ ...value, media_ids: value.media_ids.includes(id) ? value.media_ids.filter(key => key !== id) : [...value.media_ids, id] }));
  }
  function move(index: number, step: number) {
    setDraft(value => { const ids = [...value.media_ids]; const target = index + step; if (target < 0 || target >= ids.length) return value; [ids[index], ids[target]] = [ids[target], ids[index]]; return { ...value, media_ids: ids }; });
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy || !ready) return;
    setError(''); setMessage('');
    try {
      const payload = collectionPayload(draft, catalogue);
      setBusy(true);
      const result = editing
        ? await supabase.from('media_collections').update(payload).eq('id', editing).select('id').single()
        : await supabase.from('media_collections').insert(payload).select('id').single();
      if (result.error) { setError(storageError(result.error.code)); return; }
      reset();
      await refresh();
      setMessage(payload.active ? 'Collection enregistrée et visible sur l’accueil.' : 'Brouillon enregistré. Il reste masqué sur l’accueil.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Impossible d’enregistrer la collection. Réessaie.'); }
    finally { setBusy(false); }
  }
  async function setVisibility(collection: MediaCollection) {
    if (busy) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const { error } = await supabase.from('media_collections').update({ active: !collection.active }).eq('id', collection.id).select('id').single();
      if (error) { setError(storageError(error.code)); return; }
      await refresh();
      if (editing === collection.id) setDraft(value => ({ ...value, active: !collection.active }));
      setMessage(collection.active ? 'Collection masquée. Aucun titre du catalogue n’a été supprimé.' : 'Collection publiée sur l’accueil.');
    } catch { setError('Impossible de mettre à jour la visibilité. Actualise la page.'); }
    finally { setBusy(false); }
  }
  const selected = collectionItems(draft, catalogue);
  const filtered = catalogue.filter(item => item.title.toLocaleLowerCase('fr').includes(search.toLocaleLowerCase('fr')));
  const cover = safeCollectionImage(draft.cover_url) || selected[0]?.backdrop || selected[0]?.poster;
  if (!authorized) return <main className="yf-page min-h-screen bg-[#0a0a0b] p-10 text-zinc-400" role="status">Vérification de l’accès administrateur…</main>;

  return <main className="yf-page yf-collection-admin min-h-screen bg-[#0a0a0b] pb-20 text-white">
    <header className="yf-collection-admin-top"><Link href="/">YAMON<span>FIM</span></Link><Link href="/">Retour au site ↗</Link></header>
    <SectionNavigation admin />
    <PageHero eyebrow="ADMINISTRATION · COLLECTIONS" title="Un univers." accent="Tous ses films." description="Rassemble les titres d’une saga et donne-leur une place sur l’accueil. Tu choisis les histoires, l’image et l’ordre de lecture." cardLabel="LES SAGAS DU CATALOGUE" cardTitle="Les collections" cardDetail={`${collections.length} collection${collections.length > 1 ? 's' : ''}`} variant="collection" />
    <div className="yf-collection-workspace">
      {error && <p role="alert" className="yf-collection-error">{error}</p>}{message && <p role="status" className="yf-collection-success">{message}</p>}
      {loading ? <p role="status">Chargement du catalogue…</p> : <>
        <form onSubmit={save} className="yf-collection-editor">
          <div className="yf-collections-heading"><div><p className="yf-eyebrow">COMPOSE TON UNIVERS</p><h2>{editing ? 'Modifier la collection' : 'Nouvelle collection'}</h2></div>{editing && <button type="button" disabled={busy} className="yf-collection-manage" onClick={reset}>Annuler</button>}</div>
          <fieldset disabled={busy || !ready} className="yf-collection-form-fields">
            <label>Nom de la collection<input required maxLength={100} placeholder="Ex. Fast & Furious" value={draft.title} onChange={event => setDraft({ ...draft, title: event.target.value })} /></label>
            <label>Description <span>(facultatif)</span><textarea rows={3} maxLength={1000} placeholder="Une phrase pour présenter cette saga…" value={draft.description} onChange={event => setDraft({ ...draft, description: event.target.value })} /></label>
            <label>Image de couverture <span>(lien facultatif)</span><input type="url" placeholder="https://… ou laisse vide pour utiliser le premier titre" value={draft.cover_url} onChange={event => setDraft({ ...draft, cover_url: event.target.value })} /></label>
            <div className="yf-collection-options"><label>Ordre sur l’accueil<input type="number" min={0} max={9999} required value={draft.position} onChange={event => setDraft({ ...draft, position: Number(event.target.value) })} /></label><label className="yf-collection-check"><input type="checkbox" checked={draft.active} onChange={event => setDraft({ ...draft, active: event.target.checked })} /> Visible sur l’accueil</label></div>
            <div className="yf-collection-selection"><h3>Titres sélectionnés <span>{selected.length}/200</span></h3><p>Utilise les flèches pour choisir leur ordre dans la collection.</p>{!selected.length && <p className="yf-collection-empty">Choisis tes premiers titres dans le catalogue ci-dessous.</p>}<ol>{selected.map((item, index) => <li key={item.id}><span className="yf-collection-order">{index + 1}</span><strong>{item.title}</strong><button type="button" aria-label={`Monter ${item.title}`} disabled={index === 0} onClick={() => move(index, -1)}>↑</button><button type="button" aria-label={`Descendre ${item.title}`} disabled={index === selected.length - 1} onClick={() => move(index, 1)}>↓</button><button type="button" aria-label={`Retirer ${item.title} de la collection`} onClick={() => toggle(String(item.id))}>×</button></li>)}</ol></div>
            <label>Rechercher dans le catalogue<input type="search" placeholder="Fast, Star Wars, Harry Potter…" value={search} onChange={event => setSearch(event.target.value)} /></label>
            <div className="yf-collection-picker" aria-label="Titres disponibles">{filtered.map(item => <label key={item.id} className="yf-collection-pick"><input type="checkbox" checked={draft.media_ids.includes(String(item.id))} disabled={!draft.media_ids.includes(String(item.id)) && selected.length >= 200} onChange={() => toggle(String(item.id))} />{item.poster && <img src={item.poster} alt="" loading="lazy" />}<span><strong>{item.title}</strong><small>{item.type === 'series' ? 'Série' : 'Film'}</small></span></label>)}{!filtered.length && <p className="yf-collection-empty">Aucun titre trouvé. Ajoute d’abord le contenu dans le catalogue admin.</p>}</div>
            <button className="yf-collection-submit" type="submit">{busy ? 'Enregistrement…' : editing ? 'Enregistrer les modifications' : draft.active ? 'Publier la collection' : 'Enregistrer le brouillon'}</button>
          </fieldset>
        </form>
        <aside className="yf-collection-preview"><p className="yf-eyebrow">APERÇU SUR L’ACCUEIL</p><div className="yf-collection-card" aria-label="Aperçu de la collection">{cover && <img src={cover} alt="" />}<span className="yf-collection-shade" /><span className="yf-collection-count">{selected.length} titres</span><span className="yf-collection-card-copy"><span>COLLECTION</span><strong>{draft.title || 'Ta prochaine saga'}</strong><span>Explorer l’univers ↗</span></span></div><p className="yf-collection-preview-note">Sans couverture personnalisée, l’image du premier titre est utilisée.</p>
          <h2>Tes collections <span>{collections.length}</span></h2><div className="yf-collection-saved">{collections.map(collection => <article key={collection.id}><div><span className={collection.active ? 'yf-collection-live' : ''}>{collection.active ? 'PUBLIÉE' : 'MASQUÉE'} · ORDRE {collection.position}</span><h3>{collection.title}</h3><p>{collectionItems(collection, catalogue).length} titres disponibles</p></div><div><button type="button" disabled={busy} onClick={() => { setEditing(collection.id); setDraft({ title: collection.title, description: collection.description, cover_url: collection.cover_url, media_ids: collectionItems(collection, catalogue).map(item => String(item.id)), active: collection.active, position: collection.position }); setMessage(''); setError(''); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Modifier</button><button type="button" disabled={busy} onClick={() => void setVisibility(collection)}>{collection.active ? 'Masquer' : 'Publier'}</button></div></article>)}{!collections.length && <p className="yf-collection-empty">Tes collections apparaîtront ici.</p>}</div>
        </aside>
      </>}
    </div>
  </main>;
}
