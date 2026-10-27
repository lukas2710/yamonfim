'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import SectionNavigation from '@/components/SectionNavigation';
import { getPersistentSession } from '@/lib/auth-session';
import { supabase } from '@/lib/supabase';
import { DEFAULT_AVATAR_CATEGORIES, fetchAvatars, type Avatar } from '@/lib/avatars';

export default function AdminAvatarsPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [ready, setReady] = useState(false);
  const [avatars, setAvatars] = useState<Avatar[]>([]);
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
      try { const rows = await fetchAvatars(); if (alive) { setAvatars(rows); setReady(true); } }
      catch { if (alive) setError('La bibliothèque est indisponible. Applique la migration Supabase 20261027_profile_avatars.sql puis recharge la page.'); }
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

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!image || !canvas.current || !name.trim() || !category.trim() || busy || !ready || decoding) return;
    setBusy(true); setError(''); setMessage('');
    const path = `${crypto.randomUUID()}.webp`;
    let uploaded = false;
    try {
      const blob = await new Promise<Blob>((resolve, reject) => canvas.current!.toBlob(value => value ? resolve(value) : reject(new Error('Conversion impossible.')), 'image/webp', 0.9));
      if (blob.type !== 'image/webp') throw new Error('Ce navigateur ne permet pas la conversion WebP. Essaie un navigateur récent.');
      const { error: uploadError } = await supabase.storage.from('profile-avatars').upload(path, blob, { contentType: 'image/webp', upsert: false });
      if (uploadError) throw uploadError;
      uploaded = true;
      const { data: { publicUrl } } = supabase.storage.from('profile-avatars').getPublicUrl(path);
      const { data, error: insertError } = await supabase.from('profile_avatars').insert({ name: name.trim(), category: category.trim(), image_url: publicUrl }).select('id,name,category,image_url').single();
      if (insertError) throw insertError;
      uploaded = false;
      setAvatars(rows => [...rows, data]); setImage(null); setName('');
      if (input.current) input.current.value = '';
      setMessage('Avatar publié ! Il est disponible dans la création et la modification des profils.');
    } catch (cause) {
      if (uploaded) await supabase.storage.from('profile-avatars').remove([path]);
      setError(cause instanceof Error ? cause.message : 'Import impossible. Vérifie le stockage Supabase et réessaie.');
    } finally { setBusy(false); }
  }

  if (!authorized) return <main className="yf-page min-h-screen p-8 text-white"><p role="status">{error || 'Vérification de l’accès administrateur…'}</p></main>;
  const categories = Array.from(new Set([...DEFAULT_AVATAR_CATEGORIES.map(group => group.category), ...avatars.map(avatar => avatar.category)]));
  const field = 'mt-2 w-full rounded-xl border border-white/20 bg-black/30 p-3';
  return <main className="yf-page min-h-screen bg-[#0a0a0b] pb-16 text-white"><SectionNavigation admin />
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-8">
      <header><p className="text-sm text-blue-300">BIBLIOTHÈQUE DES PROFILS</p><h1 className="mt-2 text-3xl font-bold sm:text-4xl">Crée un nouvel avatar</h1><p className="mt-3 text-zinc-400">Importe une image, ajuste le cadrage et choisis son nom et sa catégorie.</p><Link href="/profiles" className="mt-4 inline-block underline">Voir le sélecteur de profils →</Link></header>
      {error && <p role="alert" className="rounded-xl bg-red-500/10 p-4 text-red-200">{error}</p>}
      {message && <p role="status" className="rounded-xl bg-green-500/10 p-4 text-green-200">{message}</p>}
      <form onSubmit={save} className="rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-8"><fieldset disabled={busy || !ready} className="grid min-w-0 gap-8 md:grid-cols-2 disabled:opacity-60">
        <div className="min-w-0 space-y-5"><label className="block text-sm">Image source<input ref={input} type="file" accept="image/jpeg,image/png,image/webp" onChange={event => void importImage(event.target.files?.[0])} className={`${field} file:mr-3 file:rounded-lg file:border-0 file:bg-blue-600 file:p-2 file:text-white`} /><span className="mt-2 block text-xs text-zinc-400">JPG, PNG ou WebP · 15 Mo maximum</span></label>
          <label className="block text-sm">Nom de l’avatar<input required maxLength={60} value={name} onChange={event => setName(event.target.value)} className={field} placeholder="Ex. : Astronaute" /></label>
          <label className="block text-sm">Catégorie<input required maxLength={60} list="avatar-categories" value={category} onChange={event => setCategory(event.target.value)} className={field} placeholder="Choisis ou crée une catégorie" /><datalist id="avatar-categories">{categories.map(value => <option key={value} value={value} />)}</datalist></label>
          {image && <div className="space-y-4">{[{ label: 'Zoom', value: zoom, min: 1, max: 3, step: 0.05, change: setZoom }, { label: 'Position horizontale', value: x, min: 0, max: 100, step: 1, change: setX }, { label: 'Position verticale', value: y, min: 0, max: 100, step: 1, change: setY }].map(control => <label key={control.label} className="block text-sm">{control.label}<input type="range" min={control.min} max={control.max} step={control.step} value={control.value} onChange={event => control.change(Number(event.target.value))} className="mt-2 block min-h-8 w-full accent-blue-500" /></label>)}</div>}
        </div>
        <div className="flex min-w-0 flex-col items-center justify-center gap-4"><div className="aspect-square w-full max-w-72 overflow-hidden rounded-3xl border border-white/15 bg-black/30">{image ? <canvas ref={canvas} width={512} height={512} aria-label="Aperçu de l’avatar recadré" className="h-full w-full" /> : <div className="flex h-full items-center justify-center p-6 text-center text-zinc-500">{decoding ? 'Lecture de l’image…' : 'Ton avatar apparaîtra ici'}</div>}</div><p className="text-sm text-zinc-400">Carré · 512 × 512 · WebP</p><button disabled={!image || busy || decoding || !name.trim() || !category.trim()} type="submit" className="yf-primary min-h-12 rounded-full bg-blue-600 px-7 py-3 font-semibold disabled:opacity-40">{busy ? 'Publication…' : 'Publier l’avatar'}</button></div>
      </fieldset></form>
      <section><h2 className="mb-4 text-xl font-semibold">Avatars importés ({avatars.length})</h2><div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">{avatars.map(avatar => <article key={avatar.id} className="min-w-0 rounded-2xl border border-white/10 bg-white/5 p-3"><img src={avatar.image_url} alt={avatar.name} className="aspect-square w-full rounded-xl object-cover" /><h3 className="mt-3 break-words text-sm font-semibold">{avatar.name}</h3><p className="mt-1 break-words text-xs text-zinc-400">{avatar.category}</p></article>)}</div>{ready && !avatars.length && <p className="text-zinc-400">Importe ta première image pour enrichir les profils.</p>}</section>
    </div>
  </main>;
}
