const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { createHash } = require('node:crypto');
(async () => {
  const base = 'https://yamonfim.vercel.app';
  const page = await fetch(base + '/admin/generiques');
  const html = await page.text();
  assert.equal(page.status, 200);
  assert.ok(html.includes('Génériques des épisodes'));
  console.log('Admin page: 200, title present');
  const endpoint = base + '/api/episode-credits?tmdb=1396&season=1&episode=1&duration=3500';
  for (let index = 0; index < 2; index++) {
    const response = await fetch(endpoint, { signal: AbortSignal.timeout(35000) });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.marker?.start, 3431);
    assert.equal(body.marker?.source, 'IntroDB');
    if (index === 1) assert.equal(body.cached, true);
    else assert.ok(body.saved || body.cached, 'Database persistence must succeed');
    console.log('Credits request ' + (index + 1) + ': ' + JSON.stringify(body));
  }
  const invalid = await fetch(base + '/api/episode-credits?tmdb=1396&season=0&episode=1&duration=3500');
  assert.equal(invalid.status, 400);
  console.log('Invalid episode: 400');
  const apk = await fetch(base + '/yamonfilm-tv.apk');
  assert.equal(apk.status, 200);
  const remote = createHash('sha256').update(Buffer.from(await apk.arrayBuffer())).digest('hex');
  const local = createHash('sha256').update(readFileSync('public/yamonfilm-tv.apk')).digest('hex');
  assert.equal(remote, local);
  console.log('Published TV APK matches signed local 2.4.1');
})().catch(error => { console.error(error.message); process.exitCode = 1; });
