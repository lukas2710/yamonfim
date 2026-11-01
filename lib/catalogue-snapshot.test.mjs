import test from 'node:test';
import assert from 'node:assert/strict';
import { shortenDescription, readCatalogueSnapshot, writeCatalogueSnapshot } from './catalogue-snapshot.ts';
test('long descriptions are cut at a word before 220 characters', () => {
  const text = 'mot '.repeat(100).trim();
  const short = shortenDescription(text);
  assert.ok(short.length <= 220 && short.endsWith('…') && !short.endsWith(' …'));
  assert.equal(shortenDescription('Court.'), 'Court.');
  assert.equal(shortenDescription(null), null);
});
test('without Netlify Blobs the snapshot is simply unavailable', async () => {
  assert.equal(await readCatalogueSnapshot(), null);
  assert.equal(await writeCatalogueSnapshot([]), false);
});
