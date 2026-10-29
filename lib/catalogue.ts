import type { SupabaseClient } from '@supabase/supabase-js';

// The home page needs cards, not the large JSON season/episode player payloads.
export const CATALOGUE_CARD_COLUMNS = 'id,title,type,poster,backdrop,description,genres,tmdb_id,audience,release_year';
const PAGE = 250, PARALLEL = 6;
export async function fetchCatalogueRows<T extends { id: string | number }>(client: SupabaseClient, columns: string, onPage?: (rows: T[]) => void): Promise<T[]> {
  const page = (from: number, size: number, counted = false) => client.from('media')
    .select(columns, counted ? { count: 'exact' } : undefined)
    .order('created_at', { ascending: false }).order('id', { ascending: false }).range(from, from + size - 1)
    .then(({ data, error, count }) => {
      if (error) throw new Error('Le catalogue ne peut pas être chargé. Réessaie dans un instant.');
      return { data: (data || []) as unknown as T[], count };
    });
  const first = await page(0, PAGE, true);
  const rows: T[] = [];
  const seen = new Set<string>();
  const add = (data: T[]) => { for (const item of data) if (!seen.has(String(item.id))) { seen.add(String(item.id)); rows.push(item); } };
  add(first.data);
  onPage?.([...rows]);
  const total = first.count ?? (first.data.length < PAGE ? first.data.length : Infinity);
  if (total === Infinity) {
    // No count: fall back to reading page after page until a short one.
    for (let offset = first.data.length; first.data.length; ) {
      const { data } = await page(offset, PAGE);
      if (!data.length) break;
      add(data); onPage?.([...rows]); offset += data.length;
      if (data.length < PAGE) break;
    }
    return rows;
  }
  // The server may cap pages below PAGE: the first page tells the real size.
  const size = Math.max(1, Math.min(PAGE, first.data.length || PAGE));
  const offsets: number[] = [];
  for (let offset = first.data.length; offset < total; offset += size) offsets.push(offset);
  // Read the remaining pages a few at a time, but hand them over in catalogue order.
  const results: (T[] | undefined)[] = new Array(offsets.length);
  let next = 0, delivered = 0;
  await Promise.all(Array.from({ length: Math.min(PARALLEL, offsets.length) }, async () => {
    while (next < offsets.length) {
      const index = next++;
      const { data } = await page(offsets[index], size);
      if (!data.length) throw new Error('Le chargement du catalogue est incomplet. Actualise la page.');
      results[index] = data;
      let progressed = false;
      while (delivered < results.length && results[delivered]) { add(results[delivered]!); delivered++; progressed = true; }
      if (progressed) onPage?.([...rows]);
    }
  }));
  return rows;
}

export function fetchCatalogueCards<T extends { id: string | number }>(client: SupabaseClient, onPage?: (rows: T[]) => void) {
  return fetchCatalogueRows<T>(client, CATALOGUE_CARD_COLUMNS, onPage);
}
