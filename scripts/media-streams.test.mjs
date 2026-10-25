import test from 'node:test';
import assert from 'node:assert/strict';
import { catalogueEntries, sourceUrl, moviezConfig, m3u } from './media-streams-lib.mjs';

test('extrait les iframes et refuse les protocoles non vidéo', () => {
  assert.equal(sourceUrl('<iframe src="https://api.moviez.ac/35?a=1&amp;b=2"></iframe>'), 'https://api.moviez.ac/35?a=1&b=2');
  for (const value of ['', null, 'javascript:alert(1)', 'file:///secret', 'https://user:password@example.com']) assert.equal(sourceUrl(value), '');
});

test('parcourt chaque épisode et conserve aussi les liens manquants', () => {
  const result = catalogueEntries([
    { id: 'a', title: 'Film', type: 'movie', url: 'https://example.com/f.mp4' },
    { id: 'b', title: 'Série', type: 'series', seasons: [
      { seasonNumber: 0, episodes: [{ number: 2, title: 'Spécial', embedUrl: '<iframe src="https://api.moviez.ac/serie/1/0/2"></iframe>' }] },
      { seasonNumber: 3, episodes: [{ number: 1 }] },
    ] },
  ]);
  assert.deepEqual(result.map(r => r.entry_key), ['a:movie', 'b:s0:e2', 'b:s3:e1']);
  assert.equal(result[2].source_url, '');
  assert.match(result[1].title, /S00E02/);
});

test('ne lance jamais le JavaScript du fournisseur', () => {
  assert.equal(moviezConfig('<script>window.P2 = {"t":"token"};</script>').t, 'token');
  assert.throws(() => moviezConfig('window.P2 = {t: malicious()};'));
});

test('exporte seulement les flux prêts et non expirés sans injection de lignes M3U', () => {
  const now = Date.now();
  const base = { entry_key: '1:movie', title: 'Film\n#EXTINF:injection', media_type: 'movie', status: 'ready', stream_url: 'https://example.com/a.m3u8' };
  const result = m3u([base, { ...base, status: 'error' }, { ...base, expires_at: new Date(now - 1).toISOString() }, { ...base, stream_url: 'javascript:bad' }], now);
  assert.equal(result.split('\n').filter(l => l.startsWith('#EXTINF:')).length, 1);
  assert.equal(result.split('\n').filter(l => l.startsWith('https://')).length, 1);
  assert.ok(result.startsWith('#EXTM3U\n'));
});
