import test from 'node:test';
import assert from 'node:assert/strict';
import { readCataloguePages, readWholeCatalogue } from './client-catalogue.ts';

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
test('pages cached before and after an update never pass for a complete list', async () => {
  const before = Array.from({ length: 5000 }, (_, index) => ({ id: 5000 - index }));
  const after = [...Array.from({ length: 1400 }, (_, index) => ({ id: 6400 - index })), ...before];
  const read = async offset => Response.json((offset ? before : after).slice(offset, offset + 2000), { headers: { 'X-Total-Count': String(after.length) } });
  await assert.rejects(() => readCataloguePages(read), /incomplet/);
});
test('the whole list is one answer, and a bad answer is reported', async () => {
  assert.equal((await readWholeCatalogue(async () => Response.json([{ id: 1 }, { id: 2 }]))).length, 2);
  await assert.rejects(() => readWholeCatalogue(async () => new Response('', { status: 503 })), /503/);
  await assert.rejects(() => readWholeCatalogue(async () => Response.json({ error: 'non' })), /invalide/);
});
test('an answer without a total still returns the first page', async () => {
  const rows = await readCataloguePages(async () => Response.json([{ id: 1 }]));
  assert.equal(rows.length, 1);
});
