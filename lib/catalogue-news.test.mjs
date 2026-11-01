import test from 'node:test';
import assert from 'node:assert/strict';
import { seriesNewsEntry } from './catalogue-news.ts';
const seasons = [{ seasonNumber: 1, episodes: [{ number: 1 }, { number: 2 }] }, { seasonNumber: 2, episodes: [{ number: 1 }, { number: 2 }, { number: 3 }] }];
test('an aired episode the site already lists is news without missing episodes', () => {
  assert.deepEqual(seriesNewsEntry(seasons, { season_number: 2, episode_number: 2, air_date: '2026-10-30' }, '2026-10-01', '2026-10-25'), { season: 2, episode: 2, airDate: '2026-10-30', newSeason: false, missingFrom: null });
});
test('a season premiere absent from the site is a new season missing from episode 1', () => {
  assert.deepEqual(seriesNewsEntry(seasons, { season_number: 3, episode_number: 1, air_date: '2026-10-30' }, '2026-10-30', '2026-10-25'), { season: 3, episode: 1, airDate: '2026-10-30', newSeason: true, missingFrom: 1 });
  assert.equal(seriesNewsEntry(seasons, { season_number: 2, episode_number: 5, air_date: '2026-10-30' }, '2026-10-26', '2026-10-25').missingFrom, 4);
});
test('episodes aired before the window or malformed data are ignored', () => {
  assert.equal(seriesNewsEntry(seasons, { season_number: 2, episode_number: 3, air_date: '2026-10-01' }, '2026-09-01', '2026-10-25'), null);
  assert.equal(seriesNewsEntry(seasons, null, null, '2026-10-25'), null);
  assert.equal(seriesNewsEntry(seasons, { season_number: 0, episode_number: 1, air_date: '2026-10-30' }, null, '2026-10-25'), null);
});
