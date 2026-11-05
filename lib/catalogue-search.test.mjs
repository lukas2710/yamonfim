import test from 'node:test';
import assert from 'node:assert/strict';
import { searchCatalogueDatabase, titlePattern, tmdbTitles } from './catalogue-search.ts';

function client(rows) {
  const asked = [];
  const query = result => ({ limit: () => ({ abortSignal: async () => ({ data: result }) }) });
  return { asked, from: () => ({ select: () => ({
    in: (column, ids) => { asked.push(['in', ids]); return query(rows.filter(row => ids.includes(String(row.tmdb_id)))); },
    ilike: (column, pattern) => { asked.push(['ilike', pattern]); return query(rows.filter(row => new RegExp(pattern.replaceAll('%', '.*'), 'i').test(row.title))); },
  }) }) };
}
const answer = results => { globalThis.fetch = async () => Response.json({ results }); };
const signal = new AbortController().signal;

test('punctuation and spaces never split a title', () => {
  assert.equal(titlePattern('Spider-Man  : No Way'), '%Spider%Man%No%Way%');
  assert.equal(titlePattern('  ...  '), '');
});
test('only films and series come back from TMDB', () => {
  assert.deepEqual(tmdbTitles([{ id: 1, media_type: 'movie' }, { id: 2, media_type: 'tv' }, { id: 3, media_type: 'person' }]), [{ id: '1', type: 'movie' }, { id: '2', type: 'series' }]);
});
test('a title searched in another language is found by its number, as in the admin form', async () => {
  answer([{ id: 129, media_type: 'movie' }]);
  const rows = await searchCatalogueDatabase(client([{ id: 7, title: 'Le Voyage de Chihiro (2001)', type: 'movie', tmdb_id: '129' }]), 'Spirited Away', signal);
  assert.deepEqual(rows.map(row => row.id), [7]);
});
test('a film and a series sharing a number are not mixed up', async () => {
  answer([{ id: 129, media_type: 'tv' }]);
  const rows = await searchCatalogueDatabase(client([{ id: 7, title: 'Autre', type: 'movie', tmdb_id: '129' }, { id: 8, title: 'Série', type: 'series', tmdb_id: '129' }]), 'quelque chose', signal);
  assert.deepEqual(rows.map(row => row.id), [8]);
});
test('a title found both ways appears once, in the order TMDB gives', async () => {
  answer([{ id: 2, media_type: 'movie' }, { id: 1, media_type: 'movie' }]);
  const rows = await searchCatalogueDatabase(client([{ id: 7, title: 'Dune', type: 'movie', tmdb_id: '1' }, { id: 8, title: 'Dune deux', type: 'movie', tmdb_id: '2' }]), 'dune', signal);
  assert.deepEqual(rows.map(row => row.id), [8, 7]);
});
test('without TMDB the title search still answers', async () => {
  globalThis.fetch = async () => { throw new Error('offline'); };
  const api = client([{ id: 7, title: 'Le Roi Lion', type: 'movie', tmdb_id: null }]);
  assert.deepEqual((await searchCatalogueDatabase(api, 'roi lion', signal)).map(row => row.id), [7]);
  assert.deepEqual(api.asked, [['ilike', '%roi%lion%']]);
});
