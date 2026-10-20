import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeContentTitle, normalizeTmdbId, sameContent, findContentDuplicate, duplicateErrorMessage } from './content-identity.ts';

test('normalization ignores case, accents, punctuation, spacing and the appended release year', () => {
  assert.equal(normalizeContentTitle('  L’ÉTÉ : Retrouvailles (2026) '), 'l ete retrouvailles');
  assert.equal(normalizeContentTitle('Le Cœur'), 'le coeur');
  assert.equal(normalizeContentTitle('進撃の巨人'), '進撃の巨人');
});
test('TMDB identifiers match despite translated titles and numeric/string representation', () => {
  assert.equal(sameContent({ title: 'Le Retour', type: 'movie', tmdb_id: 123 }, { title: 'The Return (2026)', type: 'movie', tmdb_id: '00123' }), true);
  assert.equal(normalizeTmdbId(' 000123 '), '123');
  for (const value of ['', null, undefined, 'invalid', '0', 0]) assert.equal(normalizeTmdbId(value), '');
});
test('a movie and a series may have the same TMDB number without being duplicates', () => {
  assert.equal(sameContent({ title: 'Example', type: 'movie', tmdb_id: 123 }, { title: 'Example', type: 'series', tmdb_id: 123 }), false);
});
test('distinct verified TMDB IDs allow legitimate remakes with the same title', () => {
  assert.equal(sameContent({ title: 'Dune', type: 'movie', tmdb_id: 10 }, { title: 'Dune', type: 'movie', tmdb_id: 20 }), false);
});
test('manual requests without an identifier still match catalogue titles with appended years', () => {
  assert.equal(sameContent({ title: 'Une SÉRIE !', type: 'series' }, { title: 'Une série (2026)', type: 'series', tmdb_id: 30 }), true);
});
test('editing a record excludes itself but still detects another conflicting record', () => {
  const rows = [{ id: 1, title: 'First', type: 'movie', tmdb_id: 10 }, { id: 2, title: 'Second', type: 'movie', tmdb_id: 20 }];
  assert.equal(findContentDuplicate(rows[0], rows, '1'), null);
  assert.equal(findContentDuplicate({ ...rows[1], id: 1 }, rows, 1)?.id, 2);
});
test('empty or punctuation-only titles never match each other', () => {
  assert.equal(sameContent({ title: '?!', type: 'movie' }, { title: '', type: 'movie' }), false);
});
test('known pending requests are detected across numeric and string identifiers', () => {
  const rows = [{ id: 'request', title: 'Film original', type: 'movie', tmdb_id: '40', status: 'en_cours' }];
  assert.equal(findContentDuplicate({ title: 'Titre traduit', type: 'movie', tmdb_id: 40 }, rows)?.id, 'request');
});
test('database duplicate failures produce a clear message without leaking database details', () => {
  assert.match(duplicateErrorMessage({ code: '23505', message: 'private row details' }, 'Erreur'), /Aucun doublon/);
  assert.equal(duplicateErrorMessage({ code: '42501' }, 'Permission refusée'), 'Permission refusée');
});
