import type { SupabaseClient } from '@supabase/supabase-js';

// The home page needs cards, not the large JSON season/episode player payloads.
export const CATALOGUE_CARD_COLUMNS = 'id,title,type,poster,backdrop,description,genres,tmdb_id,audience,release_year,created_at';
// Light card rows read fastest in large pages; season payloads need small ones.
const PAGE = 250, CARD_PAGE = 1000, PARALLEL = 6, MIN_PAGE = 25;
export async function fetchCatalogueRows<T extends { id: string | number }>(client: SupabaseClient, columns: string, onPage?: (rows: T[]) => void, pageSize = PAGE): Promise<T[]> {
  const page = async (from: number, size: number, counted = false): Promise<{ data: T[]; count: number | null }> => {
    const { data, error, count } = await client.from('media')
      .select(columns, counted ? { count: 'exact' } : undefined)
      .order('created_at', { ascending: false }).order('id', { ascending: false }).range(from, from + size - 1);
    if (!error) return { data: (data || []) as unknown as T[], count };
    // Large season payloads can hit the database statement timeout: retry the
    // same range in two smaller halves before giving up.
    if (size <= MIN_PAGE) throw new Error('Le catalogue ne peut pas être chargé. Réessaie dans un instant.');
    const half = Math.ceil(size / 2);
    const head = await page(from, half, counted);
    if (head.data.length < half) return head;
    const tail = await page(from + half, size - half);
    return { data: [...head.data, ...tail.data], count: head.count };
  };
  const first = await page(0, pageSize, true);
  const rows: T[] = [];
  const seen = new Set<string>();
  const add = (data: T[]) => { for (const item of data) if (!seen.has(String(item.id))) { seen.add(String(item.id)); rows.push(item); } };
  add(first.data);
  onPage?.([...rows]);
  const total = first.count ?? (first.data.length < pageSize ? first.data.length : Infinity);
  if (total === Infinity) {
    // No count: fall back to reading page after page until a short one.
    for (let offset = first.data.length; first.data.length; ) {
      const { data } = await page(offset, pageSize);
      if (!data.length) break;
      add(data); onPage?.([...rows]); offset += data.length;
      if (data.length < pageSize) break;
    }
    return rows;
  }
  // The server may cap pages below PAGE: the first page tells the real size.
  const size = Math.max(1, Math.min(pageSize, first.data.length || pageSize));
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
  return fetchCatalogueRows<T>(client, CATALOGUE_CARD_COLUMNS, onPage, CARD_PAGE);
}
