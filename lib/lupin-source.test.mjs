import test from 'node:test';
import assert from 'node:assert/strict';
import { catalogueSource, cataloguePlayer, primaryEmbed } from './catalogue-source.ts';
import { normalizeSeriesParts, displayToStored } from './series-parts.ts';
test('all 25 displayed Lupin chapters reach the correct Moviez part and retain TMDB history coordinates', () => {
  const stored = { title: 'Lupin', tmdb_id: '96677', seasons: [10,7,8].map((n,s)=>({seasonNumber:s+1,episodes:Array.from({length:n},(_,e)=>({number:e+1,embedUrl:cataloguePlayer({id:'96677',type:'tv',season:s+1,episode:e+1})}))})) };
  const displayed = normalizeSeriesParts(stored);
  const urls = new Set();
  displayed.seasons.forEach((part,s)=>part.episodes.forEach((ep,e)=>{
    const source = catalogueSource(ep.embedUrl);
    const url = primaryEmbed(source);
    assert.equal(url, `https://api.moviez.ac/serie/96677/${s+1}/${e+1}`);
    const history=displayToStored(displayed,s,e);
    assert.equal(source.season,history.s+1); assert.equal(source.episode,history.e+1);
    assert.deepEqual(catalogueSource(url),source);
    urls.add(url);
  }));
  assert.equal(urls.size,25);
  assert.equal(primaryEmbed({id:'1396',type:'tv',season:3,episode:8}),'https://api.moviez.ac/serie/1396/3/8');
});
