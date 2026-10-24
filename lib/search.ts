export function normalizeSearch(value: string) {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/œ/g, 'oe').replace(/æ/g, 'ae').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}
function singular(word: string) { return word.length > 3 && !word.endsWith('ss') ? word.replace(/s$/, '') : word; }
function oneEdit(a: string, b: string) {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length >= b.length) i++;
    if (b.length >= a.length) j++;
  }
  return edits + Number(i < a.length || j < b.length) <= 1;
}
export function createSearchMatcher(query: string) {
  const normalized = normalizeSearch(query);
  const all = normalized.split(' ').filter(Boolean);
  const meaningful = all.filter(word => !['le','la','les','l','de','des','du','un','une','the','et','and'].includes(word));
  const needles = (meaningful.length ? meaningful : all).map(singular);
  return (...values: (string | null | undefined)[]) => {
    if (!normalized) return true;
    const text = normalizeSearch(values.filter(Boolean).join(' '));
    if (text.includes(normalized)) return true;
    const words = text.split(' ').map(singular);
    return needles.every(needle => words.some(word => word === needle || (!/^\d+$/.test(needle) && (word.includes(needle) || (needle.length >= 5 && word.length >= 5 && oneEdit(needle, word))))));
  };
}

export function searchQueryVariants(query: string) {
  const normalized = normalizeSearch(query);
  return [...new Set([query.trim(), normalized, normalized.split(' ').map(singular).join(' ')])].filter(Boolean);
}
