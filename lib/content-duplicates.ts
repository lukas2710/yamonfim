import type { SupabaseClient } from '@supabase/supabase-js';
import { findContentDuplicate, type ContentIdentity } from './content-identity';

export async function readContentIdentities(client: SupabaseClient, table: 'media' | 'requests') {
  const rows: ContentIdentity[] = [];
  let total = Infinity;
  while (rows.length < total) {
    const columns = table === 'requests' ? 'id,title,type,tmdb_id,status' : 'id,title,type,tmdb_id,url,embedUrl';
    const { data, error, count } = await client.from(table).select(columns, { count: 'exact' }).order('id').range(rows.length, rows.length + 499);
    if (error) throw new Error('Impossible de vérifier les doublons. Réessaie avant d’enregistrer.');
    if (count !== null) total = count;
    if (!data?.length) { if (total !== Infinity && rows.length < total) throw new Error('Vérification incomplète. Réessaie.'); break; }
    rows.push(...data as unknown as ContentIdentity[]);
  }
  return rows;
}

export async function checkContentDuplicate(client: SupabaseClient, candidate: ContentIdentity, target: 'media' | 'requests', excludeId?: string | number | null) {
  const media = await readContentIdentities(client, 'media');
  const existing = findContentDuplicate(candidate, media, target === 'media' ? excludeId : undefined);
  if (existing) return { source: 'catalogue' as const, item: existing };
  if (target === 'requests') {
    const requests = await readContentIdentities(client, 'requests');
    const pending = findContentDuplicate(candidate, requests.filter(row => row.status !== 'refuse'), excludeId);
    if (pending) return { source: 'demande' as const, item: pending };
  }
  return null;
}
