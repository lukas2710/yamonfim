// Home carousel setting stored in site_settings under the "home_hero" key.
export type HeroMode = 'latest' | 'custom' | 'top';
export interface HeroSetting { mode: HeroMode; media_ids: string[]; days: number }
export const HERO_SIZE = 5;
export const DEFAULT_HERO: HeroSetting = { mode: 'latest', media_ids: [], days: 30 };

export function parseHeroSetting(value: unknown): HeroSetting {
  const raw = (value && typeof value === 'object' ? value : {}) as Partial<Record<keyof HeroSetting, unknown>>;
  const mode: HeroMode = raw.mode === 'custom' || raw.mode === 'top' ? raw.mode : 'latest';
  const ids = Array.isArray(raw.media_ids) ? raw.media_ids.map(String).filter(Boolean).slice(0, HERO_SIZE) : [];
  const days = [7, 30, 90, 0].includes(Number(raw.days)) ? Number(raw.days) : DEFAULT_HERO.days;
  return { mode, media_ids: ids, days };
}

// Picks the carousel titles in order (an entry may be one season: "156:s3");
// missing titles are filled with the latest additions.
export function pickHeroItems<T extends { id: unknown }>(catalogue: T[], entries: string[]): { item: T; season: number | null }[] {
  const byId = new Map(catalogue.map(item => [String(item.id), item]));
  const chosen: { item: T; season: number | null }[] = [];
  const used = new Set<string>();
  for (const entry of entries) {
    // Same "id" / "id:sN" format as banners (lib/banner-items).
    const match = /^(.+):s(\d+)$/.exec(entry);
    const mediaId = match ? match[1] : entry;
    const season = match ? Number(match[2]) : null;
    const item = byId.get(mediaId);
    if (!item || used.has(mediaId)) continue;
    used.add(mediaId);
    chosen.push({ item, season });
  }
  for (const item of catalogue) {
    if (chosen.length >= HERO_SIZE) break;
    if (!used.has(String(item.id))) { used.add(String(item.id)); chosen.push({ item, season: null }); }
  }
  return chosen.slice(0, HERO_SIZE);
}
