export function normalizeSearch(value: string) {
  return value.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/œ/g, 'oe').replace(/æ/g, 'ae').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}
const STOP_WORDS = new Set(['le','la','les','l','de','des','du','un','une','the','et','and','a','of']);
function singular(word: string) { return word.length > 3 && !word.endsWith('ss') ? word.replace(/s$/, '') : word; }
function words(text: string) { return text ? text.split(' ').map(singular) : []; }

/** Optimal string alignment distance, stopped as soon as it exceeds `max`. */
function editDistance(a: string, b: string, max: number) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev2: number[] = [], prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let d = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d = Math.min(d, prev2[j - 2] + 1);
      row.push(d);
      if (d < best) best = d;
    }
    if (best > max) return max + 1;
    prev2 = prev; prev = row;
  }
  return prev[b.length];
}
const allowedEdits = (needle: string) => needle.length >= 8 ? 2 : needle.length >= 5 ? 1 : 0;

/** How well one query word matches one title word: 4 exact, 3 start, 2 inside, 1.5 or 1 for one or two typos, 0 none. */
function wordMatch(needle: string, word: string, loose: boolean) {
  if (word === needle) return 4;
  if (/^\d+$/.test(needle)) return 0;
  if (word.startsWith(needle)) return 3;
  if (!loose) return 0;
  if (needle.length >= 3 && word.includes(needle)) return 2;
  const edits = allowedEdits(needle);
  // Typos almost never hit both first letters: skipping those keeps typing fluid on big catalogues.
  if (!edits || (word[0] !== needle[0] && word[1] !== needle[1])) return 0;
  // A word being typed: compare with the start of the longer title word too.
  let d = editDistance(needle, word, edits);
  if (d > edits && word.length > needle.length) d = editDistance(needle, word.slice(0, needle.length), edits);
  return d > edits ? 0 : d === 1 ? 1.5 : 1;
}
function bestMatch(needle: string, list: string[], loose: boolean) {
  let best = 0;
  for (const word of list) { const m = wordMatch(needle, word, loose); if (m > best) best = m; if (best === 4) break; }
  return best;
}

export type SearchEntry = { title: string; base: string; compact: string; titleWords: string[]; extraWords: string[] };
/** Pre-normalized text of an item, built once so typing stays fluid on large catalogues. */
export function indexSearch(title: string | null | undefined, ...extra: (string | null | undefined)[]): SearchEntry {
  const t = normalizeSearch(title ?? '');
  // « Dune (2021) » is still the exact title « Dune ».
  return { title: t, base: t.replace(/ (18|19|20)\d\d$/, ''), compact: t.replace(/ /g, ''), titleWords: words(t), extraWords: words(normalizeSearch(extra.filter(Boolean).join(' '))) };
}

/**
 * Scores an indexed item for a query (0 = no match). The title always wins over the synopsis:
 * exact title, then title start, whole phrase, every word in the title, and only then the description and genres.
 */
export function createSearchRanker(query: string) {
  const normalized = normalizeSearch(query);
  const compact = normalized.replace(/ /g, '');
  const all = normalized ? normalized.split(' ') : [];
  const meaningful = all.filter(word => !STOP_WORDS.has(word));
  const needles = (meaningful.length ? meaningful : all).map(singular);
  return (entry: SearchEntry) => {
    if (!normalized) return 1;
    const t = entry.title, longer = Math.min(t.length - normalized.length, 49);
    if (entry.base === normalized || t === normalized) return 1000;
    if ((t + ' ').startsWith(normalized + ' ')) return 950 - longer;
    if ((' ' + t + ' ').includes(' ' + normalized + ' ')) return 900 - longer;
    if (t.startsWith(normalized)) return 850 - longer;
    if ((' ' + t).includes(' ' + normalized)) return 800 - longer;
    if (compact.length >= 3 && entry.compact.includes(compact)) return 700 - Math.min(entry.compact.length - compact.length, 49);
    let inTitle = 0, everywhere = 0, titleOnly = true;
    for (const needle of needles) {
      const m = bestMatch(needle, entry.titleWords, true);
      if (m) { inTitle += m; everywhere += m; continue; }
      titleOnly = false;
      // The synopsis is long: only whole words or word starts count there, never typos.
      const e = needle.length >= 3 || /^\d+$/.test(needle) ? bestMatch(needle, entry.extraWords, false) : 0;
      if (!e) return 0;
      everywhere += e;
    }
    // Same words found: the shorter title is the closer one (« Breaking Bad » before « El Camino : Un film Breaking Bad »).
    return titleOnly ? 300 + Math.round(inTitle / needles.length * 90) - Math.min(entry.titleWords.length - needles.length, 10) :100 + Math.round(everywhere / needles.length * 20);
  };
}

/** Matching items, best first; ties keep the catalogue order. */
export function rankSearch<T>(items: T[], query: string, entryOf: (item: T) => SearchEntry) {
  if (!normalizeSearch(query)) return items;
  const rank = createSearchRanker(query);
  const scored: { item: T; score: number; order: number }[] = [];
  items.forEach((item, order) => { const score = rank(entryOf(item)); if (score > 0) scored.push({ item, score, order }); });
  return scored.sort((a, b) => b.score - a.score || a.order - b.order).map(s => s.item);
}

export function createSearchMatcher(query: string) {
  const rank = createSearchRanker(query);
  return (...values: (string | null | undefined)[]) => rank(indexSearch(values.filter(Boolean).join(' '))) > 0;
}

export function searchQueryVariants(query: string) {
  const normalized = normalizeSearch(query);
  return [...new Set([query.trim(), normalized, normalized.split(' ').map(singular).join(' ')])].filter(Boolean);
}
