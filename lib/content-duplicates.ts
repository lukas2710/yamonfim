import type { SupabaseClient } from '@supabase/supabase-js';
import { findContentDuplicate, type ContentIdentity } from './content-identity';

async function readCandidateRows(client: SupabaseClient, table: 'media' | 'requests', candidate: ContentIdentity) {
  const columns = table === 'requests' ? 'id,title,type,tmdb_id,status' : 'id,title,type,tmdb_id,url,embedUrl';
  const matches = await Promise.all([
    candidate.tmdb_id != null && String(candidate.tmdb_id).trim()
      ? client.from(table).select(columns).eq('type', candidate.type || '').eq('tmdb_id', String(candidate.tmdb_id)).limit(20)
      : Promise.resolve({ data: [], error: null }),
    candidate.title?.trim()
      ? client.from(table).select(columns).eq('type', candidate.type || '').eq('title', candidate.title.trim()).limit(20)
      : Promise.resolve({ data: [], error: null }),
  ]);
  const error = matches.find(result => result.error)?.error;
  if (error) throw new Error('Impossible de vérifier les doublons. Réessaie avant d’enregistrer.');
  const rows = new Map<string, ContentIdentity>();
  for (const result of matches) for (const row of result.data || []) {
    const identity = row as unknown as ContentIdentity;
    rows.set(String(identity.id), identity);
  }
  return [...rows.values()];
}

// Probe only indexed identity values instead of downloading every catalogue
// row before each add. The database trigger performs the authoritative,
// accent-insensitive duplicate check when a legacy title needs normalization.
export async function checkContentDuplicate(client: SupabaseClient, candidate: ContentIdentity, target: 'media' | 'requests', excludeId?: string | number | null) {
  const media = await readCandidateRows(client, 'media', candidate);
  const existingMedia = findContentDuplicate(candidate, media, target === 'media' ? excludeId : undefined);
  if (existingMedia) return { source: 'catalogue' as const, item: existingMedia };
  if (target === 'requests') {
    const requests = (await readCandidateRows(client, 'requests', candidate)).filter(row => row.status !== 'refuse');
    const existingRequest = findContentDuplicate(candidate, requests, excludeId);
    if (existingRequest) return { source: 'demande' as const, item: existingRequest };
  }
  return null;
}
