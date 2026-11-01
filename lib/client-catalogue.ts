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

// How long visitors wait for the CDN copy before reading Supabase page by page.
const CDN_WAIT_MS = 2500;

// Public cards are shared across visitor and admin screens; admin selectors add
// recent live rows and editing opens the full live record. When the cached copy
// is slow (cold cache), the first titles come from Supabase at once instead.
export function fetchPublicCatalogueCards<T extends { id: string | number }>(client: SupabaseClient, onPage?: (rows: T[]) => void) {
  return readClientResource<T[]>('catalogue:public', () => new Promise<T[]>((resolve, reject) => {
    let settled = false, fallback = false, publicFailed = false, directFailed = false;
    let directError: unknown;
    const finish = (rows: T[]) => { if (!settled) { settled = true; clearTimeout(timer); resolve(rows); } };
    const direct = () => {
      if (fallback) return;
      fallback = true;
      fetchCards<T>(client, rows => { if (!settled) onPage?.(rows); }).then(finish, error => { directFailed = true; directError = error; if (!settled && publicFailed) { settled = true; clearTimeout(timer); reject(error); } });
    };
    const failPublic = () => { publicFailed = true; if (directFailed && !settled) { settled = true; clearTimeout(timer); reject(directError); } else direct(); };
    const timer = setTimeout(direct, CDN_WAIT_MS);
    fetch('/api/catalogue', { signal: AbortSignal.timeout(20000) })
      .then(response => response.ok ? response.json() : null)
      .then((rows: unknown) => { if (Array.isArray(rows) && !settled) { onPage?.(rows as T[]); finish(rows as T[]); } else failPublic(); }, failPublic);
  })).then(rows => { onPage?.(rows); return rows; });
}
