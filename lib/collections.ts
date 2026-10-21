export interface CollectionMedia { id: string | number; title: string; type: 'movie' | 'series'; poster: string; backdrop?: string }
export interface MediaCollection { id: string; title: string; description: string; cover_url: string; media_ids: string[]; active: boolean; position: number }

export function collectionItems<T extends CollectionMedia>(collection: Pick<MediaCollection, 'media_ids'>, catalogue: T[]): T[] {
  const index = new Map(catalogue.map(item => [String(item.id), item]));
  return [...new Set(collection.media_ids)].flatMap(id => { const item = index.get(String(id)); return item ? [item] : []; });
}
export function safeCollectionImage(value: string) {
  if (!value.trim()) return '';
  try { const url = new URL(value.trim()); return ['https:', 'http:'].includes(url.protocol) ? url.href : ''; } catch { return ''; }
}
export function collectionPayload(input: Omit<MediaCollection, 'id'>, catalogue: CollectionMedia[]) {
  const title = input.title.trim();
  if (!title || title.length > 100) throw new Error('Choisis un nom de collection de 1 à 100 caractères.');
  if (input.description.length > 1000) throw new Error('La description doit contenir au maximum 1 000 caractères.');
  if (input.cover_url.trim() && !safeCollectionImage(input.cover_url)) throw new Error('Le lien de couverture doit commencer par https:// ou http://.');
  const media_ids = collectionItems(input, catalogue).map(item => String(item.id));
  if (!media_ids.length) throw new Error('Ajoute au moins un film ou une série du catalogue.');
  if (media_ids.length > 200) throw new Error('Une collection peut contenir jusqu’à 200 titres.');
  if (!Number.isInteger(input.position) || input.position < 0 || input.position > 9999) throw new Error('L’ordre doit être compris entre 0 et 9 999.');
  return { title, description: input.description.trim(), cover_url: safeCollectionImage(input.cover_url), media_ids, active: input.active, position: input.position };
}
