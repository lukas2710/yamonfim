import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchDailyAdditions, parisMidnight } from './daily-additions.ts';

test('counts above 1000 using exact head counts, independently of the preview', async () => {
  const client = { from() {
    let head = false, type;
    const query = {
      select(_, options) { head = !!options?.head; if (head) assert.equal(options.count, 'exact'); return query; },
      gte() { return query; }, lt() { return query; }, eq(_, value) { type = value; return query; }, order() { return query; },
      limit(n) { assert.equal(n, 60); return query; },
      then(resolve) { return Promise.resolve(head ? { count: type === 'movie' ? 1500 : type === 'series' ? 12 : 2001, error: null } : { data: [{ id: 1 }], error: null }).then(resolve); },
    }; return query;
  } };
  const data = await fetchDailyAdditions(client, new Date('2026-10-26T12:00:00Z'));
  assert.equal(data.total, 1512); assert.equal(data.yesterday, 2001); assert.equal(data.items.length, 1);
});
test('Paris day boundaries include winter, summer and time changes', () => {
  assert.equal(parisMidnight(new Date('2026-10-26T12:00:00Z')).toISOString(), '2026-10-25T23:00:00.000Z');
  assert.equal(parisMidnight(new Date('2026-07-26T12:00:00Z')).toISOString(), '2026-07-25T22:00:00.000Z');
  assert.equal(parisMidnight(new Date('2026-10-25T12:00:00Z')).toISOString(), '2026-10-24T22:00:00.000Z');
});
