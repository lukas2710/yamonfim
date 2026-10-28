import { canWatch, type Audience } from './profile-audience';
import { supabase } from './supabase';
import { readClientMedia } from './resource-cache';
import { withTimeout } from './with-timeout';

export async function loadWatchMedia<T>(id: string): Promise<T | null> {
  const item = await readClientMedia<T | null>(id, async () => {
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
  const { data: { user } } = await supabase.auth.getUser();
  let profileId: string | undefined;
  try { profileId = JSON.parse(localStorage.getItem('active_profile') || '{}').id; } catch { /* Invalid profile is rejected below. */ }
  if (!user || !profileId) throw new Error('Choisis un profil avant de regarder ce contenu.');
  const { data: profile, error } = await supabase.from('user_profiles').select('profile_mode').eq('id', profileId).eq('user_id', user.id).single();
  if (error || !profile || (item && !canWatch(item as Audience, profile.profile_mode))) throw new Error('Ce contenu est indisponible pour ce profil. Choisis un titre dans ton catalogue.');
  return item;
}
let warming: Promise<unknown> | null = null;
export function prepareWatchMedia(id: string) {
  // Only one speculative metadata request; actual navigation is never queued behind it.
  if (warming) return;
  warming = loadWatchMedia(id).catch(() => {}).finally(() => { warming = null; });
}
