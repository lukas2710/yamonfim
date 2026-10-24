import type { SupabaseClient } from '@supabase/supabase-js';
import { readClientResource } from './resource-cache';
import { fetchCatalogueRows, CATALOGUE_CARD_COLUMNS } from './catalogue';

export function fetchCatalogueCards<T extends { id: string | number }>(client: SupabaseClient, onPage?: (rows: T[]) => void) {
  let deliveredPage = false;
  return readClientResource<T[]>('catalogue:cards', () => fetchCatalogueRows<T>(client, CATALOGUE_CARD_COLUMNS, rows => { deliveredPage = true; onPage?.(rows); }))
    .then(rows => { if (!deliveredPage) onPage?.(rows); return rows; });
}
