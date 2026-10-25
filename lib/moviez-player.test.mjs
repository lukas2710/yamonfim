import test from 'node:test';
import assert from 'node:assert/strict';
import { moviezPlayerUrl, moviezToken, playlistDuration, assertStreamDuration } from './moviez-player.ts';
import { nextEpisodePosition, isNativePlayback } from './watch-progress.ts';

test('resolves only known Moviez player paths and keeps the selected language', () => {
  assert.equal(moviezPlayerUrl('https://api.moviez.ac/serie/123/0/2?lang=vostfr&next=1&autoplay=1'), 'https://api.moviez.ac/serie/123/0/2?lang=vostfr');
  for (const url of ['http://api.moviez.ac/35', 'https://api.moviez.ac.evil.test/35', 'https://api.moviez.ac:444/35', 'https://user:password@api.moviez.ac/35', 'https://api.moviez.ac/api/v2/stream', 'http://127.0.0.1/35', null]) assert.throws(() => moviezPlayerUrl(url));
});

test('reads the player token as JSON without executing remote JavaScript', () => {
  assert.equal(moviezToken('<script>window.P2 = {"lang":"vf","t":"temporary-token"};</script>'), 'temporary-token');
  assert.throws(() => moviezToken('window.P2 = {t: runCode()};'));
  assert.throws(() => moviezToken('window.P2 = {"t":null};'));
});

test('native playback resolves Moviez and reads direct HLS', () => {
  assert.equal(isNativePlayback('https://api.moviez.ac/35'), true);
  assert.equal(isNativePlayback('/api/proxy/stream.m3u8?url=signed'), true);
  assert.equal(isNativePlayback('https://other.test/player/35'), false);
});

test('rejects a short advert for a full movie and accepts the expected media duration', () => {
  assert.equal(playlistDuration('#EXTM3U\n#EXTINF:5.000,\na.ts\n#EXTINF:4.25,\nb.ts\n'), 9.25);
  assert.throws(() => assertStreamDuration(30, 7107));
  assert.throws(() => assertStreamDuration(0, 7107));
  assert.throws(() => assertStreamDuration(7107, NaN));
  assert.doesNotThrow(() => assertStreamDuration(7107.058, 7107));
});

test('autoplay advances through seasons, skips empty seasons, and stops after the finale', () => {
  const seasons = [{ episodes: [1, 2] }, { episodes: [] }, { episodes: [1] }];
  assert.deepEqual(nextEpisodePosition(seasons, { s: 0, e: 0 }), { s: 0, e: 1 });
  assert.deepEqual(nextEpisodePosition(seasons, { s: 0, e: 1 }), { s: 2, e: 0 });
  assert.equal(nextEpisodePosition(seasons, { s: 2, e: 0 }), null);
  assert.equal(nextEpisodePosition(undefined, { s: 0, e: 0 }), null);
});
