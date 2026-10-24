import test from 'node:test';
import assert from 'node:assert/strict';
import { createSearchMatcher, searchQueryVariants } from './search.ts';
test('search ignores accents case apostrophes spaces and punctuation',()=>{
 assert.equal(createSearchMatcher('  le seigneur DES anneaux ')('Le Seigneur des Anneaux : Les Deux Tours'),true);
 assert.equal(createSearchMatcher('l ete')('L’été'),true);
 assert.equal(createSearchMatcher('oeuvre')('L’Œuvre'),true);
});
test('extra plural s and one typo in a long word still find a title',()=>{
 assert.equal(createSearchMatcher('strangers things')('Stranger Things'),true);
 assert.equal(createSearchMatcher('harrys poter')('Harry Potter'),true);
 assert.equal(createSearchMatcher('etoiles')('Étoile'),true);
});
test('query words may be reordered without dropping meaningful words',()=>{
 assert.equal(createSearchMatcher('potter harry')('Harry Potter et la Coupe de feu'),true);
 assert.equal(createSearchMatcher('harry dune')('Harry Potter'),false);
});
test('numbers and short unrelated titles are not fuzzy matches',()=>{
 assert.equal(createSearchMatcher('saw 2')('Saw 3'),false);
 assert.equal(createSearchMatcher('dune')('Dame'),false);
 assert.equal(createSearchMatcher('')('Tout'),true);
});

test('remote searches can retry a normalized query and a singular variant',()=>{
 assert.deepEqual(searchQueryVariants('Étoiles'),['Étoiles','etoiles','etoile']);
 assert.deepEqual(searchQueryVariants('Dune'),['Dune','dune']);
});
