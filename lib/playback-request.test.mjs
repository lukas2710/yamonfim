import test from 'node:test';
import assert from 'node:assert/strict';
import { playbackRequest, invalidatePlayback } from './playback-request.ts';
test('a prepared episode is reused, scoped to the session, and bypassed on source failure', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; return new Response(JSON.stringify({ url: '/stream.m3u8' }), { status: 200 }); };
  try {
    const next = '/api/catalogue-player?tmdb=1396&type=tv&season=1&episode=2';
    const warm = playbackRequest(next, 'test-session-a');
    const launch = playbackRequest(next, 'test-session-a');
    assert.equal(warm, launch); await launch; assert.equal(calls, 1);
    await playbackRequest(next, 'test-session-b'); assert.equal(calls, 2);
    await playbackRequest(next, 'test-session-a', ['https://api.moviez.ac/serie/1396/1/2']); assert.equal(calls, 3);
    invalidatePlayback(next, 'test-session-a');
    await playbackRequest(next, 'test-session-a'); assert.equal(calls, 4, 'a failed stream is freshly resolved on retry');
  } finally { globalThis.fetch = original; }
});
