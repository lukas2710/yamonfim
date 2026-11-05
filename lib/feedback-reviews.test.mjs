import test from 'node:test';
import assert from 'node:assert/strict';
import { collectVipReviews } from './feedback-reviews.ts';

const at = '2026-11-01T12:00:00Z';
const published = (user_id, rating, comment, created_at = at) => ({ id: 'r-' + user_id, user_id, display_name: 'Membre ' + user_id, rating, comment, created_at });
const collected = (user_id, rating, message = '', created_at = at) => ({ id: 'f-' + user_id + created_at, user_id, rating, message, created_at });

test('a published review keeps its name and its comment', () => {
  const result = collectVipReviews([], [published('public', 3, '  Avis utile,  même mitigé. ')]);
  assert.equal(result.reviews[0].comment, 'Avis utile, même mitigé.');
  assert.equal(result.reviews[0].display_name, 'Membre public');
  assert.equal('user_id' in result.reviews[0], false);
});
test('a review published before the survey existed is still shown', () => {
  const result = collectVipReviews([], [published('ancien', 5, 'Au top depuis le début', '2026-10-21')]);
  assert.deepEqual([result.reviews.length, result.total, result.average], [1, 1, 5]);
});
test('every member appears, without a name when nothing was published', () => {
  const result = collectVipReviews([collected('a', 5, 'TRES BIEN'), collected('b', 4)], []);
  assert.equal(result.reviews.length, 2);
  assert.ok(result.reviews.every(review => review.display_name === 'Membre anonyme'));
  assert.deepEqual(result.reviews.map(review => review.comment).sort(), ['', 'TRES BIEN']);
});
test('a comment long enough to be offered publication stays private unless published', () => {
  const secret = 'Mon paiement a échoué, écris-moi sur moi@example.test';
  const result = collectVipReviews([collected('a', 2, secret)], []);
  assert.deepEqual(result.reviews.map(review => [review.rating, review.comment]), [[2, '']]);
  assert.equal(JSON.stringify(result).includes('example.test'), false);
});
test('a member who answered several times counts once, with their latest rating', () => {
  const result = collectVipReviews([collected('a', 5, '', '2026-10-01'), collected('a', 2, '', '2026-11-01'), collected('b', 4), collected('c', 5)], [published('c', 5, 'Très bien merci'), published('d', 5, 'Parfait pour moi')]);
  assert.equal(result.total, 4);
  assert.equal(result.average, 4);
  assert.deepEqual(result.distribution, [0, 1, 0, 1, 2]);
});
test('the owner is neither a review nor a rating', () => {
  const result = collectVipReviews([collected('owner', 5), collected('a', 3)], [published('owner', 5, 'Meilleur site du monde'), published('a', 3, 'Correct dans l’ensemble')], 'owner');
  assert.equal(result.total, 1);
  assert.equal(result.average, 3);
  assert.deepEqual(result.reviews.map(review => review.display_name), ['Membre a']);
});
test('an invalid rating never counts', () => {
  const result = collectVipReviews([collected('a', 0), collected('b', 6)], [published('c', 9, 'Note hors limites')]);
  assert.deepEqual(result, { reviews: [], total: 0, average: 0, distribution: [0, 0, 0, 0, 0] });
});
test('the newest reviews come first', () => {
  const result = collectVipReviews([], [published('old', 4, 'Ancien avis', '2026-10-01'), published('new', 5, 'Récent avis', '2026-11-01')]);
  assert.deepEqual(result.reviews.map(review => review.comment), ['Récent avis', 'Ancien avis']);
});
