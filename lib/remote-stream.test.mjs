import test from 'node:test';
import assert from 'node:assert/strict';
import { rewritePlaylist, hlsAudioTracks, selectHlsAudio } from './remote-stream.ts';
import { isPublicAddress, publicRemoteUrl, readRemoteText } from './public-remote.ts';

test('native audio selection preserves signed URLs and selects French from the master', () => {
  const source = '#EXTM3U\n#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",NAME="English",LANGUAGE="en",DEFAULT=YES,URI="en.m3u8?signature=exact"\n#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",NAME="Français",LANGUAGE="fr",DEFAULT=NO,URI="fr.m3u8?signature=exact"\n#EXT-X-STREAM-INF:BANDWIDTH=600000,AUDIO="audio"\nvideo.m3u8?signature=exact\n';
  assert.deepEqual(hlsAudioTracks(source), [{ id: 0, name: 'English', lang: 'en' }, { id: 1, name: 'Français', lang: 'fr' }]);
  const result = selectHlsAudio(source, 'fr');
  assert.ok(result.includes('LANGUAGE="fr",DEFAULT=YES'));
  assert.ok(!result.includes('NAME="English"'));
  assert.ok(result.includes('fr.m3u8?signature=exact'));
  assert.ok(result.includes('video.m3u8?signature=exact'));
  assert.equal(selectHlsAudio(source, 'ja'), source);
});

test('HLS rewrites child manifests, segments, encryption keys and maps', () => {
  const base = 'https://cdn.example.test/live/master.m3u8';
  const output = rewritePlaylist('#EXTM3U\r\n#EXT-X-KEY:METHOD=AES-128,URI="../key"\r\n#EXT-X-MAP:URI="init.mp4"\r\nvariant/index.m3u8\r\nhttps://other.example.test/seg.ts\r\n', base);
  for (const url of ['https://cdn.example.test/key', 'https://cdn.example.test/live/init.mp4', 'https://cdn.example.test/live/variant/index.m3u8', 'https://other.example.test/seg.ts']) assert.ok(output.includes('/api/proxy?url=' + encodeURIComponent(url)));
  assert.ok(output.startsWith('#EXTM3U\n'));
  assert.throws(() => rewritePlaylist('#EXTM3U\ndata:text/plain,secret', base));
});

test('remote text reading respects byte limits and UTF-8 characters', async () => {
  assert.equal(await readRemoteText(new Response('écran'), 6), 'écran');
  await assert.rejects(readRemoteText(new Response('écran'), 5));
});

test('remote routes refuse loopback, private networks and metadata addresses', async () => {
  for (const address of ['127.0.0.1', '10.0.0.1', '172.16.0.1', '192.168.1.1', '169.254.169.254', '100.64.0.1', '::1', '::ffff:127.0.0.1', 'fc00::1', 'fe80::1']) assert.equal(isPublicAddress(address), false, address);
  assert.equal(isPublicAddress('8.8.8.8'), true);
  for (const url of ['http://127.0.0.1/', 'http://[::1]/', 'file:///etc/passwd', 'https://user:secret@example.test/', 'http://127.0.0.1:3000/']) await assert.rejects(publicRemoteUrl(url));
});
