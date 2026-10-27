import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSeriesParts, displayToStored, storedToDisplay, remapWatchedKey } from './series-parts.ts';
const original = { title: 'Lupin', tmdb_id: '96677', seasons: [10, 7, 8].map((count, s) => ({ seasonNumber: s + 1, episodes: Array.from({ length: count }, (_, e) => ({ number: e + 1, embedUrl: `source-${s}-${e}` })) })) };
test('Lupin shows four parts without changing any episode source', () => {
  const corrected = normalizeSeriesParts(original);
  assert.deepEqual(corrected.seasons.map(season => season.episodes.length), [5, 5, 7, 8]);
  assert.deepEqual(corrected.seasons.flatMap(season => season.episodes.map(episode => episode.embedUrl)), original.seasons.flatMap(season => season.episodes.map(episode => episode.embedUrl)));
  assert.deepEqual(normalizeSeriesParts(corrected), corrected);
  assert.equal(normalizeSeriesParts({ ...original, title: 'Other', tmdb_id: '12' }).seasons.length, 3);
});
test('resume and watched markers keep the same canonical episode across all 25 episodes', () => {
  const corrected = normalizeSeriesParts(original);
  corrected.seasons.forEach((season, s) => season.episodes.forEach((_, e) => {
    const stored = displayToStored(corrected, s, e);
    assert.deepEqual(storedToDisplay(corrected, stored.s, stored.e), { s, e });
    const key = `s${s}_e${e}`;
    assert.equal(remapWatchedKey(corrected, remapWatchedKey(corrected, key, 'stored'), 'display'), key);
  }));
  assert.deepEqual(storedToDisplay(corrected, 0, 5), { s: 1, e: 0 });
  assert.deepEqual(storedToDisplay(corrected, 2, 0), { s: 3, e: 0 });
});
