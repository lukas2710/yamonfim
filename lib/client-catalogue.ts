import type { SupabaseClient } from '@supabase/supabase-js';
import { readClientResource } from './resource-cache';
import { fetchCatalogueRows, CATALOGUE_CARD_COLUMNS } from './catalogue';

export function fetchCatalogueCards<T extends { id: string | number }>(client: SupabaseClient, onPage?: (rows: T[]) => void) {
  let deliveredPage = false;
  return readClientResource<T[]>('catalogue:cards', () => fetchCatalogueRows<T>(client, CATALOGUE_CARD_COLUMNS, rows => { deliveredPage = true; onPage?.(rows); }))
    .then(rows => { if (!deliveredPage) onPage?.(rows); return rows; });
}

// Visitor pages read the CDN-cached copy (up to five minutes old) instead of Supabase;
// admin pages keep fetchCatalogueCards so their edits show immediately.
export function fetchPublicCatalogueCards<T extends { id: string | number }>(client: SupabaseClient, onPage?: (rows: T[]) => void) {
  return readClientResource<T[]>('catalogue:public', async () => {
    const response = await fetch('/api/catalogue', { signal: AbortSignal.timeout(20000) }).catch(() => null);
    const rows: unknown = response?.ok ? await response.json().catch(() => null) : null;
    return Array.isArray(rows) ? rows as T[] : fetchCatalogueRows<T>(client, CATALOGUE_CARD_COLUMNS);
  }).then(rows => { onPage?.(rows); return rows; });
}
