import { supabase } from './supabase';
import { readClientMedia } from './resource-cache';
import { withTimeout } from './with-timeout';

export function loadWatchMedia<T>(id: string): Promise<T | null> {
  return readClientMedia<T | null>(id, async () => {
    const controller = new AbortController();
    try {
      const { data, error } = await withTimeout(
        supabase.from('media').select('*').eq('id', id).abortSignal(controller.signal).maybeSingle(),
        15000, 'Le contenu met trop de temps à répondre. Vérifie ta connexion puis réessaie.'
      );
      if (error) throw new Error('Le contenu n’a pas pu être chargé. Réessaie dans un instant.');
      return data as T | null;
    } finally { controller.abort(); }
  });
}
let warming: Promise<unknown> | null = null;
export function prepareWatchMedia(id: string) {
  // Only one speculative metadata request; actual navigation is never queued behind it.
  if (warming) return;
  warming = loadWatchMedia(id).catch(() => {}).finally(() => { warming = null; });
}
