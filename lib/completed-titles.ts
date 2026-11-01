export type SeenRow = { media_id: string | number; ep_key: string; watched_at?: string };
export type CompletionProgress = { media_id: string | number; current_time?: number | null; duration?: number | null; updated_at?: string | null };
export function completedTitles(items: { id: string | number; type: string }[], seen: SeenRow[], history: CompletionProgress[], seriesKeys: Record<string, string[]>): Set<string> {
  const watched = new Map<string, Map<string, string>>();
  for (const row of seen) { const id = String(row.media_id); const keys = watched.get(id) || new Map<string, string>(); keys.set(row.ep_key, row.watched_at || ''); watched.set(id, keys); }
  // Explicit seen/unseen episode flags are the same source as the detail page.
  // Progress is used for the separate "Lecture en cours" state, never to undo a flag.
  void history;
  const result = new Set<string>();
  for (const item of items) {
    const id = String(item.id), keys = watched.get(id);
    if (item.type === 'movie') {
      if (keys?.has('movie_main')) result.add(id);
    } else {
      const required = seriesKeys[id];
      // Episode seen flags are authoritative, as on the series detail page.
      // A saved resume position must not undo an entirely watched series.
      const watchedEpisodes = keys ? [...keys.keys()].filter(key => /^s\d+_e\d+$/.test(key)) : [];
      // Some legacy profiles kept the same seen episodes after catalogue seasons were reordered.
      // When the count covers the current episode list, those old positional keys still mean complete.
      if (required?.length && (required.every(key => keys?.has(key)) || watchedEpisodes.length >= required.length)) result.add(id);
    }
  }
  return result;
}

export function inProgressTitles(seen: SeenRow[], history: CompletionProgress[], completed: ReadonlySet<string>): Set<string> {
  const started = new Set(seen.map(row => String(row.media_id)));
  for (const row of history) if (Number(row.current_time) > 0) started.add(String(row.media_id));
  for (const id of completed) started.delete(id);
  return started;
}

export async function fetchSeriesEpisodeKeys(ids: string[], signal?: AbortSignal, onPage?: (keys: Record<string, string[]>) => void): Promise<Record<string, string[]>> {
  const result: Record<string, string[]> = {};
  const unique = [...new Set(ids)];
  for (let offset = 0; offset < unique.length; offset += 10) {
    const batch = unique.slice(offset, offset + 10);
    const read = async (ids: string[]) => {
      const response = await fetch(`/api/catalogue-episodes?ids=${encodeURIComponent(ids.join(','))}`, { signal });
      if (!response.ok) throw new Error('Épisodes indisponibles');
      Object.assign(result, await response.json());
      onPage?.({ ...result });
    };
    try { await read(batch); }
    catch {
      if (signal?.aborted) throw new Error('Chargement annulé');
      // A large/failed series must not hide the successful badges in its batch.
      for (const id of batch) { try { await read([id]); } catch { if (signal?.aborted) throw new Error('Chargement annulé'); } }
    }
  }
  return result;
}
