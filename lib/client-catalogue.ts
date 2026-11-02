import type { SupabaseClient } from '@supabase/supabase-js';
import { readClientResource } from './resource-cache';
import { fetchCatalogueCards as fetchCards } from './catalogue';

export function fetchCatalogueCards<T extends { id: string | number }>(client: SupabaseClient, onPage?: (rows: T[]) => void) {
  return readClientResource<T[]>('catalogue:cards', async () => {
    const rows = await fetchPublicCatalogueCards<T>(client, onPage);
    // New additions must be selectable immediately even while the CDN snapshot
    // catches up. This small request avoids downloading every season/episode.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    try {
      const { data, error } = await client.from('media').select('id,title,type,poster,backdrop,description,genres,tmdb_id,audience,release_year').order('created_at', { ascending: false }).order('id', { ascending: false }).limit(250).abortSignal(controller.signal);
      if (!error && data) {
        const latest = data as unknown as T[], ids = new Set(latest.map(item => String(item.id)));
        return [...latest, ...rows.filter(item => !ids.has(String(item.id)))];
      }
    } catch { /* The cached catalogue remains usable when Supabase is slow. */ }
    finally { clearTimeout(timer); }
    return rows;
  }).then(rows => { onPage?.(rows); return rows; });
}

// Public cards are shared across visitor and admin screens. Keep one request
// path for the full catalogue: falling back to paginating all media from every
// browser multiplied database sorting work during slow cache responses.
export function fetchPublicCatalogueCards<T extends { id: string | number }>(client: SupabaseClient, onPage?: (rows: T[]) => void) {
  return readClientResource<T[]>('catalogue:public', async () => {
    const response = await fetch('/api/catalogue', { signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error(`Le catalogue ne peut pas être chargé (${response.status}). Réessaie.`);
    const rows: unknown = await response.json();
    if (!Array.isArray(rows)) throw new Error('Réponse catalogue invalide. Réessaie.');
    onPage?.(rows as T[]);
    return rows as T[];
  }).then(rows => { onPage?.(rows); return rows; });
}
