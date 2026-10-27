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
import { parseBannerEntry, bannerEntry, findSeason, type SeasonSummary } from '@/lib/banner-items';

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
  ranked?: boolean;
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
  const [seasonsById, setSeasonsById] = useState<Record<string, SeasonSummary[]>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [ranked, setRanked] = useState(false);

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

  const isSelected = (mediaId: string) => selectedMediaIds.some(entry => parseBannerEntry(entry).mediaId === mediaId);
  const handleMediaToggle = (mediaId: string) => {
    if (isSelected(mediaId)) setSelectedMediaIds(selectedMediaIds.filter(entry => parseBannerEntry(entry).mediaId !== mediaId));
    else setSelectedMediaIds([...selectedMediaIds, mediaId]);
    const item = mediaList.find(m => String(m.id) === mediaId);
    if (item?.type === 'series' && !seasonsById[mediaId]) void loadSeasons(mediaId);
  };
  // Season list is loaded only for series added to a banner.
  async function loadSeasons(mediaId: string) {
    const { data } = await supabase.from('media').select('seasons').eq('id', mediaId).maybeSingle();
    setSeasonsById(previous => ({ ...previous, [mediaId]: Array.isArray(data?.seasons) ? data.seasons : [] }));
  }
  const chooseSeason = (mediaId: string, season: number | null) => setSelectedMediaIds(selectedMediaIds.map(entry => parseBannerEntry(entry).mediaId === mediaId ? bannerEntry(mediaId, season) : entry));


  const resetForm = () => {
    setEditingId(null);
    setTitle('');
    setSubtitle('');
    setBackdrop('');
    setSelectedMediaIds([]);
    setRanked(false);
  };
  const moveEntry = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= selectedMediaIds.length) return;
    const entries = [...selectedMediaIds];
    [entries[index], entries[target]] = [entries[target], entries[index]];
    setSelectedMediaIds(entries);
  };

  // Load an existing banner into the form; saving then updates it instead of creating a new one.
  const startEditing = (banner: BannerItem) => {
    setEditingId(banner.id);
    setTitle(banner.title);
    setSubtitle(banner.subtitle ?? '');
    setBackdrop(banner.backdrop);
    const entries = (banner.media_ids ?? []).map(String);
    setSelectedMediaIds(entries);
    setRanked(banner.ranked === true);
    setMessage('');
    setErrorMsg('');
    for (const id of new Set(entries.map(entry => parseBannerEntry(entry).mediaId))) {
      const item = mediaList.find(m => String(m.id) === id);
      if (item?.type === 'series' && !seasonsById[id]) void loadSeasons(id);
    }
    document.getElementById('banner-title')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !backdrop.trim()) return;

    setSubmitting(true);
    setMessage('');
    setErrorMsg('');

    clearClientResources();

    const fields = {
      title: title.trim(),
      subtitle: subtitle.trim() || null,
      backdrop: backdrop.trim(),
      media_ids: selectedMediaIds,
      // Only sent once the ranking column exists (20261024_banner_ranking.sql), so banners keep working before.
      ...(ranked || banners.some(b => 'ranked' in b) ? { ranked } : {}),
    };
    // .select() reveals a change silently refused by the database rules (0 rows).
    const { data, error } = editingId
      ? await supabase.from('banners').update(fields).eq('id', editingId).select('id')
      : await supabase.from('banners').insert([{ ...fields, active: true }]).select('id');

    if (error) {
      setErrorMsg(error.message.includes('ranked') ? 'Pour le Top numéroté, exécute d’abord supabase/migrations/20261024_banner_ranking.sql dans Supabase.' : `Erreur : ${error.message}`);
    } else if (!data?.length) {
      setErrorMsg('La base de données a refusé l’enregistrement. Vérifie les droits de la table « banners » dans Supabase.');
    } else {
      setMessage(editingId ? 'Bannière modifiée : la page d’accueil est à jour.' : 'Bannière publiée avec succès sur la page d\'accueil !');
      resetForm();
      fetchBanners();
    }
    setSubmitting(false);
  };

  const handleDeleteBanner = async (banner: BannerItem) => {
    if (!confirm(`Supprimer définitivement la bannière « ${banner.title} » ?`)) return;
    clearClientResources();
    setMessage('');
    setErrorMsg('');
    const { data, error } = await supabase.from('banners').delete().eq('id', banner.id).select('id');
    if (error || !data?.length) setErrorMsg('La bannière n’a pas été supprimée. Vérifie les droits de la table « banners » dans Supabase.');
    else {
      if (editingId === banner.id) resetForm();
      setMessage(`Bannière « ${banner.title} » supprimée.`);
      fetchBanners();
    }
  };

  const toggleActive = async (id: string, currentActive: boolean) => {
    clearClientResources();
    const { data, error } = await supabase
      .from('banners')
      .update({ active: !currentActive })
      .eq('id', id)
      .select('id');
    if (!error && data?.length) fetchBanners();
    else setErrorMsg('Le statut de la bannière n’a pas été enregistré. Vérifie les droits de la table « banners » dans Supabase.');
  };

  if (loadingAuth) {
    return <main className={`yf-page yf-banners ${styles.page}`}><div className={styles.loading}>Vérification de votre accès administrateur…</div></main>;
  }

  const filteredMedia = mediaList.filter(item => createSearchMatcher(search)(item.title));
  const selectedMedia = selectedMediaIds.flatMap(entry => {
    const { mediaId, season } = parseBannerEntry(entry);
    const item = mediaList.find(m => String(m.id) === mediaId);
    if (!item) return [];
    const found = season === null ? null : findSeason(seasonsById[mediaId], season);
    return [{ ...item, key: entry, season, poster: found?.season.poster_path || item.poster }];
  });
  const selectedSeries = selectedMedia.filter(m => m.type === 'series');

  return (
    <main className={`yf-page yf-banners ${styles.page}`}>
      <nav className={styles.nav} aria-label="Navigation administration">
        <a className={styles.brand} href="/">YAMON<span>FILM</span><small>STUDIO</small></a>
        <div className={styles.navLinks}><a href="/admin">← Administration</a><a href="/">Voir le site ↗</a></div>
      </nav>
      <SectionNavigation admin />
      <div className={styles.container}>
        <PageHero eyebrow="VOTRE VITRINE, VOTRE UNIVERS" title="Crée l’ambiance." accent="Donne envie de cliquer." description="Une sélection, un beau visuel et des titres à découvrir : compose les bannières qui donnent le ton à la page d’accueil." cardLabel="LES BANNIÈRES" cardTitle="Une sélection. Une ambiance." cardDetail={`${banners.filter(b => b.active).length} BANNIÈRES EN LIGNE`} variant="collection" />
        {message && <p className={styles.success} role="status">{message}</p>}
        {errorMsg && <p className={styles.error} role="alert">{errorMsg}</p>}
        <div className={styles.workspace}>
          <section className={styles.panel}>
            <div className={styles.sectionTitle}><span className={styles.number}>01</span><div><h2>{editingId ? 'Modifier la bannière' : 'Composer une bannière'}</h2><p>Une ambiance. Une sélection. Une nouvelle découverte.</p></div></div>
            <form onSubmit={handleSubmit} className={styles.form}>
              <label htmlFor="banner-title">Titre de la sélection<input id="banner-title" required placeholder="Ex. Les nuits du frisson" value={title} onChange={e => setTitle(e.target.value)} /></label>
              <label htmlFor="banner-subtitle">Sous-titre <span>Facultatif</span><input id="banner-subtitle" placeholder="Des films à regarder les lumières éteintes…" value={subtitle} onChange={e => setSubtitle(e.target.value)} /></label>
              <label htmlFor="banner-backdrop">Image de couverture<input id="banner-backdrop" type="url" required placeholder="https://image.tmdb.org/t/p/original/…" value={backdrop} onChange={e => setBackdrop(e.target.value)} /><small>Choisissez une image panoramique pour un rendu cinématographique.</small></label>
              <div className={styles.divider} />
              <div className={styles.selectionHeading}><h3>Votre casting</h3><span>{selectedMediaIds.length} sélectionné{selectedMediaIds.length > 1 ? 's' : ''}</span></div>
              <input aria-label="Rechercher un film ou une série" type="search" placeholder="Rechercher un film, une série…" value={search} onChange={e => setSearch(e.target.value)} />
              <div className={styles.mediaList}>
                {filteredMedia.map(m => {
                  const selected = isSelected(String(m.id));
                  return <button type="button" key={m.id} aria-pressed={selected} onClick={() => handleMediaToggle(String(m.id))} className={`${styles.media} ${selected ? styles.selected : ''}`}>
                    <div className={styles.poster}>{m.poster && <img src={m.poster} alt="" />}</div><span className={styles.mediaName}><strong>{m.title}</strong><small>{m.type === 'movie' ? 'FILM' : 'SÉRIE'}</small></span><span className={styles.check}>{selected ? '✓' : '+'}</span>
                  </button>;
                })}
                {filteredMedia.length === 0 && <p className={styles.empty}>{search ? 'Aucun titre ne correspond à votre recherche.' : 'Votre catalogue est encore vide.'}</p>}
              </div>
              {selectedSeries.length > 0 && <div className={styles.seasons}>
                <p>Pour une série, choisis la série complète ou mets en avant une saison : sa carte affichera l’affiche de la saison et l’étiquette « Nouveau », et ouvrira la série sur cette saison.</p>
                {selectedSeries.map(m => <div key={m.id} className={styles.seasonRow}><strong>{m.title}</strong><div className={styles.seasonChips}>
                  <button type="button" aria-pressed={m.season === null} onClick={() => chooseSeason(String(m.id), null)}>Série complète</button>
                  {!seasonsById[String(m.id)] ? <span className={styles.seasonTag}>Chargement des saisons…</span> : seasonsById[String(m.id)].map((s, i) => { const number = s.seasonNumber ?? i + 1; return <button type="button" key={number} aria-pressed={m.season === number} onClick={() => chooseSeason(String(m.id), number)}>Saison {number}</button>; })}
                </div></div>)}
              </div>}
              {selectedMedia.length > 0 && <div className={styles.seasons}>
                <label className={styles.rankToggle}><input type="checkbox" checked={ranked} onChange={e => setRanked(e.target.checked)} /><span><strong>Top numéroté</strong> : affiche les grands chiffres 1, 2, 3… devant les affiches (ex. « Top 5 des meilleures séries »).</span></label>
                <ol className={styles.order}>{selectedMedia.map((m, i) => <li key={m.key}>
                  <span className={styles.rank}>{i + 1}</span>
                  <span className={styles.orderTitle}>{m.title}{m.season !== null && <small> · Saison {m.season}</small>}</span>
                  <button type="button" aria-label={`Monter ${m.title}`} disabled={i === 0} onClick={() => moveEntry(i, -1)}>↑</button>
                  <button type="button" aria-label={`Descendre ${m.title}`} disabled={i === selectedMedia.length - 1} onClick={() => moveEntry(i, 1)}>↓</button>
                </li>)}</ol>
              </div>}
              <button type="submit" className={styles.publish} disabled={submitting}>{submitting ? 'Enregistrement…' : editingId ? 'Enregistrer les modifications' : 'Publier la bannière'}<span aria-hidden="true">↗</span></button>
              {editingId ? <button type="button" className={styles.cancelEdit} onClick={resetForm}>Annuler la modification</button> : <p className={styles.formNote}>La bannière sera visible sur la page d’accueil dès sa publication.</p>}
            </form>
          </section>
          <aside className={styles.previewColumn}>
            <div className={styles.previewLabel}><span className={styles.liveDot} /> APERÇU EN DIRECT<span>PAGE D’ACCUEIL</span></div>
            <div className={styles.preview}>
              {backdrop && <img className={styles.cover} src={backdrop} alt="Aperçu de la couverture" />}
              <div className={styles.previewContent}><span className={styles.badge}>LA SÉLECTION YAMONFIM</span><h2>{title || 'Votre prochaine obsession.'}</h2><p>{subtitle || 'Une collection à votre image. Ajoutez un titre et laissez la magie opérer.'}</p><span className={styles.discover}>Découvrir la sélection <span>→</span></span></div>
            </div>
            <div className={styles.filmstrip}>{selectedMedia.slice(0, 5).map((m, i) => <div key={m.key} className={styles.miniPoster}>{ranked && <span className={styles.miniRank}>{i + 1}</span>}{m.poster ? <img src={m.poster} alt={m.season === null ? m.title : m.title + ' – saison ' + m.season} /> : <span>{m.title}</span>}</div>)}{selectedMedia.length === 0 && <p>Les affiches de votre sélection apparaîtront ici.</p>}</div>
            <div className={styles.tip}><span>✦</span><div><h3>Le détail qui change tout</h3><p>Un titre court, une belle image et des films qui partagent la même énergie : les meilleures sélections racontent déjà une histoire.</p></div></div>
          </aside>
        </div>
        <section className={styles.library}>
          <div className={styles.libraryHeading}><div className={styles.sectionTitle}><span className={styles.number}>02</span><div><h2>Vos sélections</h2><p>Gérez ce qui passe sous les projecteurs.</p></div></div><span className={styles.total}>{banners.length} au total</span></div>
          {banners.length === 0 ? <div className={styles.emptyLibrary}><span>✧</span><h3>Le début d’une belle programmation.</h3><p>Votre première bannière trouvera sa place ici.</p></div> : <div className={styles.cards}>{banners.map(b => <article key={b.id} className={`${styles.card} ${editingId === b.id ? styles.editing : ''}`}>
            <div className={styles.cardVisual}><img src={b.backdrop} alt="" /><span className={`${styles.status} ${b.active ? styles.active : ''}`}>{b.active ? '● En ligne' : '○ Masquée'}</span><div><h3>{b.title}</h3>{b.subtitle && <p>{b.subtitle}</p>}</div></div>
            <footer><span>{b.media_ids?.length || 0} titres associés{b.ranked ? ' · Top numéroté' : ''}</span><div><button type="button" onClick={() => startEditing(b)}>Modifier</button><button type="button" onClick={() => toggleActive(b.id, b.active)}>{b.active ? 'Masquer' : 'Afficher'}</button><button type="button" className={styles.delete} aria-label={`Supprimer ${b.title}`} onClick={() => void handleDeleteBanner(b)}>Supprimer</button></div></footer>
          </article>)}</div>}
        </section>
        <footer className={styles.bottom}>YAMONFIM STUDIO<span>Le cinéma commence par une bonne sélection.</span></footer>
      </div>
    </main>
  );
}
