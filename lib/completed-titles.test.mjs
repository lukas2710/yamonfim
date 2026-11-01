import test from 'node:test';
import assert from 'node:assert/strict';
import { completedTitles } from './completed-titles.ts';
const items = [{ id: 'm', type: 'movie' }, { id: 's', type: 'series' }];
const at = '2026-11-01T12:00:00Z';
test('a film needs completed progress rather than a briefly started playback', () => {
  const seen = [{ media_id: 'm', ep_key: 'movie_main', watched_at: '2026-11-01T11:59:00Z' }];
  assert.equal(completedTitles(items, seen, [{ media_id: 'm', current_time: 5, duration: 100, updated_at: at }], {}).has('m'), false);
  assert.equal(completedTitles(items, seen, [{ media_id: 'm', current_time: 95, duration: 100, updated_at: at }], {}).has('m'), true);
});
test('every real episode is required to mark a series complete', () => {
  const required = { s: ['s0_e0', 's0_e1'] }, seen = [{ media_id: 's', ep_key: 's0_e0', watched_at: at }];
  assert.equal(completedTitles(items, seen, [], required).has('s'), false);
  assert.equal(completedTitles(items, [...seen, { media_id: 's', ep_key: 's0_e1', watched_at: at }], [], required).has('s'), true);
  assert.equal(completedTitles(items, seen, [], {}).has('s'), false);
});
test('an ongoing last episode prevents a complete badge, manual seen after progress is respected', () => {
  const seen = [{ media_id: 's', ep_key: 's0_e0', watched_at: at }], required = { s: ['s0_e0'] };
  assert.equal(completedTitles(items, seen, [{ media_id: 's', current_time: 5, duration: 100, updated_at: '2026-11-01T12:01:00Z' }], required).has('s'), false);
  assert.equal(completedTitles(items, seen, [{ media_id: 's', current_time: 5, duration: 100, updated_at: '2026-11-01T11:59:00Z' }], required).has('s'), true);
});
test('another profile with empty viewing data gets no badges', () => {
  assert.equal(completedTitles(items, [], [], { s: ['s0_e0'] }).size, 0);
});
