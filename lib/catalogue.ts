import type { SupabaseClient } from '@supabase/supabase-js';

// The home page needs cards, not the large JSON season/episode player payloads.
export const CATALOGUE_CARD_COLUMNS = 'id,title,type,poster,backdrop,description,genres,tmdb_id,audience,release_year';
export async function fetchCatalogueRows<T extends { id: string | number }>(client: SupabaseClient, columns: string, onPage?: (rows: T[]) => void): Promise<T[]> {
  const rows: T[] = [];
  let total = Infinity, offset = 0;
  const seen = new Set<string>();
  while (offset < total) {
    const { data, error, count } = await client.from('media')
      .select(columns, offset === 0 ? { count: 'exact' } : undefined)
      .order('created_at', { ascending: false }).order('id', { ascending: false }).range(offset, offset + 249);
    if (error) throw new Error('Le catalogue ne peut pas être chargé. Réessaie dans un instant.');
    if (count !== null) total = count;
    if (!data?.length) {
      if (offset < total && total !== Infinity) throw new Error('Le chargement du catalogue est incomplet. Actualise la page.');
      break;
    }
    offset += data.length;
    for (const item of data as unknown as T[]) if (!seen.has(String(item.id))) { seen.add(String(item.id)); rows.push(item); }
    onPage?.([...rows]);
    if (total === Infinity && data.length < 250) break;
  }
  return rows;
}

export function fetchCatalogueCards<T extends { id: string | number }>(client: SupabaseClient, onPage?: (rows: T[]) => void) {
  return fetchCatalogueRows<T>(client, CATALOGUE_CARD_COLUMNS, onPage);
}
