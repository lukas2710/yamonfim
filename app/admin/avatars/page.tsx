'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import SectionNavigation from '@/components/SectionNavigation';
import { getPersistentSession } from '@/lib/auth-session';
import { supabase } from '@/lib/supabase';
import { DEFAULT_AVATAR_CATEGORIES, fetchAvatars, fetchAvatarCategoryNames, type Avatar } from '@/lib/avatars';

export default function AdminAvatarsPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [ready, setReady] = useState(false);
  const [avatars, setAvatars] = useState<Avatar[]>([]);
  const [savedCategories, setSavedCategories] = useState<string[]>([]);
  const [categoryName, setCategoryName] = useState('');
  const [categoriesReady, setCategoriesReady] = useState(false);
  const [categoryError, setCategoryError] = useState('');
  const [editing, setEditing] = useState<Avatar | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const form = useRef<HTMLFormElement>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [x, setX] = useState(50);
  const [y, setY] = useState(50);
  const [busy, setBusy] = useState(false);
  const [decoding, setDecoding] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const canvas = useRef<HTMLCanvasElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const fileVersion = useRef(0);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const { data: { session } } = await getPersistentSession();
      if (!session || session.user.email?.toLowerCase() !== 'lukas.leclerc312@gmail.com') { router.replace('/'); return; }
      if (!alive) return;
      setAuthorized(true);
      const [library, categories] = await Promise.allSettled([fetchAvatars(), fetchAvatarCategoryNames()]);
      if (!alive) return;
      if (library.status === 'fulfilled') { setAvatars(library.value); setReady(true); }
      else setError('La bibliothèque est indisponible. Applique la migration Supabase 20261027_profile_avatars.sql puis recharge la page.');
      if (categories.status === 'fulfilled') { setSavedCategories(categories.value); setCategoriesReady(true); }
      else setCategoryError('La création des catégories doit être activée avec le SQL 20261027_avatar_categories.sql, puis recharge cette page.');
    })().catch(() => { if (alive) setError('Impossible de vérifier la connexion. Recharge la page.'); });
    return () => { alive = false; };
  }, [router]);

  useEffect(() => {
    const context = canvas.current?.getContext('2d');
    if (!context || !image) return;
    const side = Math.min(image.naturalWidth, image.naturalHeight) / zoom;
    context.clearRect(0, 0, 512, 512);
    context.drawImage(image, (image.naturalWidth - side) * x / 100, (image.naturalHeight - side) * y / 100, side, side, 0, 0, 512, 512);
  }, [image, zoom, x, y]);

  async function importImage(file?: File) {
    const version = ++fileVersion.current;
    setError(''); setMessage(''); setImage(null); setDecoding(false);
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 15 * 1024 * 1024) { setError('Choisis une image JPG, PNG ou WebP de moins de 15 Mo.'); return; }
    setDecoding(true);
    const url = URL.createObjectURL(file);
    try {
      const next = new Image(); next.src = url; await next.decode();
      if (version !== fileVersion.current) return;
      if (next.naturalWidth * next.naturalHeight > 40000000) throw new Error('Image trop grande : 40 millions de pixels maximum.');
      setImage(next); setZoom(1); setX(50); setY(50);
      if (!name) setName(file.name.replace(/\.[^.]+$/, '').slice(0, 60));
    } catch (cause) { if (version === fileVersion.current) setError(cause instanceof Error && cause.message.startsWith('Image trop') ? cause.message : 'Cette image ne peut pas être ouverte.'); }
    finally { URL.revokeObjectURL(url); if (version === fileVersion.current) setDecoding(false); }
  }

  async function addCategory(event: FormEvent) {
    event.preventDefault();
    const value = categoryName.trim();
    if (!value || value.length > 60 || busy || !categoriesReady) return;
    if (categories.some(item => item.toLocaleLowerCase('fr') === value.toLocaleLowerCase('fr'))) {
      setCategoryError('Cette catégorie existe déjà. Tu peux la choisir pour ton avatar.');
      return;
    }
    setBusy(true); setCategoryError(''); setError(''); setMessage('');
    try {
      const { data, error: createError } = await supabase.from('avatar_categories').insert({ name: value }).select('name').single();
      if (createError) {
        setCategoryError(createError.code === '23505' ? 'Cette catégorie existe déjà. Recharge la page pour la retrouver.' : 'Impossible de créer la catégorie. Vérifie ta connexion et tes droits administrateur.');
        return;
      }
      setSavedCategories(rows => [...rows, data.name]);
      setCategory(data.name); setCategoryName('');
      setMessage(`Catégorie « ${data.name} » créée ! Tu peux maintenant y ajouter des avatars.`);
    } catch { setCategoryError('Impossible de créer la catégorie. Réessaie dans un instant.'); }
    finally { setBusy(false); }
  }

  function reset() {
    ++fileVersion.current;
    setEditing(null); setImage(null); setName(''); setCategory(''); setDecoding(false);
    setZoom(1); setX(50); setY(50);
    if (input.current) input.current.value = '';
  }

  function edit(avatar: Avatar) {
    reset(); setEditing(avatar); setName(avatar.name); setCategory(avatar.category);
    setError(''); setMessage(''); setDeleteTarget(null);
    form.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    form.current?.querySelector<HTMLInputElement>('input[name="avatar-name"]')?.focus({ preventScroll: true });
  }

  async function remove(avatar: Avatar) {
    if (busy || !ready) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const { error: deleteError } = await supabase.from('profile_avatars').delete().eq('id', avatar.id).select('id').single();
      if (deleteError) throw deleteError;
      setAvatars(rows => rows.filter(row => row.id !== avatar.id));
      if (editing?.id === avatar.id) reset();
      setDeleteTarget(null);
      // Profiles store image URLs, so keep the file for people already using it.
      setMessage('Avatar supprimé de la bibliothèque. Les profils qui l’utilisent conservent leur photo.');
    } catch { setError('La suppression a échoué. Vérifie ta connexion et tes droits administrateur, puis réessaie.'); }
    finally { setBusy(false); }
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if ((!image && !editing) || (image && !canvas.current) || !name.trim() || !category.trim() || busy || !ready || decoding) return;
    setBusy(true); setError(''); setMessage('');
    const path = `${crypto.randomUUID()}.webp`;
    let uploaded = false;
    try {
      let imageUrl = editing?.image_url || '';
      if (image) {
        const blob = await new Promise<Blob>((resolve, reject) => canvas.current!.toBlob(value => value ? resolve(value) : reject(new Error('Conversion impossible.')), 'image/webp', 0.9));
        if (blob.type !== 'image/webp') throw new Error('Ce navigateur ne permet pas la conversion WebP. Essaie un navigateur récent.');
        const { error: uploadError } = await supabase.storage.from('profile-avatars').upload(path, blob, { contentType: 'image/webp', upsert: false });
        if (uploadError) throw uploadError;
        uploaded = true;
        imageUrl = supabase.storage.from('profile-avatars').getPublicUrl(path).data.publicUrl;
      }
      const payload = { name: name.trim(), category: category.trim(), image_url: imageUrl };
      const mutation = editing
        ? supabase.from('profile_avatars').update(payload).eq('id', editing.id)
        : supabase.from('profile_avatars').insert(payload);
      const { data, error: saveError } = await mutation.select('id,name,category,image_url').single();
      if (saveError) throw saveError;
      uploaded = false;
      setAvatars(rows => editing ? rows.map(row => row.id === data.id ? data : row) : [...rows, data]);
      setMessage(editing ? 'Avatar modifié ! La nouvelle version est disponible dans le sélecteur de profils.' : 'Avatar publié ! Il est disponible dans la création et la modification des profils.');
      reset();
    } catch (cause) {
      if (uploaded) await supabase.storage.from('profile-avatars').remove([path]);
      setError(cause instanceof Error ? cause.message : 'Enregistrement impossible. Vérifie ta connexion et réessaie.');
    } finally { setBusy(false); }
  }

  if (!authorized) return <main className="yf-page min-h-screen p-8 text-white"><p role="status">{error || 'Vérification de l’accès administrateur…'}</p></main>;
  const categories = Array.from(new Set([...DEFAULT_AVATAR_CATEGORIES.map(group => group.category), ...savedCategories, ...avatars.map(avatar => avatar.category)]));
  const field = 'mt-2 w-full rounded-xl border border-white/20 bg-black/30 p-3';
  return <main className="yf-page min-h-screen bg-[#0a0a0b] pb-16 text-white"><SectionNavigation admin />
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-8">
      <header><p className="text-sm text-blue-300">BIBLIOTHÈQUE DES PROFILS</p><h1 className="mt-2 text-3xl font-bold sm:text-4xl">{editing ? 'Modifier un avatar' : 'Crée un nouvel avatar'}</h1><p className="mt-3 text-zinc-400">Importe une image, ajuste le cadrage et choisis son nom et sa catégorie.</p><Link href="/profiles" className="mt-4 inline-block underline">Voir le sélecteur de profils →</Link></header>
      {error && <p role="alert" className="rounded-xl bg-red-500/10 p-4 text-red-200">{error}</p>}
      {message && <p role="status" className="rounded-xl bg-green-500/10 p-4 text-green-200">{message}</p>}
      <section aria-labelledby="categories-title" className="rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-6">
        <h2 id="categories-title" className="text-xl font-semibold">Catégories d’avatars</h2>
        <p className="mt-2 text-sm text-zinc-400">Crée une catégorie, même sans image. Clique sur son nom pour la choisir dans le formulaire d’avatar.</p>
        <form onSubmit={addCategory} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex-1 text-sm" htmlFor="new-avatar-category">Nom de la nouvelle catégorie<input id="new-avatar-category" required maxLength={60} value={categoryName} onChange={event => setCategoryName(event.target.value)} placeholder="Ex. : Animaux, Manga, Football…" disabled={busy || !categoriesReady} className={field} /></label>
          <button type="submit" disabled={busy || !categoriesReady || !categoryName.trim()} className="yf-primary min-h-12 rounded-full bg-blue-600 px-6 py-3 text-sm font-semibold disabled:opacity-40">Ajouter la catégorie</button>
        </form>
        {categoryError && <p role="alert" className="mt-3 text-sm text-amber-200">{categoryError}</p>}
        <div className="mt-4 flex flex-wrap gap-2">{categories.map(value => <button key={value} type="button" disabled={busy} aria-pressed={category === value} onClick={() => { setCategory(value); setCategoryError(''); }} className={`min-h-11 max-w-full break-words rounded-full border px-4 py-2 text-left text-sm ${category === value ? 'border-blue-400 bg-blue-500/20 text-blue-100' : 'border-white/20 text-zinc-300 hover:bg-white/10'}`}>{value}<span className="ml-2 text-xs text-zinc-400">{avatars.filter(avatar => avatar.category === value).length + (DEFAULT_AVATAR_CATEGORIES.find(group => group.category === value)?.avatars.length || 0)}</span></button>)}</div>
      </section>
      <form ref={form} onSubmit={save} className="rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-8"><fieldset disabled={busy || !ready} className="grid min-w-0 gap-8 md:grid-cols-2 disabled:opacity-60">
        <div className="min-w-0 space-y-5"><label className="block text-sm">Image source<input ref={input} type="file" accept="image/jpeg,image/png,image/webp" onChange={event => void importImage(event.target.files?.[0])} className={`${field} file:mr-3 file:rounded-lg file:border-0 file:bg-blue-600 file:p-2 file:text-white`} /><span className="mt-2 block text-xs text-zinc-400">JPG, PNG ou WebP · 15 Mo maximum{editing && ' · Facultatif : conserve l’image actuelle si tu ne choisis aucun fichier.'}</span></label>
          <label className="block text-sm">Nom de l’avatar<input name="avatar-name" required maxLength={60} value={name} onChange={event => setName(event.target.value)} className={field} placeholder="Ex. : Astronaute" /></label>
          <label className="block text-sm">Catégorie<input required maxLength={60} list="avatar-categories" value={category} onChange={event => setCategory(event.target.value)} className={field} placeholder="Choisis ou crée une catégorie" /><datalist id="avatar-categories">{categories.map(value => <option key={value} value={value} />)}</datalist></label>
          {image && <div className="space-y-4">{[{ label: 'Zoom', value: zoom, min: 1, max: 3, step: 0.05, change: setZoom }, { label: 'Position horizontale', value: x, min: 0, max: 100, step: 1, change: setX }, { label: 'Position verticale', value: y, min: 0, max: 100, step: 1, change: setY }].map(control => <label key={control.label} className="block text-sm">{control.label}<input type="range" min={control.min} max={control.max} step={control.step} value={control.value} onChange={event => control.change(Number(event.target.value))} className="mt-2 block min-h-8 w-full accent-blue-500" /></label>)}</div>}
        </div>
        <div className="flex min-w-0 flex-col items-center justify-center gap-4"><div className="aspect-square w-full max-w-72 overflow-hidden rounded-3xl border border-white/15 bg-black/30">{image ? <canvas ref={canvas} width={512} height={512} aria-label="Aperçu de l’avatar recadré" className="h-full w-full" /> : editing && !decoding ? <img src={editing.image_url} alt={`Avatar actuel : ${editing.name}`} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center p-6 text-center text-zinc-500">{decoding ? 'Lecture de l’image…' : 'Ton avatar apparaîtra ici'}</div>}</div><p className="text-sm text-zinc-400">Carré · 512 × 512 · WebP</p><button disabled={(!image && !editing) || busy || decoding || !name.trim() || !category.trim()} type="submit" className="yf-primary min-h-12 rounded-full bg-blue-600 px-7 py-3 font-semibold disabled:opacity-40">{busy ? 'Enregistrement…' : editing ? 'Enregistrer les modifications' : 'Publier l’avatar'}</button>{editing && <button type="button" onClick={() => { reset(); setError(''); setMessage(''); }} className="min-h-12 rounded-full border border-white/20 px-6 py-3">Annuler la modification</button>}</div>
      </fieldset></form>
      <section><h2 className="mb-4 text-xl font-semibold">Avatars importés ({avatars.length})</h2><div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">{avatars.map(avatar => <article key={avatar.id} className="min-w-0 rounded-2xl border border-white/10 bg-white/5 p-3"><img src={avatar.image_url} alt={avatar.name} className="aspect-square w-full rounded-xl object-cover" /><h3 className="mt-3 break-words text-sm font-semibold">{avatar.name}</h3><p className="mt-1 break-words text-xs text-zinc-400">{avatar.category}</p>
          <div className="mt-3 flex flex-col gap-2"><button type="button" disabled={busy || decoding} onClick={() => edit(avatar)} aria-label={`Modifier ${avatar.name}`} className="min-h-11 rounded-lg border border-white/20 px-2 py-2 text-sm hover:bg-white/10 disabled:opacity-40">Modifier</button>
          {deleteTarget === avatar.id ? <div className="space-y-2 rounded-lg border border-red-400/30 p-2"><p className="text-xs text-zinc-300">Retirer cet avatar du sélecteur ? Les photos des profils existants seront conservées.</p><button type="button" disabled={busy} onClick={() => void remove(avatar)} aria-label={`Confirmer la suppression de ${avatar.name}`} className="min-h-11 w-full rounded-lg bg-red-600 px-2 py-2 text-sm disabled:opacity-40">Confirmer</button><button type="button" disabled={busy} onClick={() => setDeleteTarget(null)} className="min-h-11 w-full rounded-lg border border-white/20 px-2 py-2 text-sm">Annuler</button></div> : <button type="button" disabled={busy || decoding} onClick={() => setDeleteTarget(avatar.id)} aria-label={`Supprimer ${avatar.name}`} className="min-h-11 rounded-lg border border-red-400/30 px-2 py-2 text-sm text-red-300 hover:bg-red-500/10 disabled:opacity-40">Supprimer</button>}</div></article>)}</div>{ready && !avatars.length && <p className="text-zinc-400">Importe ta première image pour enrichir les profils.</p>}</section>
    </div>
  </main>;
}
