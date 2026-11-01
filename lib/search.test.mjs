import test from 'node:test';
import assert from 'node:assert/strict';
import { createSearchMatcher, createSearchRanker, indexSearch, rankSearch, searchQueryVariants } from './search.ts';
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

test('titles are ranked before synopsis matches and exact titles come first',()=>{
 const items=[
  {title:'La Planète des singes',description:'Un astronaute découvre une planète dominée par des singes.'},
  {title:'Avatar : La Voie de l’eau',description:'Jake Sully vit avec sa nouvelle famille.'},
  {title:'Le Dernier Maître de l’air',description:'Aang est le dernier avatar.'},
  {title:'Avatar',description:'Sur Pandora.'},
 ];
 assert.deepEqual(rankSearch(items,'avatar',i=>indexSearch(i.title,i.description)).map(i=>i.title),['Avatar','Avatar : La Voie de l’eau','Le Dernier Maître de l’air']);
});
test('synopsis words only match whole words or word starts, never inside words',()=>{
 const entry=indexSearch('Titre sans rapport','Un million de dollars.');
 assert.equal(createSearchRanker('lion')(entry),0);
 assert.ok(createSearchRanker('dollar')(entry)>0);
});
test('joined words, swapped letters, unfinished words and longer typos still find a title',()=>{
 assert.equal(createSearchMatcher('spiderman')('Spider-Man : No Way Home'),true);
 assert.equal(createSearchMatcher('spider man')('Spiderman'),true);
 assert.equal(createSearchMatcher('intesrtellar')('Interstellar'),true);
 assert.equal(createSearchMatcher('interstelar')('Interstellar'),true);
 assert.equal(createSearchMatcher('interstle')('Interstellar'),true);
 assert.equal(createSearchMatcher('casa de papeel')('La Casa de Papel'),true);
 assert.equal(createSearchMatcher('aventure')('Avatar'),false);
});
test('an empty query keeps every item in its order',()=>{
 assert.deepEqual(rankSearch(['b','a'],'  ',i=>indexSearch(i)),['b','a']);
});
test('a release year in the title, whole words, single typos and short titles rank first',()=>{
 const score=(q,t)=>createSearchRanker(q)(indexSearch(t));
 assert.equal(score('dune','Dune (2021)'),1000);
 assert.ok(score('interstelar','Interstellar (2014)')>score('interstelar','Interstella 5555 (2003)'));
 assert.ok(score('lion','Le Roi lion')>score('lion','Lioness (2023)'));
 assert.ok(score('breking bad','Breaking Bad')>score('breking bad','El Camino : Un film "Breaking Bad" (2019)'));
});
