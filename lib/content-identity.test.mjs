import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeContentTitle, normalizeTmdbId, contentTmdbId, contentYear, isEmptyFilm, sameContent, findContentDuplicate, duplicateErrorMessage } from './content-identity.ts';

test('legacy Vaiana and Spider-Man iframe references identify duplicates without tmdb_id', () => {
  for (const [id, title] of [['1108427', 'Vaiana, la légende du bout du monde'], ['969681', 'Spider-Man : Brand New Day']]) {
    const row = { type: 'movie', title, tmdb_id: null, url: `<iframe src="https://api.moviez.ac/${id}?autoplay=1&amp;color=e8213f"></iframe>` };
    assert.equal(contentTmdbId(row), id);
    assert.equal(sameContent({ type: 'movie', title: '', tmdb_id: id }, row), true);
  }
});

test('legacy stable episode links preserve film/series and remake distinctions', () => {
  assert.equal(contentTmdbId({ type: 'series', embedUrl: '/api/catalogue-player?tmdb=123&type=tv&season=2&episode=3' }), '123');
  assert.equal(contentTmdbId({ type: 'movie', url: 'https://api.moviez.ac/serie/123/1/1' }), '');
  assert.equal(contentTmdbId({ type: 'movie', url: 'https://api.moviez.ac.evil.test/123' }), '');
  assert.equal(sameContent({ type: 'movie', title: 'Dune', tmdb_id: 10 }, { type: 'movie', title: 'Dune', url: 'https://api.moviez.ac/20' }), false);
});

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
test('a remake is another film, even when one side has no identifier', () => {
  const candidate = { title: 'La Belle et la Bête (2017)', type: 'movie', tmdb_id: 321612 };
  assert.equal(sameContent(candidate, { title: 'La Belle et la Bête', type: 'movie', tmdb_id: null, url: '<iframe src="https://api.moviez.ac/197796"></iframe>' }), false);
  assert.equal(sameContent(candidate, { title: 'La Belle et la Bête (1991)', type: 'movie', tmdb_id: null, url: 'https://example.test/film' }), false);
  assert.equal(sameContent(candidate, { title: 'La Belle et la Bête', type: 'movie', release_year: 1991 }), false);
  assert.equal(sameContent(candidate, { title: 'La Belle et la Bête (2017)', type: 'movie', tmdb_id: null, url: 'https://example.test/film' }), true);
  assert.equal(sameContent(candidate, { title: 'La Belle et la Bête', type: 'movie', tmdb_id: null, url: 'https://example.test/film' }), true);
});
test('the year comes from the title first, then from the release year', () => {
  assert.equal(contentYear({ title: 'Dune (2021) ' }), '2021');
  assert.equal(contentYear({ title: 'Dune', release_year: 1984 }), '1984');
  assert.equal(contentYear({ title: '2001 : l’odyssée de l’espace' }), '');
});
test('an empty film card does not count as the film', () => {
  const card = { title: 'La Reine des Neiges', type: 'movie', tmdb_id: null, url: '', embedUrl: '' };
  assert.equal(isEmptyFilm(card), true);
  assert.equal(sameContent({ title: 'La Reine des Neiges (2013)', type: 'movie', tmdb_id: 109445 }, card), false);
  // Series keep their episodes elsewhere and catalogue cards carry no link at all.
  assert.equal(isEmptyFilm({ title: 'Arcane', type: 'series', url: '', embedUrl: '' }), false);
  assert.equal(isEmptyFilm({ title: 'Dune', type: 'movie' }), false);
  // With an identifier it stays that film, so its card can be completed.
  assert.equal(sameContent({ title: 'Bingo (2017)', type: 'movie', tmdb_id: 429210 }, { title: 'Bingo (2017)', type: 'movie', tmdb_id: '429210', url: '', embedUrl: '' }), true);
});
test('the guard can name the row that blocked an addition', () => {
  assert.match(duplicateErrorMessage({ code: '23505', message: 'YF_DUPLICATE_MEDIA: titre', details: 'La Reine des Neiges' }, 'Erreur'), /Fiche existante : « La Reine des Neiges »/);
  assert.doesNotMatch(duplicateErrorMessage({ code: '23505', message: 'private row details', details: 'private' }, 'Erreur'), /private/);
});
test('database duplicate failures produce a clear message without leaking database details', () => {
  assert.match(duplicateErrorMessage({ code: '23505', message: 'private row details' }, 'Erreur'), /Aucun doublon/);
  assert.equal(duplicateErrorMessage({ code: '42501' }, 'Permission refusée'), 'Permission refusée');
});
