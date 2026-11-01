import test from 'node:test';
import assert from 'node:assert/strict';
import { collectVipReviews } from './feedback-reviews.ts';

const at = '2026-11-01T12:00:00Z';
test('only nonempty collected comments with matching publication consent appear', () => {
  const feedback = [
    { id: 'private', user_id: 'private', rating: 5, message: 'Commentaire privé et long', created_at: at },
    { id: 'stars', user_id: 'stars', rating: 5, message: '   ', created_at: at },
    { id: 'public', user_id: 'public', rating: 3, message: '  Avis utile, même mitigé. ', created_at: at },
    { id: 'mismatch', user_id: 'mismatch', rating: 4, message: 'Texte collecté différent', created_at: at },
  ];
  const publications = [
    { user_id: 'stars', display_name: 'Étoiles', rating: 5, comment: '   ' },
    { user_id: 'public', display_name: 'Alice', rating: 3, comment: 'Avis utile, même mitigé.' },
    { user_id: 'mismatch', display_name: 'Bob', rating: 4, comment: 'Autre texte publié.' },
  ];
  const result = collectVipReviews(feedback, publications);
  assert.equal(result.total, 1);
  assert.equal(result.average, 3);
  assert.equal(result.reviews[0].comment, 'Avis utile, même mitigé.');
  assert.equal(result.reviews[0].display_name, 'Alice');
  assert.equal('user_id' in result.reviews[0], false);
});

test('the latest matching comment per member supplies the rating summary', () => {
  const feedback = [
    { id: 'old', user_id: 'u', rating: 5, message: 'Ancien avis conservé', created_at: '2026-10-01' },
    { id: 'new', user_id: 'u', rating: 2, message: 'Nouvel avis modifié', created_at: '2026-11-01' },
  ];
  const publications = [{ user_id: 'u', display_name: 'Membre', rating: 2, comment: 'Nouvel avis modifié' }];
  const result = collectVipReviews(feedback, publications);
  assert.equal(result.total, 1);
  assert.equal(result.average, 2);
  assert.equal(result.reviews[0].id, 'new');
});
