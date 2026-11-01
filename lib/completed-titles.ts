export type SeenRow = { media_id: string | number; ep_key: string; watched_at?: string };
export type CompletionProgress = { media_id: string | number; current_time?: number | null; duration?: number | null; updated_at?: string | null };
export function completedTitles(items: { id: string | number; type: string }[], seen: SeenRow[], history: CompletionProgress[], seriesKeys: Record<string, string[]>): Set<string> {
  const watched = new Map<string, Map<string, string>>();
  for (const row of seen) { const id = String(row.media_id); const keys = watched.get(id) || new Map<string, string>(); keys.set(row.ep_key, row.watched_at || ''); watched.set(id, keys); }
  const progress = new Map<string, CompletionProgress>();
  for (const row of history) { const id = String(row.media_id), old = progress.get(id); if (!old || String(row.updated_at || '') > String(old.updated_at || '')) progress.set(id, row); }
  const result = new Set<string>();
  for (const item of items) {
    const id = String(item.id), keys = watched.get(id), row = progress.get(id);
    const finished = !!row && Number(row.duration) > 0 && Number(row.current_time) / Number(row.duration) >= .95;
    const interrupted = !!row && Number(row.duration) > 0 && !finished;
    const marks = keys ? [...keys.values()].sort() : [];
    const lastMark = marks[marks.length - 1] || '';
    const manualAfterProgress = !!lastMark && lastMark > String(row?.updated_at || '');
    if (item.type === 'movie') {
      if (finished || keys?.has('movie_main') && (!interrupted || manualAfterProgress)) result.add(id);
    } else {
      const required = seriesKeys[id];
      if (required?.length && required.every(key => keys?.has(key)) && (!interrupted || manualAfterProgress)) result.add(id);
    }
  }
  return result;
}

export async function fetchSeriesEpisodeKeys(ids: string[], signal?: AbortSignal): Promise<Record<string, string[]>> {
  const result: Record<string, string[]> = {};
  const unique = [...new Set(ids)];
  for (let offset = 0; offset < unique.length; offset += 10) {
    const response = await fetch(`/api/catalogue-episodes?ids=${encodeURIComponent(unique.slice(offset, offset + 10).join(','))}`, { signal });
    if (response.ok) Object.assign(result, await response.json());
  }
  return result;
}
