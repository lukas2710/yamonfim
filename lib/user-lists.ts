import type { SupabaseClient } from '@supabase/supabase-js';

export type UserList = 'favorite' | 'later';
export interface ListEntry { media_id: string; list: UserList; created_at: string }
export const LIST_LABELS: Record<UserList, { add: string; added: string; row: string }> = {
  favorite: { add: 'Ajouter aux favoris', added: 'Dans mes favoris', row: 'Mes favoris' },
  later: { add: 'À regarder plus tard', added: 'Dans « Plus tard »', row: 'À regarder plus tard' },
};

// Until the table exists the lists stay hidden; any other failure must stay visible.
export function listsMissing(error: { code?: string } | null) {
  return !!error && (error.code === '42P01' || error.code === 'PGRST205');
}

export async function fetchUserLists(client: SupabaseClient, userId: string, profileId: string) {
  const { data, error } = await client.from('user_lists').select('media_id,list,created_at')
    .eq('user_id', userId).eq('profile_id', profileId).order('created_at', { ascending: false }).limit(1000);
  if (error) return { entries: [] as ListEntry[], available: !listsMissing(error) };
  return { entries: (data || []) as ListEntry[], available: true };
}

export async function setUserList(client: SupabaseClient, userId: string, profileId: string, mediaId: string, list: UserList, present: boolean) {
  const row = { user_id: userId, profile_id: profileId, media_id: mediaId, list };
  const { error } = present
    ? await client.from('user_lists').upsert(row, { onConflict: 'user_id,profile_id,media_id,list', ignoreDuplicates: true })
    : await client.from('user_lists').delete().eq('user_id', userId).eq('profile_id', profileId).eq('media_id', mediaId).eq('list', list);
  if (error) throw new Error('La liste n’a pas pu être mise à jour. Réessaie.');
}

/** Titres d'une liste, du plus récent au plus ancien, parmi ceux accessibles au profil. */
export function listTitles<T extends { id: string | number }>(entries: ListEntry[], list: UserList, titles: T[]) {
  const byId = new Map(titles.map(item => [String(item.id), item]));
  return entries.filter(entry => entry.list === list).flatMap(entry => byId.get(entry.media_id) ?? []);
}
