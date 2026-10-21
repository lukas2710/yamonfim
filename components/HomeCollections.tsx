'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { collectionItems, safeCollectionImage, type CollectionMedia, type MediaCollection } from '@/lib/collections';

export default function HomeCollections<T extends CollectionMedia>({ catalogue, onOpen, admin }: { catalogue: T[]; onOpen: (item: T) => void; admin: boolean }) {
  const [collections, setCollections] = useState<MediaCollection[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const cards = useRef(new Map<string, HTMLButtonElement>());
  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const { data, error } = await supabase.from('media_collections').select('*').eq('active', true).order('position').order('created_at');
        if (alive) { setCollections(data || []); setError(!!error); }
      } catch { if (alive) setError(true); }
    }
    void load();
    return () => { alive = false; };
  }, []);
  useEffect(() => {
    if (!selected) return;
    panel.current?.focus({ preventScroll: true });
    panel.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  }, [selected]);
  const visible = collections.map(collection => ({ collection, items: collectionItems(collection, catalogue) })).filter(group => group.items.length);
  const current = visible.find(group => group.collection.id === selected);
  if (!visible.length && !admin) return null;
  return <section className="yf-collections" aria-labelledby="collections-title">
    <div className="yf-collections-heading"><div><p className="yf-eyebrow">LES GRANDES HISTOIRES SE PARTAGENT</p><h2 id="collections-title">Explore les collections<span>.</span></h2><p>Une saga. Un univers. Tous ses titres au même endroit.</p></div>{admin && <Link className="yf-collection-manage" href="/admin/collections">+ Gérer les collections</Link>}</div>
    {error && admin && <p role="status" className="yf-collection-empty">Les collections ne peuvent pas encore être chargées. Ouvre leur gestion pour vérifier la configuration.</p>}
    {!error && !visible.length && admin && <p className="yf-collection-empty">Crée ta première collection : Fast &amp; Furious, Star Wars, ou un univers de ton choix.</p>}
    <div className="yf-collection-grid">{visible.map(({ collection, items }) => {
      const cover = safeCollectionImage(collection.cover_url) || items[0].backdrop || items[0].poster;
      return <button key={collection.id} ref={element => { if (element) cards.current.set(collection.id, element); else cards.current.delete(collection.id); }} className="yf-collection-card" aria-expanded={selected === collection.id} aria-controls="collection-titles" onClick={() => setSelected(selected === collection.id ? null : collection.id)}>
        {cover && <img src={cover} alt="" loading="lazy" />}<span className="yf-collection-shade" /><span className="yf-collection-count">{items.length} titre{items.length > 1 ? 's' : ''}</span><span className="yf-collection-card-copy"><span>COLLECTION</span><strong>{collection.title}</strong><span>Explorer l’univers <span aria-hidden="true">↗</span></span></span>
      </button>;
    })}</div>
    {current && <div ref={panel} tabIndex={-1} id="collection-titles" className="yf-collection-panel" aria-label={`Titres de ${current.collection.title}`}>
      <div className="yf-collections-heading"><div><p className="yf-eyebrow">DANS CETTE COLLECTION</p><h3>{current.collection.title}</h3>{current.collection.description && <p>{current.collection.description}</p>}</div><button className="yf-collection-manage" onClick={() => { setSelected(null); cards.current.get(current.collection.id)?.focus(); }}>Fermer ×</button></div>
      <div className="yf-collection-titles">{current.items.map(item => <button key={item.id} className="yf-collection-title" onClick={() => onOpen(item)}>{item.poster ? <img src={item.poster} alt="" loading="lazy" /> : <span className="yf-collection-no-poster" aria-hidden="true">▶</span>}<span>{item.type === 'series' ? 'SÉRIE' : 'FILM'}</span><strong>{item.title}</strong><span className="yf-collection-open">Voir la fiche ↗</span></button>)}</div>
    </div>}
  </section>;
}
