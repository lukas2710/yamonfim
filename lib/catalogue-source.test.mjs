import test from 'node:test';
import assert from 'node:assert/strict';
import { catalogueSource, cataloguePlayer, primaryEmbed, isSupportedEmbed, uniqueEmbeds, MAX_SOURCE_EMBEDS } from './catalogue-source.ts';
import { publishedEmbedLinks, resolveCatalogueStream, movixResponseEmbeds, CatalogueStreamError } from './catalogue-stream.ts';
import { isNativePlayback, preparePlayerUrl } from './watch-progress.ts';
test('accepts only exact EmbedOrigin player URLs for native extraction', () => {
  const url = 'https://embedorigin.cc/e/h8jlblj2cx1u';
  assert.equal(isSupportedEmbed(url), true);
  assert.equal(isNativePlayback(url), true);
  for (const value of ['http://embedorigin.cc/e/h8jlblj2cx1u', 'https://embedorigin.cc.evil.test/e/h8jlblj2cx1u', 'https://embedorigin.cc/app/v1/play/h8jlblj2cx1u', 'https://user:password@embedorigin.cc/e/h8jlblj2cx1u']) assert.equal(isSupportedEmbed(value), false);
  assert.deepEqual(movixResponseEmbeds({ player_links: [{ decoded_url: url }, { url }, { url: 'javascript:alert(1)' }] }), [url]);
  assert.deepEqual(movixResponseEmbeds({ data: [{ links: [{ url }] }] }), [url]);
});
test('keeps the exact film or episode when switching provider', () => {
  const episode = catalogueSource('https://api.moviez.ac/serie/156/2/8?autoplay=1');
  assert.deepEqual(episode, { id: '156', type: 'tv', season: 2, episode: 8 });
  assert.deepEqual(catalogueSource(cataloguePlayer(episode)), episode);
  assert.equal(primaryEmbed(episode), 'https://api.moviez.ac/serie/156/2/8');
  assert.equal(isNativePlayback(preparePlayerUrl(cataloguePlayer(episode), 'http://127.0.0.1:3000')), true);
});
test('rejects unexpected paths and invalid episode identifiers', () => {
  for (const url of ['https://evil.test/542417', 'http://api.moviez.ac/542417', '/api/catalogue-player?tmdb=12&type=tv&season=-1', '/api/catalogue-player?tmdb=x&type=movie', 'https://user:secret@api.moviez.ac/12']) assert.throws(() => catalogueSource(url));
});
test('reads published HLS and nested embeds without executing scripts', () => {
  const links = publishedEmbedLinks('<iframe src="/next"></iframe><script>var x="https://cdn.example/master.m3u8?t=1&amp;s=2"; alert("never execute");</script>', 'https://embed.example/view');
  assert.deepEqual(links, ['https://embed.example/next', 'https://cdn.example/master.m3u8?t=1&s=2']);
  assert.deepEqual(publishedEmbedLinks('<iframe src="javascript:alert(1)"></iframe>', 'https://embed.example/view'), []);
});
test('tries Moviez first and only discovers Movix after a failure', async () => {
  const source = catalogueSource('https://api.moviez.ac/542417');
  const calls = [];
  const stream = { url: 'https://cdn.example/master.m3u8', audioTracks: [] };
  const deps = {
    primary: async () => { calls.push('Moviez'); return stream; },
    embeds: async () => { calls.push('Movix'); return ['https://embed.example/broken', 'https://embed.example/working']; },
    resolve: async (url) => { calls.push(url); if (url.endsWith('broken')) throw new Error('broken'); return stream; },
  };
  assert.equal((await resolveCatalogueStream(source, [], new AbortController().signal, deps)).provider, 'Moviez');
  assert.deepEqual(calls, ['Moviez']);
  calls.length = 0;
  deps.primary = async () => { calls.push('Moviez'); throw new Error('offline'); };
  const fallback = await resolveCatalogueStream(source, [], new AbortController().signal, deps);
  assert.equal(fallback.embed, 'https://embed.example/working');
  assert.deepEqual(calls, ['Moviez', 'Movix', 'https://embed.example/broken', 'https://embed.example/working']);
  calls.length = 0;
  await resolveCatalogueStream(source, [primaryEmbed(source), 'https://embed.example/broken'], new AbortController().signal, deps);
  assert.deepEqual(calls, ['Movix', 'https://embed.example/working']);
  await assert.rejects(resolveCatalogueStream(source, [primaryEmbed(source), 'https://embed.example/broken', 'https://embed.example/working'], new AbortController().signal, deps));
});
test('stores all collected alternatives without duplicates and preserves episode identity', () => {
  const source = { ...catalogueSource('https://api.moviez.ac/serie/156/2/8'), embeds: ['https://embedorigin.cc/e/h8jlblj2cx1u', 'https://embed.example/second?x=1&y=2'] };
  assert.deepEqual(catalogueSource(cataloguePlayer(source)), source);
  assert.deepEqual(uniqueEmbeds([...source.embeds, source.embeds[0], 'javascript:alert(1)', 'https://user:secret@evil.test/']), source.embeds);
  assert.equal(uniqueEmbeds(Array.from({ length: 100 }, (_, index) => `https://embed.example/${index}`)).length, MAX_SOURCE_EMBEDS);
});
test('mid-film failover uses stored alternatives, skips failed embeds and can reach beyond the sixth link', async () => {
  const source = { ...catalogueSource('https://api.moviez.ac/542417'), embeds: Array.from({ length: 9 }, (_, index) => `https://embed.example/${index}`) };
  const calls = [];
  const deps = {
    primary: async () => { throw new Error('must be excluded'); },
    embeds: async () => { throw new Error('must use saved alternatives'); },
    resolve: async url => { calls.push(url); if (!url.endsWith('/8')) throw new Error('offline'); return { url: 'https://cdn.example/master.m3u8', audioTracks: [] }; },
  };
  const result = await resolveCatalogueStream(source, [primaryEmbed(source), source.embeds[0]], new AbortController().signal, deps);
  assert.equal(result.embed, source.embeds[8]);
  assert.equal(calls.length, 8);
  assert.equal(calls.includes(source.embeds[0]), false);
  await assert.rejects(resolveCatalogueStream(source, [primaryEmbed(source), ...source.embeds], new AbortController().signal, deps));
});
test('a timed-out search reports tried links so the next request can continue', async () => {
  const controller = new AbortController();
  const source = { ...catalogueSource('https://api.moviez.ac/542417'), embeds: ['https://embed.example/a', 'https://embed.example/b'] };
  const deps = {
    primary: async () => { throw new Error('excluded'); }, embeds: async () => [],
    resolve: async () => { controller.abort(); throw new Error('timeout'); },
  };
  await assert.rejects(resolveCatalogueStream(source, [primaryEmbed(source)], controller.signal, deps), error => error instanceof CatalogueStreamError && error.hasMore && error.attempted.join() === source.embeds[0]);
});
test('Movix episode groups never mix alternatives from different episodes', () => {
  const a = 'https://embedorigin.cc/e/h8jlblj2cx1u', b = 'https://embed.example/wrong-episode';
  assert.deepEqual(movixResponseEmbeds({ episodes: { 1: { languages: { VF: [{ url: b }] } }, 2: { languages: { VF: [{ url: a }] } } } }, 2), [a]);
  assert.deepEqual(movixResponseEmbeds({ players: { vf: [{ url: a }], vostfr: [{ url: b }] } }), [a]);
});
test('hand-added links are kept in the player URL, tried after Moviez and always offered', async () => {
  const { withExtraLink, withoutExtraLink, extraLinks } = await import('./catalogue-source.ts');
  const { resolveBestCatalogueStream } = await import('./catalogue-stream.ts');
  const extra = 'https://embedorigin.cc/e/h8jlblj2cx1u', other = 'https://embedorigin.cc/e/abcdefghijkl';
  const stored = withExtraLink('<iframe src="https://api.moviez.ac/2486?autoplay=1&amp;color=e8213f"></iframe>', extra);
  assert.deepEqual(catalogueSource(stored), { id: '2486', type: 'movie', season: 1, episode: 1, extras: [extra] });
  assert.equal(withExtraLink(stored, 'https://evil.test/e/h8jlblj2cx1u'), null);
  assert.equal(withExtraLink('', extra), null);
  assert.deepEqual(extraLinks(withExtraLink('', extra, { id: '9', type: 'tv', season: 2, episode: 3 })), [extra]);
  const both = withExtraLink(stored, other);
  assert.deepEqual(extraLinks(both), [extra, other]);
  assert.deepEqual(extraLinks(withoutExtraLink(both, extra)), [other]);
  const fast = await resolveBestCatalogueStream(catalogueSource(both), [], new AbortController().signal, { primary: async () => ({ url: 'https://cdn.test/m.m3u8', audioTracks: [] }), embeds: async () => [], resolve: async () => { throw new Error('unused'); } });
  assert.deepEqual(fast.alternatives.map(option => option.provider), ['Moviez', 'Lien ajouté', 'Lien ajouté']);
  const fallback = await resolveBestCatalogueStream(catalogueSource(both), [], new AbortController().signal, { primary: async () => { throw new Error('down'); }, embeds: async () => [], resolve: async embed => { if (embed !== other) throw new Error('down'); return { url: 'https://cdn.test/x.m3u8', audioTracks: [] }; } });
  assert.equal(fallback.embed, other);
  assert.equal(fallback.provider, 'Lien ajouté');
  assert.deepEqual(fallback.alternatives.map(option => option.embed), [other, extra]);
});
