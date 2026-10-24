'use client';

import { clearClientResources } from '@/lib/resource-cache';

import { fetchCatalogueCards } from '@/lib/client-catalogue';
import { createSearchMatcher } from '@/lib/search';

import SectionNavigation from '@/components/SectionNavigation';
import PageHero from '@/components/PageHero';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import styles from './banners.module.css';

interface MediaItem {
  id: string | number;
  title: string;
  type: 'movie' | 'series';
  poster: string;
}

interface BannerItem {
  id: string;
  title: string;
  subtitle?: string;
  backdrop: string;
  media_ids: string[];
  active: boolean;
  created_at: string;
}

export default function AdminBannersPage() {
  const router = useRouter();
  const ADMIN_EMAIL = 'lukas.leclerc312@gmail.com';

  const [loadingAuth, setLoadingAuth] = useState(true);
  const [mediaList, setMediaList] = useState<MediaItem[]>([]);
  const [banners, setBanners] = useState<BannerItem[]>([]);

  // Formulaire
  const [search, setSearch] = useState('');
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [backdrop, setBackdrop] = useState('');
  const [selectedMediaIds, setSelectedMediaIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || session.user.email !== ADMIN_EMAIL) {
        router.push('/');
        return;
      }
      setLoadingAuth(false);
      fetchMedia();
      fetchBanners();
    }
    init();
  }, [router]);

  async function fetchMedia() {
    clearClientResources();
    try { setMediaList(await fetchCatalogueCards<MediaItem>(supabase)); }
    catch { setErrorMsg('Impossible de charger les titres du catalogue. Actualise la page pour réessayer.'); }
  };

  async function fetchBanners() {
    clearClientResources();
    const { data, error } = await supabase
      .from('banners')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setBanners(data);
    if (error) setErrorMsg('Impossible de charger les bannières. Actualise la page pour réessayer.');
  };

  const handleMediaToggle = (mediaId: string) => {
    if (selectedMediaIds.includes(mediaId)) {
      setSelectedMediaIds(selectedMediaIds.filter(id => id !== mediaId));
    } else {
      setSelectedMediaIds([...selectedMediaIds, mediaId]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !backdrop.trim()) return;

    setSubmitting(true);
    setMessage('');
    setErrorMsg('');

    clearClientResources();

    const { error } = await supabase.from('banners').insert([
      {
        title: title.trim(),
        subtitle: subtitle.trim() || null,
        backdrop: backdrop.trim(),
        media_ids: selectedMediaIds,
        active: true,
      }
    ]);

    if (error) {
      setErrorMsg(`Erreur : ${error.message}`);
    } else {
      setMessage('Bannière publiée avec succès sur la page d\'accueil !');
      setTitle('');
      setSubtitle('');
      setBackdrop('');
      setSelectedMediaIds([]);
      fetchBanners();
    }
    setSubmitting(false);
  };

  const handleDeleteBanner = async (id: string) => {
    if (!confirm('Voulez-vous supprimer cette bannière ?')) return;
    clearClientResources();
    const { error } = await supabase.from('banners').delete().eq('id', id);
    if (!error) {
      fetchBanners();
    }
    else setErrorMsg('La bannière n’a pas été supprimée. Réessaie.');
  };

  const toggleActive = async (id: string, currentActive: boolean) => {
    const { error } = await supabase
      .from('banners')
      .update({ active: !currentActive })
      .eq('id', id);
    if (!error) fetchBanners();
    else setErrorMsg('Le statut de la bannière n’a pas été enregistré. Réessaie.');
  };

  if (loadingAuth) {
    return <main className={`yf-page yf-banners ${styles.page}`}><div className={styles.loading}>Vérification de votre accès administrateur…</div></main>;
  }

  const filteredMedia = mediaList.filter(item => createSearchMatcher(search)(item.title));
  const selectedMedia = mediaList.filter(item => selectedMediaIds.includes(String(item.id)));

  return (
    <main className={`yf-page yf-banners ${styles.page}`}>
      <nav className={styles.nav} aria-label="Navigation administration">
        <a className={styles.brand} href="/">YAMON<span>FIM</span><small>STUDIO</small></a>
        <div className={styles.navLinks}><a href="/admin">← Administration</a><a href="/">Voir le site ↗</a></div>
      </nav>
      <SectionNavigation admin />
      <div className={styles.container}>
        <PageHero eyebrow="VOTRE VITRINE, VOTRE UNIVERS" title="Crée l’ambiance." accent="Donne envie de cliquer." description="Une sélection, un beau visuel et des titres à découvrir : compose les bannières qui donnent le ton à la page d’accueil." cardLabel="LES BANNIÈRES" cardTitle="Une sélection. Une ambiance." cardDetail={`${banners.filter(b => b.active).length} BANNIÈRES EN LIGNE`} variant="collection" />
        {message && <p className={styles.success} role="status">{message}</p>}
        {errorMsg && <p className={styles.error} role="alert">{errorMsg}</p>}
        <div className={styles.workspace}>
          <section className={styles.panel}>
            <div className={styles.sectionTitle}><span className={styles.number}>01</span><div><h2>Composer une bannière</h2><p>Une ambiance. Une sélection. Une nouvelle découverte.</p></div></div>
            <form onSubmit={handleSubmit} className={styles.form}>
              <label htmlFor="banner-title">Titre de la sélection<input id="banner-title" required placeholder="Ex. Les nuits du frisson" value={title} onChange={e => setTitle(e.target.value)} /></label>
              <label htmlFor="banner-subtitle">Sous-titre <span>Facultatif</span><input id="banner-subtitle" placeholder="Des films à regarder les lumières éteintes…" value={subtitle} onChange={e => setSubtitle(e.target.value)} /></label>
              <label htmlFor="banner-backdrop">Image de couverture<input id="banner-backdrop" type="url" required placeholder="https://image.tmdb.org/t/p/original/…" value={backdrop} onChange={e => setBackdrop(e.target.value)} /><small>Choisissez une image panoramique pour un rendu cinématographique.</small></label>
              <div className={styles.divider} />
              <div className={styles.selectionHeading}><h3>Votre casting</h3><span>{selectedMediaIds.length} sélectionné{selectedMediaIds.length > 1 ? 's' : ''}</span></div>
              <input aria-label="Rechercher un film ou une série" type="search" placeholder="Rechercher un film, une série…" value={search} onChange={e => setSearch(e.target.value)} />
              <div className={styles.mediaList}>
                {filteredMedia.map(m => {
                  const selected = selectedMediaIds.includes(String(m.id));
                  return <button type="button" key={m.id} aria-pressed={selected} onClick={() => handleMediaToggle(String(m.id))} className={`${styles.media} ${selected ? styles.selected : ''}`}>
                    <div className={styles.poster}>{m.poster && <img src={m.poster} alt="" />}</div><span className={styles.mediaName}><strong>{m.title}</strong><small>{m.type === 'movie' ? 'FILM' : 'SÉRIE'}</small></span><span className={styles.check}>{selected ? '✓' : '+'}</span>
                  </button>;
                })}
                {filteredMedia.length === 0 && <p className={styles.empty}>{search ? 'Aucun titre ne correspond à votre recherche.' : 'Votre catalogue est encore vide.'}</p>}
              </div>
              <button type="submit" className={styles.publish} disabled={submitting}>{submitting ? 'Publication en cours…' : 'Publier la bannière'}<span aria-hidden="true">↗</span></button>
              <p className={styles.formNote}>La bannière sera visible sur la page d’accueil dès sa publication.</p>
            </form>
          </section>
          <aside className={styles.previewColumn}>
            <div className={styles.previewLabel}><span className={styles.liveDot} /> APERÇU EN DIRECT<span>PAGE D’ACCUEIL</span></div>
            <div className={styles.preview}>
              {backdrop && <img className={styles.cover} src={backdrop} alt="Aperçu de la couverture" />}
              <div className={styles.previewContent}><span className={styles.badge}>LA SÉLECTION YAMONFIM</span><h2>{title || 'Votre prochaine obsession.'}</h2><p>{subtitle || 'Une collection à votre image. Ajoutez un titre et laissez la magie opérer.'}</p><span className={styles.discover}>Découvrir la sélection <span>→</span></span></div>
            </div>
            <div className={styles.filmstrip}>{selectedMedia.slice(0, 5).map(m => <div key={m.id} className={styles.miniPoster}>{m.poster ? <img src={m.poster} alt={m.title} /> : <span>{m.title}</span>}</div>)}{selectedMedia.length === 0 && <p>Les affiches de votre sélection apparaîtront ici.</p>}</div>
            <div className={styles.tip}><span>✦</span><div><h3>Le détail qui change tout</h3><p>Un titre court, une belle image et des films qui partagent la même énergie : les meilleures sélections racontent déjà une histoire.</p></div></div>
          </aside>
        </div>
        <section className={styles.library}>
          <div className={styles.libraryHeading}><div className={styles.sectionTitle}><span className={styles.number}>02</span><div><h2>Vos sélections</h2><p>Gérez ce qui passe sous les projecteurs.</p></div></div><span className={styles.total}>{banners.length} au total</span></div>
          {banners.length === 0 ? <div className={styles.emptyLibrary}><span>✧</span><h3>Le début d’une belle programmation.</h3><p>Votre première bannière trouvera sa place ici.</p></div> : <div className={styles.cards}>{banners.map(b => <article key={b.id} className={styles.card}>
            <div className={styles.cardVisual}><img src={b.backdrop} alt="" /><span className={`${styles.status} ${b.active ? styles.active : ''}`}>{b.active ? '● En ligne' : '○ Masquée'}</span><div><h3>{b.title}</h3>{b.subtitle && <p>{b.subtitle}</p>}</div></div>
            <footer><span>{b.media_ids?.length || 0} titres associés</span><div><button type="button" onClick={() => toggleActive(b.id, b.active)}>{b.active ? 'Masquer' : 'Afficher'}</button><button type="button" className={styles.delete} aria-label={`Supprimer ${b.title}`} onClick={() => handleDeleteBanner(b.id)}>Supprimer</button></div></footer>
          </article>)}</div>}
        </section>
        <footer className={styles.bottom}>YAMONFIM STUDIO<span>Le cinéma commence par une bonne sélection.</span></footer>
      </div>
    </main>
  );
}
