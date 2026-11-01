import test from 'node:test';
import assert from 'node:assert/strict';
import { personalizedRecommendations } from './recommendations.ts';
const now = Date.parse('2026-11-01T12:00:00Z');
const title = (id, genre, type = 'movie') => ({ id, type, genres: [genre] });
const watched = (media_id, extra = {}) => ({ media_id, current_time: 3000, duration: 3600, updated_at: new Date(now).toISOString(), ...extra });
test('uses the supplied profile history and excludes watched titles', () => {
  const catalogue = [title('a', 'Action'), title('b', 'Romance'), title('c', 'Action'), title('d', 'Romance')];
  assert.deepEqual(personalizedRecommendations(catalogue, [watched('a')], 20, now).map(item => item.id), ['c']);
  assert.deepEqual(personalizedRecommendations(catalogue, [watched('b')], 20, now).map(item => item.id), ['d']);
});
test('does not infer tastes from a briefly opened video or invent personal picks without history', () => {
  const catalogue = [title('a', 'Action'), title('b', 'Action')];
  assert.deepEqual(personalizedRecommendations(catalogue, [], 20, now), []);
  assert.deepEqual(personalizedRecommendations(catalogue, [watched('a', { current_time: 10 })], 20, now), []);
});
test('recent engaged viewing outweighs old viewing and recommends both formats', () => {
  const catalogue = [title('a', 'Action'), title('r', 'Romance'), title('b', 'Action', 'series'), title('c', 'Romance')];
  const result = personalizedRecommendations(catalogue, [watched('a'), watched('r', { updated_at: '2020-01-01' })], 20, now);
  assert.deepEqual(result.map(item => item.id), ['b', 'c']);
});
test('repeated episode records do not drown out another watched title', () => {
  const catalogue = [title('a', 'Action'), title('r', 'Romance'), title('b', 'Action'), title('c', 'Romance')];
  const history = [watched('a'), watched('r')];
  assert.deepEqual(personalizedRecommendations(catalogue, history, 20, now), personalizedRecommendations(catalogue, [...history, ...Array(30).fill(watched('r'))], 20, now));
});
test('normalizes genre accents and limits the result', () => {
  const catalogue = [title('a', 'Comédie'), title('b', 'comedie'), title('c', 'Comédie')];
  assert.deepEqual(personalizedRecommendations(catalogue, [watched('a')], 1, now).map(item => item.id), ['b']);
});
