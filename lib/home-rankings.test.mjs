import test from 'node:test';
import assert from 'node:assert/strict';
import { bestRated, weeklyTrending } from './home-rankings.ts';
const items = [{ id: 'a', type: 'movie', tmdb_id: 1 }, { id: 'b', type: 'movie', tmdb_id: 2 }, { id: 'c', type: 'series', tmdb_id: 1 }, { id: 'd', type: 'movie', tmdb_id: 3 }, { id: 'e', type: 'movie', tmdb_id: 4 }];
const rankings = { at: 0, ratings: { 'movie:1': { rating: 8, votes: 1000 }, 'movie:2': { rating: 9, votes: 2 }, 'tv:1': { rating: 8.5, votes: 200 }, 'movie:3': { rating: 8, votes: 2000 } }, trending: { movie: ['3', '1', '999'], series: ['1'] } };
test('orders verified ratings, checks enough votes and keeps movie/TV identities separate', () => {
  assert.deepEqual(bestRated(items, rankings).map(item => item.id), ['c', 'd', 'a']);
});
test('weekly trends follow TMDB order and show only available titles of the right type', () => {
  assert.deepEqual(weeklyTrending(items, rankings, 'movie').map(item => item.id), ['d', 'a']);
  assert.deepEqual(weeklyTrending(items, rankings, 'series').map(item => item.id), ['c']);
});
test('missing provider data never produces fake top-rated lists', () => {
  assert.deepEqual(bestRated(items, null), []);
  assert.deepEqual(weeklyTrending(items, null, 'movie'), []);
});
