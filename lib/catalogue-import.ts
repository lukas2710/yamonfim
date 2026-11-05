import { supabase } from './supabase';
import { getPersistentSession } from './auth-session';
import { checkContentDuplicate } from './content-duplicates';
import { duplicateErrorMessage } from './content-identity';
import { cataloguePlayer } from './catalogue-source';
import { clearClientResources } from './resource-cache';

export const CATALOGUE_ADMIN = 'lukas.leclerc312@gmail.com';
// These titles can never be added: the catalogue pages hide them.
export const UNAVAILABLE_ERRORS = ['Titre introuvable sur TMDB.', 'Aucune saison exploitable sur cette fiche.', 'Aucun épisode sur cette fiche. La série n’a pas été ajoutée.'];
// update: complete a series already on the site with its new seasons and episodes.
export type ImportRequest = { id: string; type: 'movie' | 'series'; job: string; update?: boolean };
export function parseImportRequest(value: unknown): ImportRequest | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  if (typeof row.id !== 'string' || !/^[1-9]\d{0,9}$/.test(row.id) || !['movie', 'series'].includes(String(row.type)) || typeof row.job !== 'string' || !/^[a-zA-Z0-9-]{8,100}$/.test(row.job)) return null;
  return { id: row.id, type: row.type as ImportRequest['type'], job: row.job, ...(row.update === true && row.type === 'series' ? { update: true } : {}) };
}

// Imports store stable film/episode references. The existing playback API
// discovers and verifies actual streams when a viewer starts playback.
export async function importCatalogueItem(item: ImportRequest, progress: (message: string) => void) {
  const run = () => importCatalogueItemOnce(item, progress);
  if (typeof navigator !== 'undefined' && navigator.locks) {
    return navigator.locks.request(`yamonfim-import:${item.type}:${item.id}`, run);
  }
  return run();
}

type SeriesSeason = { seasonNumber: number; poster_path: string; episodes: { number: number; title: string; embedUrl: string; still_path: string; runtime: number }[] };
const TMDB_KEY = 'af281c5089038e174e83c576ff765be9';
// Bulk additions hit TMDB's rate limit and short outages: wait instead of failing the title.
async function tmdbMetadata(path: string, missing = UNAVAILABLE_ERRORS[0]) {
  for (let attempt = 1; ; attempt++) {
    const response = await fetch(`https://api.themoviedb.org/3/${path}?api_key=${TMDB_KEY}&language=fr-FR`, { signal: AbortSignal.timeout(20000) }).catch(() => null);
    if (response?.status === 404) throw new Error(missing);
    if (response?.ok) return response.json();
    if (attempt >= 3) throw new Error('TMDB est temporairement indisponible. Réessaie.');
    await new Promise(resolve => setTimeout(resolve, attempt * 1500));
  }
}
// TMDB's numbering can have gaps and it lists empty seasons: only real ones are read.
function listedSeasons(details: { seasons?: { season_number: number; episode_count?: number }[] }) {
  return (details.seasons || []).filter(season => Number.isSafeInteger(season.season_number) && season.season_number >= 1 && season.episode_count !== 0);
}
const seasonDetails = (id: string, season: number) => tmdbMetadata(`tv/${id}/season/${season}`, `Saison ${season} introuvable sur TMDB. Réessaie.`);
function seasonEpisodes(id: string, season: number, info: { episodes: { episode_number: number; name?: string; still_path?: string; runtime?: number }[] }, poster: string, runtime: number) {
  return info.episodes.map(episode => ({ number: episode.episode_number, title: episode.name || `Épisode ${episode.episode_number}`, embedUrl: cataloguePlayer({ id, type: 'tv', season, episode: episode.episode_number }), still_path: episode.still_path ? `https://image.tmdb.org/t/p/w500${episode.still_path}` : poster, runtime: episode.runtime || runtime }));
}
// Adds the seasons and episodes TMDB lists beyond those already saved; existing
// episodes are kept exactly as they are.
async function completeSeries(item: ImportRequest, existing: { id: string; seasons: SeriesSeason[] | null }, userId: string, progress: (message: string) => void) {
  progress('Recherche des nouvelles saisons…');
  const details = await tmdbMetadata(`tv/${item.id}`);
  const poster = details.poster_path ? `https://image.tmdb.org/t/p/w500${details.poster_path}` : '';
  const seasons = (existing.seasons || []).map(season => ({ ...season, episodes: [...(season.episodes || [])] }));
  let added = 0;
  for (const listed of listedSeasons(details)) {
    const current = seasons.find(season => season.seasonNumber === listed.season_number);
    if (current && current.episodes.length >= (listed.episode_count || 0)) continue;
    progress(`Récupération de la saison ${listed.season_number}…`);
    const info = await seasonDetails(item.id, listed.season_number);
    if (!Array.isArray(info.episodes)) throw new Error(`Saison ${listed.season_number} incomplète. Réessaie.`);
    const episodes = seasonEpisodes(item.id, listed.season_number, info, poster, details.episode_run_time?.[0] || 45);
    if (!current) { if (episodes.length) { seasons.push({ seasonNumber: listed.season_number, poster_path: info.poster_path ? `https://image.tmdb.org/t/p/w500${info.poster_path}` : poster, episodes }); added += episodes.length; } continue; }
    const known = new Set(current.episodes.map(episode => episode.number));
    const fresh = episodes.filter(episode => !known.has(episode.number));
    current.episodes.push(...fresh); current.episodes.sort((a, b) => a.number - b.number); added += fresh.length;
  }
  if (!added) return { already: true };
  seasons.sort((a, b) => a.seasonNumber - b.seasonNumber);
  const { data: { session } } = await getPersistentSession();
  if (!session || session.user.id !== userId || session.user.email !== CATALOGUE_ADMIN) throw new Error('La connexion administrateur a changé. Aucun ajout effectué.');
  progress('Enregistrement des nouveaux épisodes…');
  const { error } = await supabase.from('media').update({ seasons }).eq('id', existing.id);
  if (error) throw new Error('Enregistrement impossible : ' + error.message);
  clearClientResources();
  return { already: false, added };
}

async function importCatalogueItemOnce(item: ImportRequest, progress: (message: string) => void) {
  const { data: { session } } = await getPersistentSession();
  if (!session || session.user.email !== CATALOGUE_ADMIN) throw new Error('Connecte-toi avec ton compte administrateur sur le site, puis réessaie.');
  const identity = { tmdb_id: item.id, type: item.type, title: '' };
  if (item.update) {
    const { data: existing, error } = await supabase.from('media').select('id,seasons').eq('type', 'series').eq('tmdb_id', item.id).limit(1).maybeSingle();
    if (error) throw new Error('Lecture de la série impossible. Réessaie.');
    if (existing) return completeSeries(item, existing as { id: string; seasons: SeriesSeason[] | null }, session.user.id, progress);
  }
  if (await checkContentDuplicate(supabase, identity, 'media')) return { already: true };
  const metadata = tmdbMetadata;
  progress('Récupération de la fiche et des affiches…');
  const endpoint = item.type === 'movie' ? 'movie' : 'tv';
  const details = await metadata(`${endpoint}/${item.id}`);
  const name = details.title || details.name;
  if (typeof name !== 'string' || !name.trim()) throw new Error('La fiche ne contient pas de titre valide.');
  const date = details.release_date || details.first_air_date || '';
  const title = name + (date ? ` (${date.slice(0, 4)})` : '');
  const poster = details.poster_path ? `https://image.tmdb.org/t/p/w500${details.poster_path}` : '';
  const payload = { ...identity, title, poster, backdrop: details.backdrop_path ? `https://image.tmdb.org/t/p/original${details.backdrop_path}` : '', description: details.overview || '', genres: (details.genres || []).map((genre: { name: string }) => genre.name), url: '', embedUrl: '', seasons: null as null | { seasonNumber: number; poster_path: string; episodes: { number: number; title: string; embedUrl: string; still_path: string; runtime: number }[] }[] };
  if (item.type === 'movie') {
    payload.url = payload.embedUrl = cataloguePlayer({ id: item.id, type: 'movie', season: 1, episode: 1 });
  } else {
    payload.seasons = [];
    const listed = listedSeasons(details);
    if (!listed.length) throw new Error(UNAVAILABLE_ERRORS[1]);
    let nextSeason = 0;
    await Promise.all(Array.from({ length: Math.min(3, listed.length) }, async () => {
    while (nextSeason < listed.length) {
      const position = nextSeason++, season = listed[position].season_number;
      progress(`Récupération de la saison ${position + 1}/${listed.length}…`);
      const info = await seasonDetails(item.id, season);
      if (!Array.isArray(info.episodes)) throw new Error(`Saison ${season} incomplète. Réessaie.`);
      payload.seasons!.push({ seasonNumber: season, poster_path: info.poster_path ? `https://image.tmdb.org/t/p/w500${info.poster_path}` : poster, episodes: seasonEpisodes(item.id, season, info, poster, details.episode_run_time?.[0] || 45) });
    }
    }));
    payload.seasons.sort((a, b) => a.seasonNumber - b.seasonNumber);
    if (!payload.seasons.some(season => season.episodes.length)) throw new Error(UNAVAILABLE_ERRORS[2]);
  }
  progress('Enregistrement sur ton site…');
  const { data: { session: current } } = await getPersistentSession();
  if (!current || current.user.id !== session.user.id || current.user.email !== CATALOGUE_ADMIN) throw new Error('La connexion administrateur a changé. Aucun ajout effectué.');
  if (await checkContentDuplicate(supabase, payload, 'media')) return { already: true };
  const { error } = await supabase.from('media').insert([payload]);
  if (error) {
    if ((error.code === '23505' || /YF_DUPLICATE/.test(error.message || '')) && await checkContentDuplicate(supabase, payload, 'media')) return { already: true };
    throw new Error(duplicateErrorMessage(error, 'Enregistrement impossible : ' + error.message));
  }
  clearClientResources();
  try { await supabase.from('requests').update({ status: 'ajoute' }).eq('tmdb_id', item.id).eq('type', item.type); } catch { /* The catalogue insert has already succeeded. */ }
  return { already: false };
}
