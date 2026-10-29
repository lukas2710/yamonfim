import test from 'node:test';
import assert from 'node:assert/strict';
import { suggestedAudience, classificationFromTmdb } from './tmdb-certification.ts';

const rated = (country, rating, genres = [{ id: 10762 }]) => classificationFromTmdb('tv', '1', { genres, content_ratings: { results: [{ iso_3166_1: country, rating }] } });

test('a « Tous publics » rating alone never reaches Kids or Junior', () => {
  assert.equal(suggestedAudience(rated('FR', 'TP', [{ id: 18 }])), 'standard');
  assert.equal(suggestedAudience(rated('FR', '10', [])), 'standard');
  assert.equal(suggestedAudience(rated('FR', 'TP', [{ id: 16 }])), 'kids');
  assert.equal(suggestedAudience(rated('FR', 'TP', [{ id: 10751 }, { id: 35 }])), 'kids');
  // A Japanese anime needs Family or Kids too: « Tous publics » adult mangas exist.
  const anime = genres => classificationFromTmdb('tv', '1', { genres, original_language: 'ja', content_ratings: { results: [{ iso_3166_1: 'FR', rating: 'TP' }] } });
  assert.equal(suggestedAudience(anime([{ id: 16 }, { id: 18 }])), 'standard');
  assert.equal(suggestedAudience(anime([{ id: 16 }, { id: 10762 }])), 'kids');
});

test('Kids holds titles for all ages or 6+, Junior stops before any 12+ rating', () => {
  assert.equal(suggestedAudience(rated('FR', 'TP')), 'kids');
  assert.equal(suggestedAudience(rated('DE', '6')), 'kids');
  assert.equal(suggestedAudience(rated('US', 'TV-Y7')), 'junior');
  assert.equal(suggestedAudience(rated('FR', '10')), 'junior');
  // « -12 » means forbidden under 12: Chucky (FR 12) must not reach children.
  assert.equal(suggestedAudience(rated('FR', '12')), 'standard');
  assert.equal(suggestedAudience(rated('GB', '12A')), 'standard');
  assert.equal(suggestedAudience(rated('US', 'TV-14')), 'standard');
  assert.equal(suggestedAudience(rated('FR', '16')), 'standard');
});
