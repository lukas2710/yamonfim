import test from 'node:test';
import assert from 'node:assert/strict';
import { suggestedAudience, classificationFromTmdb } from './tmdb-certification.ts';

const rated = (country, rating) => classificationFromTmdb('tv', '1', { content_ratings: { results: [{ iso_3166_1: country, rating }] } });

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
