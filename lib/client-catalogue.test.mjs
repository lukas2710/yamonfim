import test from 'node:test';
import assert from 'node:assert/strict';
import { readCataloguePages } from './client-catalogue.ts';

const server = (total, failures = {}) => {
  const asked = [];
  return { asked, read: async offset => {
    asked.push(offset);
    if (failures[offset] > 0) { failures[offset]--; return new Response('', { status: 503 }); }
    const rows = Array.from({ length: Math.max(0, Math.min(2000, total - offset)) }, (_, index) => ({ id: offset + index }));
    return Response.json(rows, { headers: { 'X-Total-Count': String(total) } });
  } };
};
test('the first page is shown at once, then every title arrives in order', async () => {
  const api = server(45563), shown = [];
  const rows = await readCataloguePages(api.read, page => shown.push(page.length));
  assert.equal(rows.length, 45563);
  assert.deepEqual(rows.map(row => row.id), Array.from({ length: 45563 }, (_, index) => index));
  assert.equal(shown[0], 2000);
  assert.ok(shown.length < 8);
});
test('a failing page is retried instead of losing the catalogue', async () => {
  const api = server(5000, { 2000: 2 });
  assert.equal((await readCataloguePages(api.read)).length, 5000);
});
test('a page that keeps failing is reported, not silently dropped', async () => {
  const api = server(5000, { 2000: 9 });
  await assert.rejects(() => readCataloguePages(api.read), /503/);
});
test('an answer without a total still returns the first page', async () => {
  const rows = await readCataloguePages(async () => Response.json([{ id: 1 }]));
  assert.equal(rows.length, 1);
});
