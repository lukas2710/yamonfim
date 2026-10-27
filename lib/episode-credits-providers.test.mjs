import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchEpisodeCredits } from './episode-credits-providers.ts';
import { creditsTmdb } from './credits-identity.ts';

const community = { imdb_id: 'tt2531336', media_type: 'tv', season: 1, episode: 1, outro: { start_sec: 2773.84, end_sec: 2829.07, confidence: 1 }, post_credits: null };
function fixture(first = null) {
  const urls = [];
  return { urls, fetcher: async url => {
    urls.push(String(url));
    if (String(url).includes('theintrodb.org')) return Response.json(first);
    if (String(url).includes('themoviedb.org')) return Response.json({ imdb_id: 'tt2531336' });
    return Response.json(community);
  } };
}
test('bulk scan imports Lupin using the provider release duration without video playback', async () => {
  const mock = fixture();
  const result = await fetchEpisodeCredits('96677', 1, 1, { signal: new AbortController().signal, tmdbApiKey: 'test', fetcher: mock.fetcher });
  assert.deepEqual(result.marker, { start: 2773.84, duration: 2829.07, source: 'IntroDB' });
  assert.equal(result.incomplete, false);
  assert.equal(mock.urls.some(url => url.includes('duration_ms')), false);
  assert.equal(mock.urls.some(url => url.includes('skipdb.tv')), false);
});
test('playback rejects pre-imported timings for another video release', async () => {
  const mock = fixture();
  const result = await fetchEpisodeCredits('96677', 1, 1, { duration: 2888, signal: new AbortController().signal, tmdbApiKey: 'test', fetcher: mock.fetcher });
  assert.equal(result.marker, null);
  assert.ok(mock.urls[0].includes('duration_ms=2888000'));
});
test('bulk scan keeps the first valid source and does not call unnecessary providers', async () => {
  const mock = fixture({ type: 'tv', season: 1, episode: 1, group_duration_ms: 2829070, credits: [{ start_ms: 2773840, end_ms: null, confidence: .95 }] });
  const result = await fetchEpisodeCredits('96677', 1, 1, { signal: new AbortController().signal, tmdbApiKey: 'test', fetcher: mock.fetcher });
  assert.equal(result.marker?.source, 'TheIntroDB');
  assert.equal(mock.urls.length, 1);
});
test('provider failure is distinguished from a completed empty lookup', async () => {
  const result = await fetchEpisodeCredits('96677', 1, 1, { signal: new AbortController().signal, tmdbApiKey: 'test', fetcher: async () => new Response('', { status: 503 }) });
  assert.equal(result.marker, null);
  assert.equal(result.incomplete, true);
});
test('missing catalogue TMDB id is recovered from the actual episode source', () => {
  assert.equal(creditsTmdb({}, 'https://api.moviez.ac/serie/96677/1/1'), '96677');
  assert.equal(creditsTmdb({}, '/api/catalogue-player?tmdb=96677&type=tv&season=1&episode=1'), '96677');
  assert.equal(creditsTmdb({ tmdb_id: 1396 }), '1396');
  assert.equal(creditsTmdb({}, 'https://unknown.test/video'), '');
});
