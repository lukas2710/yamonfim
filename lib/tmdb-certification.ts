import { isJapaneseAnimation } from './catalogue-categories';

export const KIDS_MAX_AGE = 6;
// Junior is for children under 12: a « -12 » (or 12+) rating never qualifies.
export const JUNIOR_MAX_AGE = 10;
export type FamilyClassification = {
  source: 'tmdb'; checked_at: string; status: 'rated' | 'missing_rating' | 'missing_id' | 'not_found';
  tmdb_id: string; media_type: 'movie' | 'tv'; tmdb_title?: string;
  country: string | null; certification: string | null; min_age: number | null;
  adult: boolean; manual?: boolean;
  // Japanese animation, shown in the Mangas section.
  manga?: boolean;
};
type Rating = { country: string; rating: string };
export function certificationAge(country: string, raw: string): number | null {
  const rating = raw.trim().toUpperCase();
  if (country === 'FR') {
    if (['U', 'TP', 'TOUS PUBLICS'].includes(rating)) return 0;
    if (['10','12','16','18'].includes(rating)) return Number(rating);
  }
  if (country === 'US') return ({ G:0, 'TV-Y':0, 'TV-Y7':7, 'TV-Y7-FV':7, 'TV-G':0, 'PG-13':13, R:17, 'NC-17':18, 'TV-14':14, 'TV-MA':17 } as Record<string, number>)[rating] ?? null;
  if (country === 'GB') return ({ U:0, '12':12, '12A':12, '15':15, '18':18, R18:18 } as Record<string, number>)[rating] ?? null;
  if (country === 'DE') { const match = /^(?:FSK\s*)?(0|6|12|16|18)$/.exec(rating); return match ? Number(match[1]) : null; }
  if (country === 'BE' || country === 'CH') { if (rating === 'AL') return 0; return /^(0|6|7|9|10|12|14|16|18)$/.test(rating) ? Number(rating) : null; }
  if (country === 'CA') return ({G:0,C:0,C8:8,'C8+':8,'14+':14,'18+':18,'18A':18,R:18} as Record<string, number>)[rating] ?? null;
  return null;
}
// No inferred age for PG/TV-PG/NR or for a missing rating. Within one country,
// use the strictest known version; an unrecognised label prevents automatic admission.
export function chooseCertification(ratings: Rating[]): {country: string | null; certification: string | null; min_age: number | null} {
  for (const country of ['FR','BE','CH','US','GB','DE','CA']) {
    const local = ratings.filter(row => row.country === country && row.rating.trim());
    if (!local.length) continue;
    const entries = local.map(row => ({label:row.rating.trim(), age:certificationAge(country,row.rating)}));
    const unknown = entries.find(entry => entry.age === null);
    if (unknown) return {country,certification:unknown.label,min_age:null};
    const strictest = entries.reduce((a,b) => (a.age! >= b.age! ? a : b));
    return {country,certification:strictest.label,min_age:strictest.age};
  }
  return {country:null,certification:null,min_age:null};
}
export function classificationFromTmdb(type: 'movie' | 'tv', id: string, data: Record<string, unknown>, now = new Date().toISOString()): FamilyClassification {
  const ratings: Rating[] = [];
  if (type === 'movie') {
    const groups = (data.release_dates as {results?: {iso_3166_1:string;release_dates?: {certification:string}[]}[]})?.results || [];
    for (const group of groups) for (const release of group.release_dates || []) if (typeof release.certification === 'string') ratings.push({country:group.iso_3166_1,rating:release.certification});
  } else {
    const rows = (data.content_ratings as {results?: {iso_3166_1:string;rating:string}[]})?.results || [];
    for (const row of rows) if (typeof row.rating === 'string') ratings.push({country:row.iso_3166_1,rating:row.rating});
  }
  const selected = chooseCertification(ratings);
  return {source:'tmdb',checked_at:now,status:selected.min_age === null ? 'missing_rating' : 'rated',tmdb_id:id,media_type:type,
    tmdb_title: typeof data.title === 'string' ? data.title : typeof data.name === 'string' ? data.name : '',
    ...selected,adult:data.adult === true,manga:isJapaneseAnimation(data)};
}
export function suggestedAudience(value: FamilyClassification): 'standard' | 'kids' | 'junior' | null {
  if (value.adult) return 'standard';
  if (value.status !== 'rated' || value.min_age === null) return null;
  return value.min_age <= KIDS_MAX_AGE ? 'kids' : value.min_age <= JUNIOR_MAX_AGE ? 'junior' : 'standard';
}
export function needsFamilyReview(item: {audience: string; family_classification?: FamilyClassification | null}) {
  const value = item.family_classification;
  if (value?.manual) return false;
  if (!value) return item.audience === 'standard';
  return suggestedAudience(value) === null;
}
export function classificationLabel(value?: FamilyClassification | null) {
  if (!value) return 'Non analysé';
  if (value.status === 'missing_id') return 'Identifiant TMDB manquant';
  if (value.status === 'not_found') return 'Fiche TMDB introuvable';
  if (value.adult) return 'Contenu adulte signalé par TMDB';
  if (value.min_age === null) return value.certification ? `${value.country} · ${value.certification} · âge non déterminé` : 'Aucune classification d’âge sur TMDB';
  return `${value.country} · ${value.certification} · ${value.min_age === 0 ? 'Tous publics' : value.min_age + ' ans et plus'}`;
}
