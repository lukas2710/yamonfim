export interface ContentIdentity {
  id?: string | number; title?: string | null; type?: string | null;
  tmdb_id?: string | number | null; status?: string;
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
export function sameContent(first: ContentIdentity, second: ContentIdentity) {
  if (!first.type || first.type !== second.type) return false;
  const a = normalizeTmdbId(first.tmdb_id), b = normalizeTmdbId(second.tmdb_id);
  if (a && b) return a === b;
  const title = normalizeContentTitle(first.title || '');
  return !!title && title === normalizeContentTitle(second.title || '');
}
export function findContentDuplicate<T extends ContentIdentity>(candidate: ContentIdentity, rows: T[], excludeId?: string | number | null): T | null {
  return rows.find(row => (excludeId === null || excludeId === undefined || String(row.id) !== String(excludeId)) && sameContent(candidate, row)) || null;
}
export function duplicateErrorMessage(error: { code?: string; message?: string }, fallback: string) {
  return error.code === '23505' || /YF_DUPLICATE/.test(error.message || '')
    ? 'Ce film ou cette série est déjà disponible ou déjà enregistré. Aucun doublon n’a été ajouté.' : fallback;
}
