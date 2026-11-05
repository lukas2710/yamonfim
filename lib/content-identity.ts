export interface ContentIdentity {
  id?: string | number; title?: string | null; type?: string | null;
  tmdb_id?: string | number | null; status?: string;
  url?: string | null; embedUrl?: string | null; release_year?: number | null;
}

export function normalizeContentTitle(value: string) {
  return value.trim().replace(/\s*\((?:18|19|20|21)\d{2}\)\s*$/, '').normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/œ/g, 'oe').replace(/æ/g, 'ae')
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}
export function normalizeTmdbId(value: ContentIdentity['tmdb_id']) {
  const text = value === null || value === undefined ? '' : String(value).trim();
  return /^\d+$/.test(text) && Number(text) > 0 ? text.replace(/^0+/, '') : '';
}
// Legacy imports often have no tmdb_id, but retain the exact Moviez identity
// in their iframe/player reference. Never guess from a title when an ID exists.
export function contentTmdbId(row: ContentIdentity) {
  const stored = normalizeTmdbId(row.tmdb_id);
  if (stored) return stored;
  for (const raw of [row.url, row.embedUrl]) {
    if (!raw || typeof raw !== 'string') continue;
    const value = (raw.match(/<iframe\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/i)?.[1] || raw.trim()).replace(/&amp;/gi, '&');
    try {
      const url = new URL(value, 'https://local.invalid');
      if (url.hostname === 'api.moviez.ac' && url.protocol === 'https:') {
        const match = row.type === 'movie' ? url.pathname.match(/^\/(\d+)\/?$/) : row.type === 'series' ? url.pathname.match(/^\/serie\/(\d+)\/\d+\/\d+\/?$/) : null;
        if (match) return normalizeTmdbId(match[1]);
      }
      if (url.pathname === '/api/catalogue-player' && url.searchParams.get('type') === (row.type === 'movie' ? 'movie' : row.type === 'series' ? 'tv' : '')) {
        const id = normalizeTmdbId(url.searchParams.get('tmdb'));
        if (id) return id;
      }
    } catch { /* A legacy non-player URL cannot establish an identity. */ }
  }
  return '';
}
// Without an identifier the year still separates « Dune (1984) » from « Dune (2021) ».
export function contentYear(row: ContentIdentity) {
  return row.title?.trim().match(/\(((?:18|19|20|21)\d{2})\)$/)?.[1] || (row.release_year ? String(row.release_year) : '');
}
// A saved film with neither a link nor an identifier is an empty card, not the film.
export function isEmptyFilm(row: ContentIdentity) {
  return row.type === 'movie' && row.url !== undefined && !row.url?.trim() && !row.embedUrl?.trim() && !contentTmdbId(row);
}
// `second` is the saved row. Keep this in step with public.yf_guard_content_duplicates.
export function sameContent(first: ContentIdentity, second: ContentIdentity) {
  if (!first.type || first.type !== second.type) return false;
  const a = contentTmdbId(first), b = contentTmdbId(second);
  if (a && b) return a === b;
  if (isEmptyFilm(second)) return false;
  const title = normalizeContentTitle(first.title || '');
  if (!title || title !== normalizeContentTitle(second.title || '')) return false;
  const firstYear = contentYear(first), secondYear = contentYear(second);
  return !firstYear || !secondYear || firstYear === secondYear;
}
export function findContentDuplicate<T extends ContentIdentity>(candidate: ContentIdentity, rows: T[], excludeId?: string | number | null): T | null {
  return rows.find(row => (excludeId === null || excludeId === undefined || String(row.id) !== String(excludeId)) && sameContent(candidate, row)) || null;
}
export function duplicateErrorMessage(error: { code?: string; message?: string; details?: string | null }, fallback: string) {
  const guarded = /YF_DUPLICATE/.test(error.message || '');
  if (error.code !== '23505' && !guarded) return fallback;
  // The guard names the row that blocked the addition, so it can be checked.
  const existing = guarded && error.details ? ` Fiche existante : « ${error.details} ».` : '';
  return `Ce film ou cette série est déjà disponible ou déjà enregistré.${existing} Aucun doublon n’a été ajouté.`;
}
