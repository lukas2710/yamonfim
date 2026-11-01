import test from 'node:test';
import assert from 'node:assert/strict';
import { buildHomeRankings } from './home-rankings-server.ts';
test('queries real weekly trends and rating-sorted genres with vote thresholds', async () => {
  const requests = [];
  const result = await buildHomeRankings('test', async url => {
    const parsed = new URL(url); requests.push(parsed);
    const tv = parsed.pathname.includes('/tv');
    return Response.json({ results: [{ id: tv ? 2 : 1, vote_average: 8.5, vote_count: 1000, original_language: tv ? 'ja' : 'fr', genre_ids: tv ? [16] : [28] }] });
  });
  assert.ok(requests.some(url => url.pathname.endsWith('/trending/movie/week')));
  assert.ok(requests.some(url => url.pathname.endsWith('/trending/tv/week')));
  for (const url of requests.filter(url => url.pathname.includes('/discover/'))) {
    assert.equal(url.searchParams.get('sort_by'), 'vote_average.desc');
    assert.equal(url.searchParams.get('vote_count.gte'), url.pathname.endsWith('/tv') ? '150' : '300');
    assert.equal(url.searchParams.get('include_adult'), 'false');
  }
  assert.equal(result.ratings['tv:2'].anime, true);
  assert.equal(result.ratings['movie:1'].anime, false);
});
test('an incomplete provider response cannot replace a good saved ranking', async () => {
  await assert.rejects(buildHomeRankings('test', async () => new Response('', { status: 503 })), /indisponibles/);
});
