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

const PAGE_SIZE = 2000, PARALLEL = 4, REFRESH_EVERY = 5;
// The list weighs tens of megabytes: the first page shows the home at once, and
// the rest arrives in order, refreshing the screen only every few pages.
export async function readCataloguePages<T>(read: (offset: number) => Promise<Response>, onPage?: (rows: T[]) => void) {
  const page = async (offset: number) => {
    for (let attempt = 0; ; attempt++) {
      try {
        const response = await read(offset);
        if (!response.ok) throw new Error(`Le catalogue ne peut pas être chargé (${response.status}). Réessaie.`);
        const rows: unknown = await response.json();
        if (!Array.isArray(rows)) throw new Error('Réponse catalogue invalide. Réessaie.');
        return { rows: rows as T[], total: Number(response.headers.get('X-Total-Count')) };
      } catch (error) { if (attempt >= 2) throw error; }
    }
  };
  const first = await page(0);
  const rows = [...first.rows];
  onPage?.([...rows]);
  const total = Number.isFinite(first.total) && first.total > 0 ? first.total : rows.length;
  const offsets: number[] = [];
  for (let offset = rows.length; rows.length && offset < total; offset += PAGE_SIZE) offsets.push(offset);
  const pages: (T[] | undefined)[] = new Array(offsets.length);
  let next = 0, delivered = 0;
  await Promise.all(Array.from({ length: Math.min(PARALLEL, offsets.length) }, async () => {
    while (next < offsets.length) {
      const index = next++;
      pages[index] = (await page(offsets[index])).rows;
      while (delivered < pages.length && pages[delivered]) {
        rows.push(...pages[delivered]!);
        delivered++;
        if (delivered % REFRESH_EVERY === 0) onPage?.([...rows]);
      }
    }
  }));
  return rows;
}

// Public cards are shared across visitor and admin screens. Keep one request
// path for the full catalogue: falling back to paginating all media from every
// browser multiplied database sorting work during slow cache responses.
export function fetchPublicCatalogueCards<T extends { id: string | number }>(client: SupabaseClient, onPage?: (rows: T[]) => void) {
  return readClientResource<T[]>('catalogue:public', () => readCataloguePages<T>(
    offset => fetch(`/api/catalogue?limit=${PAGE_SIZE}&offset=${offset}`, { signal: AbortSignal.timeout(20000) }), onPage,
  )).then(rows => { onPage?.(rows); return rows; });
}
