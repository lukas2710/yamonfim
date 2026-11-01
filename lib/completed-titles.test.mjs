import test from 'node:test';
import assert from 'node:assert/strict';
import { completedTitles, fetchSeriesEpisodeKeys } from './completed-titles.ts';
const items = [{ id: 'm', type: 'movie' }, { id: 's', type: 'series' }];
const at = '2026-11-01T12:00:00Z';
test('a movie badge follows its explicit seen flag, not a brief playback position', () => {
  assert.equal(completedTitles(items, [], [{ media_id: 'm', current_time: 5, duration: 100, updated_at: at }], {}).has('m'), false);
  assert.equal(completedTitles(items, [{ media_id: 'm', ep_key: 'movie_main' }], [], {}).has('m'), true);
});
test('every real episode is required to mark a series complete', () => {
  const required = { s: ['s0_e0', 's0_e1'] }, seen = [{ media_id: 's', ep_key: 's0_e0', watched_at: at }];
  assert.equal(completedTitles(items, seen, [], required).has('s'), false);
  assert.equal(completedTitles(items, [...seen, { media_id: 's', ep_key: 's0_e1', watched_at: at }], [], required).has('s'), true);
  assert.equal(completedTitles(items, seen, [], {}).has('s'), false);
});
test('all episode seen flags keep the series badge despite an older resume position', () => {
  const seen = [{ media_id: 's', ep_key: 's0_e0', watched_at: at }], required = { s: ['s0_e0'] };
  assert.equal(completedTitles(items, seen, [{ media_id: 's', current_time: 5, duration: 100, updated_at: '2026-11-01T12:01:00Z' }], required).has('s'), true);
  assert.equal(completedTitles(items, seen, [{ media_id: 's', current_time: 5, duration: 100, updated_at: '2026-11-01T11:59:00Z' }], required).has('s'), true);
});
test('a newly added unseen episode removes the complete series badge', () => {
  const seen = [{ media_id: 's', ep_key: 's0_e0', watched_at: at }];
  assert.equal(completedTitles(items, seen, [], { s: ['s0_e0'] }).has('s'), true);
  assert.equal(completedTitles(items, seen, [], { s: ['s0_e0', 's0_e1'] }).has('s'), false);
});
test('Lupin keeps its green badge when legacy split-season episode keys were saved', () => {
  const legacy = [
    ...Array.from({ length: 5 }, (_, episode) => ({ media_id: 's', ep_key: `s0_e${episode}` })),
    ...Array.from({ length: 5 }, (_, episode) => ({ media_id: 's', ep_key: `s1_e${episode}` })),
  ];
  assert.equal(completedTitles(items, legacy, [], { s: Array.from({ length: 10 }, (_, episode) => `s0_e${episode}`) }).has('s'), true);
  assert.equal(completedTitles(items, legacy.slice(0, 9), [], { s: Array.from({ length: 10 }, (_, episode) => `s0_e${episode}`) }).has('s'), false);
});
test('one failing series cannot hide badges for successful series', async t => {
  const original = globalThis.fetch; t.after(() => { globalThis.fetch = original; });
  globalThis.fetch = async url => {
    const ids = new URL(url, 'https://local.test').searchParams.get('ids').split(',');
    if (ids.includes('broken')) return new Response('', { status: 503 });
    return Response.json(Object.fromEntries(ids.map(id => [id, ['s0_e0']])));
  };
  const partial = [];
  const result = await fetchSeriesEpisodeKeys(['a', 'broken', 'b'], undefined, keys => partial.push(Object.keys(keys)));
  assert.deepEqual(result, { a: ['s0_e0'], b: ['s0_e0'] });
  assert.deepEqual(partial[0], ['a']);
});
test('another profile with empty viewing data gets no badges', () => {
  assert.equal(completedTitles(items, [], [], { s: ['s0_e0'] }).size, 0);
});
test('in-progress state includes started history and seen episodes, but never completed titles', async () => {
  const { inProgressTitles } = await import('./completed-titles.ts');
  const result = inProgressTitles([{ media_id: 'a', ep_key: 's0_e0' }], [{ media_id: 'b', current_time: 20 }], new Set(['a']));
  assert.deepEqual([...result], ['b']);
});
