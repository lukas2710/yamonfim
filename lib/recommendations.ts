export type RecommendationHistory = {
  media_id: string | number;
  current_time?: number | null;
  duration?: number | null;
  updated_at?: string | null;
};
type Title = { id: string | number; type: string; genres?: string[]; description?: string };
const normalize = (value: string) => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
const genres = (item: Title) => [...new Set((item.genres || []).map(normalize).filter(Boolean))];
const words = (item: Title) => new Set(normalize(item.description || '').match(/[a-z]{5,}/g)?.filter(word => !['cette', 'leurs', 'entre', 'apres', 'avant', 'comme', 'quand', 'alors', 'ainsi', 'contre', 'depuis', 'toute', 'monde', 'jeune', 'histoire', 'serie', 'saison', 'film', 'autres', 'nouveau', 'nouvelle', 'decouvre', 'trouve'].includes(word)) || []);

// History is supplied only for the active profile. No other members' data is used.
export function personalizedRecommendations<T extends Title>(catalogue: T[], history: RecommendationHistory[], limit = 20, now = Date.now()): T[] {
  const byId = new Map(catalogue.map(item => [String(item.id), item]));
  const seen = new Set(history.map(row => String(row.media_id)));
  const seeds = new Map<string, { item: T; weight: number }>();
  for (const row of history) {
    const item = byId.get(String(row.media_id));
    const elapsed = Number(row.current_time), duration = Number(row.duration);
    if (!item || !Number.isFinite(elapsed) || elapsed < 120) continue;
    const completion = duration > 0 ? Math.min(1, elapsed / duration) : 0.25;
    const timestamp = Date.parse(row.updated_at || '');
    const age = Number.isFinite(timestamp) ? Math.max(0, now - timestamp) / 86400000 : 90;
    const weight = (0.3 + completion) * (0.25 + 0.75 * Math.pow(0.5, age / 45));
    const previous = seeds.get(String(item.id));
    // A series does not outweigh every film merely because it has many episodes.
    if (!previous || weight > previous.weight) seeds.set(String(item.id), { item, weight });
  }
  if (!seeds.size) return [];
  const frequency = new Map<string, number>();
  for (const item of catalogue) for (const genre of genres(item)) frequency.set(genre, (frequency.get(genre) || 0) + 1);
  const preferences = [...seeds.values()].sort((a, b) => b.weight - a.weight).slice(0, 40).map(seed => ({ ...seed, genres: genres(seed.item), words: words(seed.item) }));
  const ranked = catalogue.filter(item => !seen.has(String(item.id))).map(item => {
    const candidateGenres = genres(item), candidateWords = words(item);
    let score = 0;
    for (const seed of preferences) {
      const shared = candidateGenres.filter(genre => seed.genres.includes(genre));
      if (!shared.length) continue;
      const affinity = shared.reduce((sum, genre) => sum + Math.log(1 + catalogue.length / (frequency.get(genre) || 1)), 0);
      const overlap = [...candidateWords].filter(word => seed.words.has(word)).length / Math.max(1, Math.sqrt(candidateWords.size * seed.words.size));
      score += seed.weight * (affinity / Math.sqrt(Math.max(1, candidateGenres.length * seed.genres.length)) + overlap * 2) * (seed.item.type === item.type ? 1.1 : 1);
    }
    return { item, score };
  }).filter(entry => entry.score > 0).sort((a, b) => b.score - a.score || String(a.item.id).localeCompare(String(b.item.id)));
  return ranked.slice(0, Math.max(0, limit)).map(entry => entry.item);
}
