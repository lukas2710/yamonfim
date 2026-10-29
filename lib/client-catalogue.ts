import type { SupabaseClient } from '@supabase/supabase-js';
import { readClientResource } from './resource-cache';
import { fetchCatalogueRows, CATALOGUE_CARD_COLUMNS } from './catalogue';

export function fetchCatalogueCards<T extends { id: string | number }>(client: SupabaseClient, onPage?: (rows: T[]) => void) {
  let deliveredPage = false;
  return readClientResource<T[]>('catalogue:cards', () => fetchCatalogueRows<T>(client, CATALOGUE_CARD_COLUMNS, rows => { deliveredPage = true; onPage?.(rows); }))
    .then(rows => { if (!deliveredPage) onPage?.(rows); return rows; });
}

// How long visitors wait for the CDN copy before reading Supabase page by page.
const CDN_WAIT_MS = 2500;

// Visitor pages read the CDN-cached copy (up to five minutes old) instead of Supabase;
// admin pages keep fetchCatalogueCards so their edits show immediately. When that copy
// is slow (cold cache), the first titles come from Supabase at once instead.
export function fetchPublicCatalogueCards<T extends { id: string | number }>(client: SupabaseClient, onPage?: (rows: T[]) => void) {
  return readClientResource<T[]>('catalogue:public', () => new Promise<T[]>((resolve, reject) => {
    let settled = false, fallback = false;
    const finish = (rows: T[]) => { if (!settled) { settled = true; clearTimeout(timer); resolve(rows); } };
    const direct = () => {
      if (fallback) return;
      fallback = true;
      fetchCatalogueRows<T>(client, CATALOGUE_CARD_COLUMNS, rows => { if (!settled) onPage?.(rows); }).then(finish, error => { if (!settled) reject(error); });
    };
    const timer = setTimeout(direct, CDN_WAIT_MS);
    fetch('/api/catalogue', { signal: AbortSignal.timeout(20000) })
      .then(response => response.ok ? response.json() : null)
      .then((rows: unknown) => { if (Array.isArray(rows) && !settled) { onPage?.(rows as T[]); finish(rows as T[]); } else direct(); }, direct);
  })).then(rows => { onPage?.(rows); return rows; });
}
