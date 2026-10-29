// Mangas and titles without a French audio track live in their own home sections.
// Both are stored as genre tags, so no schema change is needed.
export const MANGA_GENRE = 'Manga';
export const FOREIGN_GENRE = 'Langue étrangère';
export type Category = 'all' | 'movie' | 'series' | 'manga' | 'foreign';
type Item = { type?: string; genres?: string[] | null };

export const isManga = (item: Item) => !!item.genres?.includes(MANGA_GENRE);
export const isForeign = (item: Item) => !!item.genres?.includes(FOREIGN_GENRE);
// Films and Séries keep only titles that do not belong to a dedicated section.
export const isMainstream = (item: Item) => !isManga(item) && !isForeign(item);

export function inCategory(item: Item, category: Category) {
  if (category === 'manga') return isManga(item);
  if (category === 'foreign') return isForeign(item);
  if (category === 'movie' || category === 'series') return item.type === category && isMainstream(item);
  return true;
}

// TMDB: Animation genre (id 16) produced in Japanese or in Japan.
export function isJapaneseAnimation(details: Record<string, unknown>) {
  const genres = Array.isArray(details.genres) ? details.genres as { id?: unknown }[] : [];
  const countries = Array.isArray(details.origin_country) ? details.origin_country : [];
  return genres.some(genre => genre?.id === 16) && (details.original_language === 'ja' || countries.includes('JP'));
}

// A manga leaves the Animation genre for its own one.
export function withMangaGenre(genres: string[] | null | undefined, manga: boolean) {
  const current = genres || [];
  if (!manga) return current;
  return [MANGA_GENRE, ...current.filter(genre => genre !== 'Animation' && genre !== MANGA_GENRE)];
}

// true: a French track exists; false: tracks are named and none is French; null: unknown.
export function hasFrenchAudio(tracks: { name?: string; lang?: string }[] | null | undefined): boolean | null {
  const named = (tracks || []).filter(track => track.name || track.lang);
  if (!named.length) return null;
  return named.some(track => {
    const name = track.name || '', lang = (track.lang || '').toLowerCase().split('-')[0];
    if (/vostfr|\bvost?\b|\bvo\b|original|sous-titr/i.test(name)) return false;
    return ['fr', 'fre', 'fra'].includes(lang) || /fran[cç]ais|french|\bvff?\b|\bvfq\b|truefrench/i.test(name);
  });
}

export function withLanguageGenre(genres: string[] | null | undefined, french: boolean | null) {
  const current = genres || [];
  if (french === null) return current;
  const others = current.filter(genre => genre !== FOREIGN_GENRE);
  return french ? others : [...others, FOREIGN_GENRE];
}
