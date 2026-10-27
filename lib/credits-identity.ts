import { catalogueSource } from './catalogue-source';
export function creditsTmdb(media: { tmdb_id?: unknown }, source?: string) {
  const value = String(media.tmdb_id || '');
  if (/^[1-9]\d{0,9}$/.test(value)) return value;
  try { return source ? catalogueSource(source).id : ''; } catch { return ''; }
}
