import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHeroSetting, pickHeroItems, DEFAULT_HERO } from './home-hero.ts';

const catalogue = [1, 2, 3, 4, 5, 6, 7].map(id => ({ id }));

test('missing or invalid setting falls back to the latest additions', () => {
  assert.deepEqual(parseHeroSetting(null), DEFAULT_HERO);
  assert.deepEqual(parseHeroSetting({ mode: 'weird', days: 12 }), DEFAULT_HERO);
});

test('custom setting keeps at most five ids, as strings', () => {
  assert.deepEqual(parseHeroSetting({ mode: 'custom', media_ids: [7, '6', 5, 4, 3, 2], days: 7 }), { mode: 'custom', media_ids: ['7', '6', '5', '4', '3'], days: 7 });
});

const ids = picks => picks.map(p => p.item.id);
test('chosen titles keep their order and gaps are filled with the latest additions', () => {
  assert.deepEqual(ids(pickHeroItems(catalogue, ['6', '99', '2'])), [6, 2, 1, 3, 4]);
  assert.deepEqual(ids(pickHeroItems(catalogue, [])), [1, 2, 3, 4, 5]);
  assert.deepEqual(ids(pickHeroItems(catalogue.slice(0, 2), ['2'])), [2, 1]);
});

test('a slot can promote one season of a series, without repeating the series', () => {
  const picks = pickHeroItems(catalogue, ['3:s2', '3', '1']);
  assert.deepEqual(picks.slice(0, 2), [{ item: { id: 3 }, season: 2 }, { item: { id: 1 }, season: null }]);
  assert.deepEqual(ids(picks), [3, 1, 2, 4, 5]);
});
