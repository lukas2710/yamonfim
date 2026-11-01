import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchProfileWatched } from './profile-watched.ts';
function client(total, cap = 1000, failAt = Infinity) {
  const requests = [];
  return { requests, from(table) {
    assert.equal(table, 'user_watched'); let counted = false; const filters = [];
    const query = {
      select(_, options) { counted = options?.count === 'exact'; return query; },
      eq(key, value) { filters.push([key, value]); return query; }, order() { return query; },
      range(start, end) {
        requests.push(start);
        assert.deepEqual(filters, [['user_id', 'user'], ['profile_id', 'profile']]);
        if (start >= failAt) return Promise.resolve({ data: null, error: { message: 'failure' }, count: null });
        return Promise.resolve({ data: Array.from({ length: Math.max(0, Math.min(total - start, cap, end - start + 1)) }, (_, index) => ({ media_id: 's', ep_key: `s0_e${start + index}` })), error: null, count: counted ? total : null });
      },
    }; return query;
  } };
}
test('all watched episodes are loaded past the 1000-row default, within the active profile', async () => {
  const db = client(2505); const rows = await fetchProfileWatched(db, 'user', 'profile');
  assert.equal(rows.length, 2505); assert.equal(rows[2504].ep_key, 's0_e2504');
  assert.deepEqual(db.requests, [0, 1000, 2000]);
});
test('a lower server row cap does not truncate the profile history', async () => {
  const db = client(351, 100); const rows = await fetchProfileWatched(db, 'user', 'profile');
  assert.equal(rows.length, 351); assert.deepEqual(db.requests, [0, 100, 200, 300]);
});
test('missing profile cannot read other profiles and incomplete reads are rejected', async () => {
  const db = client(1500); assert.deepEqual(await fetchProfileWatched(db, 'user', ''), []); assert.equal(db.requests.length, 0);
  await assert.rejects(fetchProfileWatched(client(1500, 1000, 1000), 'user', 'profile'), /chargés/);
});
