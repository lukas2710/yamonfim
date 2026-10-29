'use client';

import { clearClientResources } from '@/lib/resource-cache';

import { fetchCatalogueRows } from '@/lib/catalogue';
import { createSearchMatcher, searchQueryVariants } from '@/lib/search';

import SectionNavigation from '@/components/SectionNavigation';
import PageHero from '@/components/PageHero';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import ExtraLinks from './ExtraLinks';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { findContentDuplicate, duplicateErrorMessage } from '@/lib/content-identity';
import { checkContentDuplicate } from '@/lib/content-duplicates';
import { getPersistentSession } from '@/lib/auth-session';
import { cataloguePlayer } from '@/lib/catalogue-source';
import { normalizeSeriesParts, isLupin } from '@/lib/series-parts';

interface Episode {
  sourcePosition?: { s: number; e: number };
  number: number;
  title: string;
  embedUrl: string;
  still_path?: string;
  runtime?: number;
}

interface Season {
  seasonNumber: number;
  episodes: Episode[];
  poster_path?: string;
}

interface MediaItem {
  id: any;
  tmdb_id?: any;
  title: string;
  type: 'movie' | 'series';
  poster: string;
  backdrop?: string;
  url: string;
  embedUrl?: string;
  description: string;
  genres?: string[];
  seasons?: Season[];
  created_at?: string;
}

const ADMIN_EMAIL = 'lukas.leclerc312@gmail.com';
const TMDB_KEY = 'af281c5089038e174e83c576ff765be9';

const EMPTY_SEASONS: Season[] = [
  { seasonNumber: 1, episodes: [{ number: 1, title: 'Épisode 1', embedUrl: '', runtime: 45 }] },
];

type IconName =
  | 'search' | 'film' | 'tv' | 'plus' | 'edit' | 'trash' | 'close' | 'check'
  | 'alert' | 'back' | 'image' | 'chevron' | 'layers' | 'save' | 'sparkles' | 'refresh';

const ICONS: Record<IconName, React.ReactNode> = {
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  film: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M7 4v16M17 4v16M3 9h4m10 0h4M3 15h4m10 0h4" /></>,
  tv: <><rect x="3" y="6" width="18" height="13" rx="2" /><path d="m8 2 4 4 4-4" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  edit: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></>,
  trash: <><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /></>,
  close: <path d="M18 6 6 18M6 6l12 12" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  alert: <><circle cx="12" cy="12" r="9" /><path d="M12 8v4m0 4h.01" /></>,
  back: <path d="M19 12H5m6-7-7 7 7 7" />,
  image: <><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-5-5L5 21" /></>,
  chevron: <path d="m6 9 6 6 6-6" />,
  layers: <><path d="m12 2 10 5-10 5L2 7l10-5Z" /><path d="m2 17 10 5 10-5M2 12l10 5 10-5" /></>,
  save: <><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" /><path d="M17 21v-8H7v8M7 3v5h8" /></>,
  sparkles: <path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3ZM19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15Z" />,
  refresh: <><path d="M21 12a9 9 0 1 1-2.64-6.36" /><path d="M21 3v6h-6" /></>,
};

function Icon({ name, className = 'w-4 h-4' }: { name: IconName; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}

const inputClass =
  'w-full rounded-xl border border-white/10 bg-black/30 px-3.5 py-2.5 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-red-600/70 focus:ring-4 focus:ring-red-600/15';

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline justify-between gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
        {label}
        {hint && <span className="font-normal normal-case tracking-normal text-zinc-600">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

const episodeCount = (seasons?: Season[] | null) =>
  (seasons || []).reduce((n, s) => n + (s.episodes?.length || 0), 0);
interface SourceCheck { available: boolean; url?: string; provider?: string; streamVerified?: boolean; embeds?: string[]; credits?: number[] }

export default function AdminPage() {
  const router = useRouter();
  const [loadingAuth, setLoadingAuth] = useState(true);

  const [mediaList, setMediaList] = useState<MediaItem[]>([]);
  const [editingId, setEditingId] = useState<any>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const tmdbSearchVersion = useRef(0);
  const [tmdbSearchResults, setTmdbSearchResults] = useState<any[]>([]);
  const [selectedTmdbId, setSelectedTmdbId] = useState('');
  const [searchingTmdb, setSearchingTmdb] = useState(false);
  const [collectionStatus, setCollectionStatus] = useState('');
  const sourceChecks = useRef(new Map<string, { time: number; result: SourceCheck }>());

  const [title, setTitle] = useState('');
  const [type, setType] = useState<'movie' | 'series'>('movie');
  const [poster, setPoster] = useState('');
  const [backdrop, setBackdrop] = useState('');
  const [url, setUrl] = useState('');
  const [embedUrl, setEmbedUrl] = useState('');
  const [description, setDescription] = useState('');
  const [genresInput, setGenresInput] = useState('');

  const [seasons, setSeasons] = useState<Season[]>(EMPTY_SEASONS);
  const [openSeason, setOpenSeason] = useState<number | null>(0);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const [libraryQuery, setLibraryQuery] = useState('');
  const [libraryType, setLibraryType] = useState<'all' | 'movie' | 'series'>('all');
  const [confirmDeleteId, setConfirmDeleteId] = useState<any>(null);

  const formRef = useRef<HTMLDivElement>(null);
  const submitLock = useRef(false);
  const tmdbTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    async function checkAdmin() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || session.user.email !== ADMIN_EMAIL) {
        router.push('/');
        return;
      }
      setLoadingAuth(false);
      fetchMedia();
    }
    checkAdmin();
  }, [router]);

  async function fetchMedia() {
    clearClientResources();
    try { setMediaList(await fetchCatalogueRows<MediaItem>(supabase, '*')); }
    catch { setErrorMsg('Le catalogue n’a pas pu être chargé entièrement. Réessaie avant de modifier ou ajouter un titre.'); }
  }

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(''), 5000);
    return () => clearTimeout(t);
  }, [message]);

  const handleSearchTmdbByName = (query: string) => {
    const version = ++tmdbSearchVersion.current;
    setSearchQuery(query);
    if (tmdbTimer.current) clearTimeout(tmdbTimer.current);
    if (query.trim().length < 2) {
      setTmdbSearchResults([]);
      setSearchingTmdb(false);
      return;
    }

    tmdbTimer.current = setTimeout(async () => {
      setSearchingTmdb(true);
      try {
        const endpoint = type === 'movie' ? 'movie' : 'tv';
        let results = [];
        for (const variant of searchQueryVariants(query)) {
          const res = await fetch(`https://api.themoviedb.org/3/search/${endpoint}?api_key=${TMDB_KEY}&query=${encodeURIComponent(variant)}&language=fr-FR`);
          if (!res.ok) throw new Error('Recherche indisponible');
          const data = await res.json();
          results = data.results || [];
          if (results.length) break;
        }
        if (version === tmdbSearchVersion.current) setTmdbSearchResults(results);
      } catch {
        if (version === tmdbSearchVersion.current) setTmdbSearchResults([]);
      } finally {
        if (version === tmdbSearchVersion.current) setSearchingTmdb(false);
      }
    }, 300);
  };

  const checkUrlAvailable = async (testUrl: string) => {
    const cached = sourceChecks.current.get(testUrl);
    if (cached && Date.now() - cached.time < 10 * 60 * 1000) return cached.result;
    const { data: { session } } = await getPersistentSession();
    if (!session) throw new Error('Session expirée. Reconnecte-toi.');
    const res = await fetch('/api/source-check', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ url: testUrl }),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Vérification des sources impossible');
    const checked = result as SourceCheck;
    if (checked.available) {
      const entry = { time: Date.now(), result: checked };
      sourceChecks.current.set(testUrl, entry);
      if (checked.url) sourceChecks.current.set(checked.url, entry);
    }
    return checked;
  };

  // Place every saved title in Kids / Junior from its TMDB age rating; manual choices are kept.
  const classifyFamily = async (id: unknown) => {
    try {
      const { data: { session } } = await getPersistentSession();
      if (!session) return '';
      const response = await fetch('/api/admin/family-classification', {
        method: 'POST', signal: AbortSignal.timeout(30000),
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ ids: [String(id)] }),
      });
      const result = (await response.json())?.results?.[0];
      if (!response.ok || !result || result.error) return ' Public Kids/Junior non déterminé : vérifie-le dans Admin → Kids & Junior.';
      if (result.family_classification?.status !== 'rated' && !result.family_classification?.adult) return ' Pas d’âge sur TMDB : visible seulement pour les profils standard, à vérifier dans Kids & Junior.';
      return result.audience === 'kids' ?' Classé Kids d’après TMDB.' : result.audience === 'junior' ? ' Classé Junior d’après TMDB.' : ' Réservé aux profils standard d’après TMDB.';
    } catch { return ' Public Kids/Junior non déterminé : vérifie-le dans Admin → Kids & Junior.'; }
  };

  const verifyExtraLink = async (link: string) => (await checkUrlAvailable(link)).available;
  const tmdbFallback = (kind: 'movie' | 'tv', season = 1, episode = 1) =>
    /^\d{1,10}$/.test(String(selectedTmdbId)) ? { id: String(selectedTmdbId), type: kind, season, episode } : undefined;

  const collectSeriesSources = async (input: Season[]) => {
    const collected = input.map(season => ({ ...season, episodes: season.episodes.map(episode => ({ ...episode })) }));
    const episodes = collected.flatMap(season => season.episodes).filter(episode => episode.embedUrl?.trim());
    let cursor = 0, completed = 0, available = 0, links = 0, credits = 0;
    setCollectionStatus(`Recherche automatique Moviez et Movix : 0/${episodes.length} épisodes…`);
    await Promise.all(Array.from({ length: Math.min(3, episodes.length) }, async () => {
      while (cursor < episodes.length) {
        const episode = episodes[cursor++];
        const checked = await checkUrlAvailable(episode.embedUrl);
        if (checked.available && checked.url) { available++; links += checked.embeds?.length || 1; episode.embedUrl = checked.url; }
        else episode.embedUrl = '';
        if (checked.credits?.length) credits++;
        completed++;
        setCollectionStatus(`Recherche automatique Moviez et Movix : ${completed}/${episodes.length} épisodes · ${links} liens trouvés · ${credits} génériques minutés`);
      }
    }));
    setCollectionStatus(`${links} liens collectés pour ${available}/${episodes.length} épisodes · ${credits} génériques minutés pour l’épisode suivant. Les épisodes sans source compatible restent indisponibles.`);
    return { seasons: collected, available };
  };

  const handleSelectTmdbItem = async (item: any) => {
    const tmdbId = item.id;
    setSelectedTmdbId(tmdbId);
    
    const releaseDate = item.release_date || item.first_air_date || '';
    const year = releaseDate ? ` (${releaseDate.slice(0, 4)})` : '';
    setTitle((item.title || item.name || '') + year);

    setSearchQuery('');
    setTmdbSearchResults([]);

    await fetchAndApplyTmdbData(tmdbId, item.title || item.name || '');
  };

  const handleAutoReloadByName = async () => {
    if (!title.trim()) {
      setErrorMsg('Veuillez renseigner un titre pour lancer la recherche TMDb.');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    setMessage('');

    try {
      const endpoint = type === 'movie' ? 'movie' : 'tv';
      const searchRes = await fetch(
        `https://api.themoviedb.org/3/search/${endpoint}?api_key=${TMDB_KEY}&query=${encodeURIComponent(title.trim())}&language=fr-FR`
      );
      const searchData = await searchRes.json();

      if (searchData.results && searchData.results.length > 0) {
        const bestMatch = searchData.results[0];
        setSelectedTmdbId(bestMatch.id);
        await fetchAndApplyTmdbData(bestMatch.id, bestMatch.title || bestMatch.name);
      } else {
        setErrorMsg(`Aucun résultat TMDb trouvé pour le titre "${title}".`);
        setLoading(false);
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Erreur lors de la recherche automatique TMDb.');
      setLoading(false);
    }
  };

  const fetchAndApplyTmdbData = async (tmdbId: any, itemName: string) => {
    setLoading(true);
    setErrorMsg('');
    setMessage('');
    setCollectionStatus('Recherche automatique des liens sur Moviez et Movix…');

    const moviezParams = new URLSearchParams({
      autoplay: '1',
      color: 'e8213f',
      info: 'title,year,rating,genres,duration'
    }).toString();

    try {
      const endpoint = type === 'movie' ? 'movie' : 'tv';
      const res = await fetch(
        `https://api.themoviedb.org/3/${endpoint}/${tmdbId}?api_key=${TMDB_KEY}&language=fr-FR`
      );
      const data = await res.json();

      if (data && !data.success) {
        setDescription(data.overview || '');

        if (data.genres && Array.isArray(data.genres)) {
          const genreNames = data.genres.map((g: any) => g.name);
          setGenresInput(genreNames.join(', '));
        }

        let mainPoster = '';
        let mainBackdrop = '';

        if (data.poster_path) {
          mainPoster = `https://image.tmdb.org/t/p/w500${data.poster_path}`;
          setPoster(mainPoster);
        }
        if (data.backdrop_path) {
          mainBackdrop = `https://image.tmdb.org/t/p/original${data.backdrop_path}`;
          setBackdrop(mainBackdrop);
        }

        if (type === 'movie') {
          const streamUrl = `https://api.moviez.ac/${tmdbId}?${moviezParams}`;
          const source = await checkUrlAvailable(streamUrl);

          if (!source.available) {
            setErrorMsg(`⚠️ Le film "${itemName}" n'est pas encore disponible sur le lecteur externe.`);
            setUrl('');
            setEmbedUrl('');
            setCollectionStatus('Aucun lien compatible trouvé. Ajout impossible.');
          } else {
            const iframeCode = `<iframe src="${source.url}" width="100%" height="100%" frameborder="0" allow="autoplay; fullscreen; encrypted-media; picture-in-picture" referrerpolicy="origin" allowfullscreen></iframe>`;
            setUrl(iframeCode);
            setEmbedUrl(iframeCode);
            setMessage(`${source.embeds?.length || 1} lien(s) collecté(s), lecture vérifiée via ${source.provider}. Le lecteur changera de source en cas de panne.`);
            setCollectionStatus(`${source.embeds?.length || 1} lien(s) collecté(s) sur Moviez et Movix. Changement automatique de source en cas de panne.`);
          }
        }

        if (type === 'series' && data.number_of_seasons) {
          const fetchedSeasons: Season[] = [];

          for (let sNum = 1; sNum <= data.number_of_seasons; sNum++) {
            try {
              const seasonRes = await fetch(
                `https://api.themoviedb.org/3/tv/${tmdbId}/season/${sNum}?api_key=${TMDB_KEY}&language=fr-FR`
              );
              const seasonData = await seasonRes.json();

              if (seasonData && seasonData.episodes) {
                const seasonPoster = seasonData.poster_path
                  ? `https://image.tmdb.org/t/p/w500${seasonData.poster_path}`
                  : mainPoster;

                const episodesList = seasonData.episodes.map((ep: any) => {
                  const autoEmbed = cataloguePlayer({ id: String(tmdbId), type: 'tv', season: sNum, episode: ep.episode_number });

                  return {
                    number: ep.episode_number,
                    title: ep.name || `Épisode ${ep.episode_number}`,
                    embedUrl: autoEmbed,
                    still_path: ep.still_path ? `https://image.tmdb.org/t/p/w500${ep.still_path}` : seasonPoster,
                    runtime: ep.runtime || data.episode_run_time?.[0] || 45
                  };
                });

                fetchedSeasons.push({
                  seasonNumber: sNum,
                  poster_path: seasonPoster,
                  episodes: episodesList
                });
              }
            } catch (err) {
              console.error(`Erreur saison ${sNum}`, err);
            }
          }

          if (fetchedSeasons.length > 0) {
            const collected = await collectSeriesSources(fetchedSeasons);
            setSeasons(collected.seasons);
            setOpenSeason(0);
            if (!collected.available) setErrorMsg(`Aucun lien compatible trouvé pour « ${itemName} ». Ajout impossible.`);
            else setMessage('Liens collectés pour les épisodes disponibles. Tu peux enregistrer la série.');
          }
        }
      } else {
        setErrorMsg('Impossible de récupérer les détails TMDb.');
      }
    } catch (err) {
      console.error(err);
      setCollectionStatus('La collecte des liens n’a pas abouti. Réessaie.');
      setErrorMsg(err instanceof Error ? err.message : 'Erreur lors de la récupération TMDb.');
    }
    setLoading(false);
  };

  const handleEdit = (item: MediaItem) => {
    setEditingId(item.id);
    setSelectedTmdbId(item.tmdb_id || '');
    setTitle(item.title || '');
    setType(item.type || 'movie');
    setPoster(item.poster || '');
    setBackdrop(item.backdrop || '');
    setUrl(item.url || '');
    setEmbedUrl(item.embedUrl || '');
    setDescription(item.description || '');
    setGenresInput(item.genres ? item.genres.join(', ') : '');
    setSeasons(item.seasons && item.seasons.length ? item.seasons : EMPTY_SEASONS);
    setOpenSeason(0);
    setErrorMsg('');
    setMessage('');
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleCancel = () => {
    setCollectionStatus('');
    const currentType = type;
    setEditingId(null);
    setSelectedTmdbId('');
    setSearchQuery('');
    setTmdbSearchResults([]);
    setTitle('');
    setType(currentType);
    setPoster('');
    setBackdrop('');
    setUrl('');
    setEmbedUrl('');
    setDescription('');
    setGenresInput('');
    setSeasons(EMPTY_SEASONS);
    setOpenSeason(0);
  };

  const handleDelete = async (id: any) => {
    clearClientResources();
    const { error } = await supabase.from('media').delete().eq('id', id);
    setConfirmDeleteId(null);
    if (error) {
      setErrorMsg(`Erreur suppression : ${error.message}`);
    } else {
      setMessage('Média supprimé.');
      if (editingId === id) handleCancel();
      fetchMedia();
    }
  };

  const updateEpisodeField = (seasonIndex: number, epIndex: number, field: keyof Episode, value: any) => {
    setSeasons(prev =>
      prev.map((s, si) =>
        si !== seasonIndex
          ? s
          : { ...s, episodes: s.episodes.map((ep, ei) => (ei !== epIndex ? ep : { ...ep, [field]: value })) }
      )
    );
  };

  const saveEpisodeLink = async (sIndex: number, eIndex: number) => {
    if (editingId == null || loading || submitLock.current) return;
    const value = seasons[sIndex]?.episodes[eIndex]?.embedUrl?.trim();
    if (!value) return;
    submitLock.current = true; setLoading(true); setErrorMsg(''); setMessage('Vérification du lien de cet épisode…');
    try {
      const { data: { session } } = await getPersistentSession();
      if (session?.user.email !== ADMIN_EMAIL) throw new Error('Connexion administrateur requise.');
      const checked = await checkUrlAvailable(value);
      if (!checked.available || !checked.url) throw new Error('Ce lien ne peut pas être vérifié. Aucun changement enregistré.');
      const { data: latest, error: readError } = await supabase.from('media').select('seasons').eq('id', editingId).single();
      if (readError || !latest?.seasons?.[sIndex]?.episodes?.[eIndex]) throw new Error('Épisode introuvable. Recharge sa fiche.');
      const original = mediaList.find(item => String(item.id) === String(editingId))?.seasons?.[sIndex]?.episodes[eIndex]?.embedUrl;
      if (latest.seasons[sIndex].episodes[eIndex].embedUrl !== original) throw new Error('Cet épisode a été modifié ailleurs. Recharge sa fiche.');
      const updated = structuredClone(latest.seasons) as Season[];
      updated[sIndex].episodes[eIndex].embedUrl = checked.url;
      const { error: writeError } = await supabase.from('media').update({ seasons: updated }).eq('id', editingId);
      if (writeError) throw writeError;
      clearClientResources();
      updateEpisodeField(sIndex, eIndex, 'embedUrl', checked.url);
      setMediaList(items => items.map(item => String(item.id) === String(editingId) ? { ...item, seasons: updated } : item));
      setMessage('Lien de cet épisode enregistré. Les autres épisodes sont conservés.');
    } catch (error) { setMessage(''); setErrorMsg(error instanceof Error ? error.message : 'Impossible d’enregistrer ce lien.'); }
    finally { submitLock.current = false; setLoading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || submitLock.current) return;
    submitLock.current = true;
    setLoading(true);
    setMessage('');
    setErrorMsg('');

    try {
    const genresArray = genresInput
      ? genresInput.split(',').map(g => g.trim()).filter(Boolean)
      : [];

    const payload = {
      title: title.trim(),
      type,
      poster,
      backdrop,
      url,
      embedUrl: type === 'movie' ? url : '',
      description,
      genres: genresArray,
      seasons: type === 'series' ? seasons : null,
      tmdb_id: selectedTmdbId ? String(selectedTmdbId) : null
    };

    const existing = await checkContentDuplicate(supabase, payload, 'media', editingId);
    if (existing) {
      setErrorMsg(`« ${existing.item.title} » est déjà dans le catalogue. Modifie sa fiche plutôt que d’ajouter un doublon.`);
      setLibraryQuery(existing.item.title || '');
      setLibraryType('all');
      void fetchMedia();
      return;
    }
    setMessage('Vérification des liens avant enregistrement…');
    if (type === 'movie') {
      if (!url.trim()) throw new Error('Ajout refusé : aucun lien de lecteur pour ce film.');
      const checked = await checkUrlAvailable(url);
      if (!checked.available) throw new Error('Ajout refusé : aucun lien disponible sur Moviez ou Movix pour ce film.');
      if (checked.url) { payload.url = checked.url; payload.embedUrl = checked.url; }
    } else if (type === 'series') {
      const collected = await collectSeriesSources(seasons);
      if (!collected.available) throw new Error('Ajout refusé : aucun lien disponible pour les épisodes de cette série sur Moviez ou Movix.');
      payload.seasons = collected.seasons;
      setSeasons(collected.seasons);
    }
    setMessage('');
    if (editingId !== null && editingId !== undefined) {
      clearClientResources();
      const { error } = await supabase.from('media').update(payload).eq('id', editingId);
      if (error) {
        setErrorMsg(duplicateErrorMessage(error, `Erreur modification : ${error.message}`));
      } else {
        setMessage(`« ${title} » a été mis à jour.${await classifyFamily(editingId)}`);
        handleCancel();
        fetchMedia();
      }
    } else {
      clearClientResources();
      const { data: inserted, error } = await supabase.from('media').insert([payload]).select('id').single();
      if (error) {
        setErrorMsg(duplicateErrorMessage(error, `Erreur enregistrement Supabase : ${error.message}`));
      } else {
        if (selectedTmdbId) {
          await supabase
            .from('requests')
            .update({ status: 'ajoute' })
            .eq('tmdb_id', selectedTmdbId).eq('type', type);
        }

        setMessage(`« ${title} » a été ajouté au catalogue.${inserted ? await classifyFamily(inserted.id) : ''}`);
        handleCancel();
        fetchMedia();
      }
    }
    } catch (error) {
      setMessage('');
      setErrorMsg(error instanceof Error ? error.message : 'Impossible de vérifier et d’enregistrer ce titre. Réessaie.');
    } finally {
      submitLock.current = false;
      setLoading(false);
    }
  };

  const filteredLibrary = useMemo(() => {
    const matches = createSearchMatcher(libraryQuery);
    return mediaList.filter(m => (libraryType === 'all' || m.type === libraryType) && matches(m.title, ...(m.genres || [])));
  }, [mediaList, libraryQuery, libraryType]);

  const counts = useMemo(() => ({
    all: mediaList.length,
    movie: mediaList.filter(m => m.type === 'movie').length,
    series: mediaList.filter(m => m.type === 'series').length,
  }), [mediaList]);

  const duplicate = useMemo(() => {
    if (!title.trim() && !selectedTmdbId) return null;
    return findContentDuplicate({ title, type, tmdb_id: selectedTmdbId }, mediaList, editingId) as MediaItem | null;
  }, [title, type, selectedTmdbId, mediaList, editingId]);

  const displayedSeasons = useMemo(() => normalizeSeriesParts({ title, tmdb_id: selectedTmdbId, seasons }).seasons, [title, selectedTmdbId, seasons]);

  if (loadingAuth) {
    return (
      <main className="yf-page yf-admin flex min-h-screen items-center justify-center bg-[#0a0a0b] text-white">
        <div className="flex items-center gap-3 text-sm text-zinc-400">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-red-600" />
          Vérification des accès…
        </div>
      </main>
    );
  }

  const isEditing = editingId !== null && editingId !== undefined;
  const totalEpisodes = episodeCount(seasons);
  const seasonUnit = isLupin({ title, tmdb_id: selectedTmdbId }) ? 'partie' : 'saison';

  return (
    <main className="yf-page yf-admin min-h-screen bg-[#0a0a0b] pb-24 font-sans text-white antialiased selection:bg-red-600 selection:text-white">
      <header className="yf-topbar sticky top-0 z-40 border-b border-white/5 bg-[#0a0a0b]/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-8">
          <div className="flex items-center gap-3">
            <span className="select-none text-lg font-black tracking-[0.2em] text-red-600">
              YAMON<span className="text-white">FILM</span>
            </span>
            <span className="rounded-full bg-red-600/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-red-300 ring-1 ring-red-500/30">
              Admin
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/admin/banners"
              className="hidden items-center gap-2 rounded-full bg-white/5 px-4 py-2 text-sm font-medium text-zinc-200 ring-1 ring-white/10 transition hover:bg-white/10 hover:text-white sm:inline-flex"
            >
              <Icon name="layers" /> Bannières
            </Link>
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-full bg-white/5 py-2 pl-3 pr-4 text-sm font-medium text-zinc-200 ring-1 ring-white/10 transition hover:bg-white/10 hover:text-white"
            >
              <Icon name="back" /> Site
            </Link>
          </div>
        </div>
      </header>
      <SectionNavigation admin />

      <div className="pointer-events-none fixed inset-x-0 top-20 z-50 flex flex-col items-center gap-2 px-4">
        {message && (
          <div role="status" className="pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-2xl bg-[#111113]/95 px-4 py-3 shadow-2xl ring-1 ring-emerald-500/30 backdrop-blur-xl">
            <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
            <p className="flex-1 text-sm text-emerald-100">{message}</p>
            <button onClick={() => setMessage('')} className="text-zinc-500 hover:text-white"><Icon name="close" className="h-3.5 w-3.5" /></button>
          </div>
        )}
        {errorMsg && (
          <div role="alert" className="pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-2xl bg-[#111113]/95 px-4 py-3 shadow-2xl ring-1 ring-red-500/40 backdrop-blur-xl">
            <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
            <p className="flex-1 text-sm text-red-200">{errorMsg}</p>
            <button onClick={() => setErrorMsg('')} className="text-zinc-500 hover:text-white"><Icon name="close" className="h-3.5 w-3.5" /></button>
          </div>
        )}
      </div>

      <div className="mx-auto max-w-7xl px-4 pt-8 sm:px-8">
        <PageHero eyebrow="DERRIÈRE LES PROJECTEURS" title="Un grand catalogue." accent="Ça se programme." description="Ajoute les prochaines découvertes, organise tes séries et donne une place à chaque film dans l’univers Yamonfim." cardLabel="LE CATALOGUE" cardTitle="La prochaine belle séance." cardDetail={`${counts.all} TITRES AU CATALOGUE`} variant="collection" />
        <section className="mb-8 grid grid-cols-3 gap-3 sm:gap-4">
          {[
            { label: 'Total', value: counts.all, icon: 'layers' as IconName },
            { label: 'Films', value: counts.movie, icon: 'film' as IconName },
            { label: 'Séries', value: counts.series, icon: 'tv' as IconName },
          ].map(s => (
            <div key={s.label} className="yf-surface rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/10 sm:p-5">
              <div className="flex items-center justify-between text-zinc-500">
                <span className="text-xs font-semibold uppercase tracking-wider">{s.label}</span>
                <Icon name={s.icon} className="h-4 w-4" />
              </div>
              <p className="mt-2 text-2xl font-black tabular-nums sm:text-3xl">{s.value}</p>
            </div>
          ))}
        </section>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-start">
          <section ref={formRef} className="scroll-mt-24 rounded-3xl bg-white/[0.03] ring-1 ring-white/10">
            <div className="flex items-center justify-between gap-3 border-b border-white/5 px-5 py-4 sm:px-6">
              <div>
                <h2 className="text-lg font-bold tracking-tight">
                  {isEditing ? 'Modifier le média' : 'Ajouter un film ou une série'}
                </h2>
                {isEditing && <p className="mt-0.5 truncate text-sm text-zinc-500">{title}</p>}
              </div>
              <div className="flex items-center gap-2">
                {isEditing && (
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedTmdbId) {
                        fetchAndApplyTmdbData(selectedTmdbId, title);
                      } else {
                        handleAutoReloadByName();
                      }
                    }}
                    className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-3 py-1.5 text-xs font-bold text-amber-300 ring-1 ring-amber-500/30 transition hover:bg-amber-500/25"
                    title="Recharger ou trouver l'ID TMDb et les épisodes par le titre"
                  >
                    <Icon name="refresh" className="h-3.5 w-3.5" /> Recharger
                  </button>
                )}
                {isEditing && (
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition hover:bg-white/15"
                  >
                    <Icon name="close" className="h-3.5 w-3.5" /> Annuler
                  </button>
                )}
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6 p-5 sm:p-6">
              <div className="grid grid-cols-2 gap-2">
                {([
                  { key: 'movie', label: 'Film', icon: 'film' },
                  { key: 'series', label: 'Série', icon: 'tv' },
                ] as const).map(t => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => {
                      setType(t.key);
                      if (t.key !== type) setSelectedTmdbId('');
                      setSearchQuery('');
                      setTmdbSearchResults([]);
                    }}
                    className={`flex items-center justify-center gap-2 rounded-2xl py-3 text-sm font-semibold transition ${
                      type === t.key
                        ? 'bg-white text-black shadow'
                        : 'bg-white/5 text-zinc-400 ring-1 ring-white/10 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <Icon name={t.icon} /> {t.label}
                  </button>
                ))}
              </div>

              <div className="relative rounded-2xl bg-red-600/[0.06] p-4 ring-1 ring-red-500/20">
                <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-red-400">
                  <Icon name="sparkles" className="h-3.5 w-3.5" /> Remplir automatiquement depuis TMDb
                </p>
                <div className="relative">
                  <Icon name="search" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => handleSearchTmdbByName(e.target.value)}
                    placeholder={type === 'movie' ? 'Nom du film…' : 'Nom de la série…'}
                    className={`${inputClass} pl-10 pr-10`}
                  />
                  {(searchingTmdb || loading) && (
                    <span className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                  )}
                </div>

                {tmdbSearchResults.length > 0 && (
                  <ul className="absolute left-4 right-4 z-30 mt-2 max-h-80 overflow-y-auto rounded-2xl border border-white/10 bg-[#141416]/95 p-1.5 shadow-2xl backdrop-blur-xl">
                    {tmdbSearchResults.map(item => {
                      const name = item.title || item.name;
                      const releaseDate = item.release_date || item.first_air_date || '';
                      const year = releaseDate ? `(${releaseDate.slice(0, 4)})` : '';
                      const mediaTypeLabel = item.media_type === 'tv' || type === 'series' ? 'Série' : 'Film';
                      
                      const already = findContentDuplicate({ title: `${name} ${year}`, type, tmdb_id: item.id }, mediaList);
                      return (
                        <li key={item.id}>
                          <button
                            type="button"
                            onClick={() => handleSelectTmdbItem(item)}
                            className="flex w-full items-center gap-3 rounded-xl p-2 text-left transition hover:bg-white/5"
                          >
                            <div className="h-14 w-10 shrink-0 overflow-hidden rounded-lg bg-zinc-800">
                              {item.poster_path && (
                                <img src={`https://image.tmdb.org/t/p/w92${item.poster_path}`} alt="" className="h-full w-full object-cover" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold">
                                {name} <span className="font-normal text-zinc-400">{year}</span>
                              </p>
                              <p className="text-xs text-zinc-500">
                                ID TMDb : {item.id} · {mediaTypeLabel}
                              </p>
                            </div>
                            {already && (
                              <span className="shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300 ring-1 ring-amber-500/30">
                                Déjà ajouté
                              </span>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <div role="status" className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-zinc-300">
                <p className="font-semibold text-white">Liens de lecture automatiques</p>
                <p className="mt-1">{collectionStatus || 'Sélectionne un film ou une série dans la recherche : les liens Moviez et Movix seront récupérés ici automatiquement.'}</p>
              </div>
              {(poster || backdrop) && (
                <div className="relative overflow-hidden rounded-2xl ring-1 ring-white/10">
                  {backdrop && <img src={backdrop} alt="" className="absolute inset-0 h-full w-full object-cover opacity-40" />}
                  <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0b] via-[#0a0a0b]/80 to-transparent" />
                  <div className="relative flex items-center gap-4 p-4">
                    <div className="h-28 w-20 shrink-0 overflow-hidden rounded-xl bg-zinc-900 ring-1 ring-white/10">
                      {poster && <img src={poster} alt="" className="h-full w-full object-cover" />}
                    </div>
                    <div className="min-w-0">
                      <span className="rounded-md bg-red-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                        {type === 'movie' ? 'Film' : 'Série'}
                      </span>
                      <p className="mt-1.5 line-clamp-2 text-base font-bold leading-snug">{title || 'Sans titre'}</p>
                      {type === 'series' && (
                        <p className="mt-0.5 text-xs text-zinc-400">
                          {displayedSeasons.length} {seasonUnit}{displayedSeasons.length > 1 ? 's' : ''} · {totalEpisodes} épisode{totalEpisodes > 1 ? 's' : ''}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {duplicate && (
                <div className="flex items-start gap-3 rounded-2xl bg-amber-500/10 px-4 py-3 ring-1 ring-amber-500/30">
                  <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                  <p className="flex-1 text-sm text-amber-100">
                    « {duplicate.title} » est déjà dans ton catalogue.
                  </p>
                  <button
                    type="button"
                    onClick={() => handleEdit(duplicate)}
                    className="shrink-0 text-xs font-semibold text-amber-300 underline underline-offset-2"
                  >
                    Le modifier
                  </button>
                </div>
              )}

              <div className="space-y-4">
                <Field label="Titre">
                  <input type="text" required value={title} onChange={e => setTitle(e.target.value)} className={inputClass} />
                </Field>

                <Field label="Genres" hint="séparés par des virgules">
                  <input
                    type="text"
                    value={genresInput}
                    onChange={e => setGenresInput(e.target.value)}
                    placeholder="Action, Drame, Science-Fiction"
                    className={inputClass}
                  />
                </Field>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Affiche" hint="portrait">
                    <input type="text" value={poster} onChange={e => setPoster(e.target.value)} placeholder="https://…" className={inputClass} />
                  </Field>
                  <Field label="Bandeau" hint="paysage">
                    <input type="text" value={backdrop} onChange={e => setBackdrop(e.target.value)} placeholder="https://…" className={inputClass} />
                  </Field>
                </div>

                <Field label="Description">
                  <textarea
                    rows={3}
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    className={`${inputClass} resize-none`}
                  />
                </Field>

                {type === 'movie' && (
                  <Field label="Lecteur du film" hint="code iframe ou lien">
                    <textarea
                      rows={3}
                      value={url}
                      onChange={e => setUrl(e.target.value)}
                      placeholder='<iframe src="…"></iframe>'
                      className={`${inputClass} resize-none font-mono text-xs`}
                    />
                    <ExtraLinks value={url} fallback={tmdbFallback('movie')} verify={verifyExtraLink} onChange={setUrl} disabled={loading} />
                    {isEditing && <p className="mt-1.5 text-[11px] text-zinc-500">Clique sur Enregistrer en bas pour appliquer les sources ajoutées ou retirées.</p>}
                  </Field>
                )}
              </div>

              {type === 'series' && (
                <div>
                  <p className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    <span>Saisons & épisodes</span>
                    <span className="font-normal normal-case tracking-normal text-zinc-600">
                      {displayedSeasons.length} {seasonUnit}{displayedSeasons.length > 1 ? 's' : ''} · {totalEpisodes} épisode{totalEpisodes > 1 ? 's' : ''}
                    </span>
                  </p>
                  <div className="space-y-2">
                    {displayedSeasons.map((season, sIndex) => {
                      const open = openSeason === sIndex;
                      const missing = season.episodes.filter(ep => !ep.embedUrl?.trim()).length;
                      return (
                        <div key={sIndex} className="overflow-hidden rounded-2xl bg-black/20 ring-1 ring-white/10">
                          <button
                            type="button"
                            onClick={() => setOpenSeason(open ? null : sIndex)}
                            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-white/[0.03]"
                          >
                            <span className="text-sm font-semibold">{seasonUnit === 'partie' ? 'Partie' : 'Saison'} {season.seasonNumber}</span>
                            <span className="flex items-center gap-2 text-xs text-zinc-500">
                              {missing > 0 && (
                                <span className="rounded-full bg-red-600/15 px-2 py-0.5 font-semibold text-red-300">
                                  {missing} sans lien
                                </span>
                              )}
                              {season.episodes.length} ép.
                              <Icon name="chevron" className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
                            </span>
                          </button>
                          {open && (
                            <div className="max-h-96 space-y-2 overflow-y-auto border-t border-white/5 p-3">
                              {season.episodes.map((ep, eIndex) => (
                                <div key={eIndex} className="space-y-2 rounded-xl bg-white/[0.03] p-2.5">
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                  <span className="w-10 shrink-0 text-xs font-bold text-zinc-500">É{ep.number}</span>
                                  <input
                                    type="text"
                                    value={ep.title}
                                    onChange={e => updateEpisodeField(ep.sourcePosition?.s ?? sIndex, ep.sourcePosition?.e ?? eIndex, 'title', e.target.value)}
                                    className="w-full rounded-lg border border-white/10 bg-black/30 px-2.5 py-1.5 text-xs text-white outline-none focus:border-red-600/70 sm:w-1/3"
                                  />
                                  <input
                                    type="text"
                                    placeholder="Lien de l'épisode"
                                    value={ep.embedUrl}
                                    onChange={e => updateEpisodeField(ep.sourcePosition?.s ?? sIndex, ep.sourcePosition?.e ?? eIndex, 'embedUrl', e.target.value)}
                                    className={`w-full flex-1 rounded-lg border bg-black/30 px-2.5 py-1.5 font-mono text-[11px] text-white outline-none focus:border-red-600/70 ${
                                      ep.embedUrl?.trim() ? 'border-white/10' : 'border-red-500/40'
                                    }`}
                                  />
                                  {editingId != null && <button type="button" disabled={loading || !ep.embedUrl?.trim()} onClick={() => void saveEpisodeLink(ep.sourcePosition?.s ?? sIndex, ep.sourcePosition?.e ?? eIndex)} aria-label={`Enregistrer le lien de la ${seasonUnit} ${season.seasonNumber}, épisode ${ep.number}`} className="shrink-0 rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">Enregistrer ce lien</button>}
                                </div>
                                <div className="sm:pl-12">
                                  <ExtraLinks compact value={ep.embedUrl} fallback={tmdbFallback('tv', season.seasonNumber, ep.number)} verify={verifyExtraLink}
                                    onChange={stored => updateEpisodeField(ep.sourcePosition?.s ?? sIndex, ep.sourcePosition?.e ?? eIndex, 'embedUrl', stored)} disabled={loading} />
                                </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !!duplicate || (type === 'movie' ? !url.trim() : !seasons.some(season => season.episodes.some(episode => episode.embedUrl?.trim())))}
                className="yf-primary flex w-full items-center justify-center gap-2 rounded-full bg-red-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-red-600/25 transition hover:bg-red-500 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> Enregistrement…</>
                ) : isEditing ? (
                  <><Icon name="save" /> Mettre à jour</>
                ) : (
                  <><Icon name="plus" /> Ajouter au catalogue</>
                )}
              </button>
            </form>
          </section>

          <section className="lg:sticky lg:top-24">
            <div className="mb-4 flex items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold tracking-tight">Catalogue</h2>
                <p className="text-sm text-zinc-500">
                  {filteredLibrary.length} résultat{filteredLibrary.length > 1 ? 's' : ''}
                  {libraryQuery || libraryType !== 'all' ? ` sur ${counts.all}` : ''}
                </p>
              </div>
            </div>

            <div className="relative mb-3">
              <Icon name="search" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                value={libraryQuery}
                onChange={e => setLibraryQuery(e.target.value)}
                placeholder="Rechercher un titre ou un genre…"
                className={`${inputClass} pl-10 pr-10`}
              />
              {libraryQuery && (
                <button
                  onClick={() => setLibraryQuery('')}
                  aria-label="Effacer"
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-zinc-500 hover:bg-white/10 hover:text-white"
                >
                  <Icon name="close" className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="mb-4 flex gap-2">
              {([
                { key: 'all', label: 'Tout', count: counts.all },
                { key: 'movie', label: 'Films', count: counts.movie },
                { key: 'series', label: 'Séries', count: counts.series },
              ] as const).map(t => (
                <button
                  key={t.key}
                  onClick={() => setLibraryType(t.key)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                    libraryType === t.key ? 'bg-white text-black' : 'bg-white/5 text-zinc-400 ring-1 ring-white/10 hover:text-white'
                  }`}
                >
                  {t.label}
                  <span className={`rounded-full px-1.5 text-[10px] tabular-nums ${libraryType === t.key ? 'bg-black/10' : 'bg-white/10'}`}>{t.count}</span>
                </button>
              ))}
            </div>

            <div className="space-y-2 lg:max-h-[calc(100vh-17rem)] lg:overflow-y-auto lg:pr-1">
              {filteredLibrary.length === 0 ? (
                <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-white/10 py-12 text-center">
                  <Icon name="search" className="h-5 w-5 text-zinc-600" />
                  <p className="text-sm text-zinc-500">Aucun média trouvé.</p>
                </div>
              ) : (
                filteredLibrary.map(item => {
                  const isCurrent = isEditing && editingId === item.id;
                  const eps = episodeCount(item.seasons);
                  return (
                    <div
                      key={item.id}
                      className={`flex items-center gap-3 rounded-2xl p-2.5 ring-1 transition ${
                        isCurrent ? 'bg-red-600/10 ring-red-500/40' : 'bg-white/[0.03] ring-white/10 hover:bg-white/[0.05]'
                      }`}
                    >
                      <div className="flex h-16 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-zinc-900 text-zinc-600">
                        {item.poster
                          ? <img src={item.poster} alt="" loading="lazy" className="h-full w-full object-cover" />
                          : <Icon name="image" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{item.title}</p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-zinc-500">
                          <span className="inline-flex items-center gap-1">
                            <Icon name={item.type === 'movie' ? 'film' : 'tv'} className="h-3 w-3" />
                            {item.type === 'movie' ? 'Film' : 'Série'}
                          </span>
                          {item.type === 'series' && item.seasons && (
                            <span>{normalizeSeriesParts(item).seasons?.length} {isLupin(item) ? 'parties' : 's.'} · {eps} ép.</span>
                          )}
                          {item.genres && item.genres.length > 0 && (
                            <span className="truncate">{item.genres.slice(0, 2).join(', ')}</span>
                          )}
                        </p>
                      </div>

                      {confirmDeleteId === item.id ? (
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="yf-primary rounded-full bg-red-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-red-500"
                          >
                            Supprimer
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            className="rounded-full px-2 py-1.5 text-xs text-zinc-400 hover:text-white"
                          >
                            Non
                          </button>
                        </div>
                      ) : (
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            onClick={() => handleEdit(item)}
                            aria-label={`Modifier ${item.title}`}
                            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-zinc-300 ring-1 ring-white/10 transition hover:bg-white/10 hover:text-white"
                          >
                            <Icon name="edit" className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(item.id)}
                            aria-label={`Supprimer ${item.title}`}
                            className="flex h-9 w-9 items-center justify-center rounded-full bg-red-600/10 text-red-400 ring-1 ring-red-500/30 transition hover:bg-red-600/25"
                          >
                            <Icon name="trash" className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
