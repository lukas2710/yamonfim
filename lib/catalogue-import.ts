import { supabase } from './supabase';
import { getPersistentSession } from './auth-session';
import { checkContentDuplicate } from './content-duplicates';
import { duplicateErrorMessage } from './content-identity';
import { cataloguePlayer } from './catalogue-source';
import { clearClientResources } from './resource-cache';

export const CATALOGUE_ADMIN = 'lukas.leclerc312@gmail.com';
export type ImportRequest = { id: string; type: 'movie' | 'series'; job: string };
export function parseImportRequest(value: unknown): ImportRequest | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  if (typeof row.id !== 'string' || !/^[1-9]\d{0,9}$/.test(row.id) || !['movie', 'series'].includes(String(row.type)) || typeof row.job !== 'string' || !/^[a-zA-Z0-9-]{8,100}$/.test(row.job)) return null;
  return { id: row.id, type: row.type as ImportRequest['type'], job: row.job };
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

async function importCatalogueItemOnce(item: ImportRequest, progress: (message: string) => void) {
  const { data: { session } } = await getPersistentSession();
  if (!session || session.user.email !== CATALOGUE_ADMIN) throw new Error('Connecte-toi avec ton compte administrateur sur le site, puis réessaie.');
  const identity = { tmdb_id: item.id, type: item.type, title: '' };
  if (await checkContentDuplicate(supabase, identity, 'media')) return { already: true };
  const tmdbKey = 'af281c5089038e174e83c576ff765be9';
  async function metadata(path: string) {
    const response = await fetch(`https://api.themoviedb.org/3/${path}?api_key=${tmdbKey}&language=fr-FR`, { signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error('Fiche TMDB indisponible. Réessaie.');
    return response.json();
  }
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
    const count = details.number_of_seasons;
    if (!Number.isSafeInteger(count) || count < 1 || count > 1000) throw new Error('Aucune saison exploitable sur cette fiche.');
    let nextSeason = 1;
    await Promise.all(Array.from({ length: Math.min(3, count) }, async () => {
    while (nextSeason <= count) {
      const season = nextSeason++;
      progress(`Récupération de la saison ${season}/${details.number_of_seasons}…`);
      const info = await metadata(`tv/${item.id}/season/${season}`);
      if (!Array.isArray(info.episodes)) throw new Error(`Saison ${season} incomplète. Réessaie.`);
      payload.seasons!.push({ seasonNumber: season, poster_path: info.poster_path ? `https://image.tmdb.org/t/p/w500${info.poster_path}` : poster, episodes: info.episodes.map((episode: { episode_number: number; name?: string; still_path?: string; runtime?: number }) => ({ number: episode.episode_number, title: episode.name || `Épisode ${episode.episode_number}`, embedUrl: cataloguePlayer({ id: item.id, type: 'tv', season, episode: episode.episode_number }), still_path: episode.still_path ? `https://image.tmdb.org/t/p/w500${episode.still_path}` : poster, runtime: episode.runtime || details.episode_run_time?.[0] || 45 })) });
    }
    }));
    payload.seasons.sort((a, b) => a.seasonNumber - b.seasonNumber);
    if (!payload.seasons.some(season => season.episodes.length)) throw new Error('Aucun épisode sur cette fiche. La série n’a pas été ajoutée.');
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
