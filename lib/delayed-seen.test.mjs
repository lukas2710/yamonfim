import test from 'node:test';
import assert from 'node:assert/strict';
import { scheduleSeen, SEEN_DELAY_MS } from './delayed-seen.ts';
function clock() {
  const pending = new Map(); let id = 0;
  return { pending, schedule(fn, delay) { assert.equal(delay, 5000); pending.set(++id, fn); return id; }, cancel(id) { pending.delete(id); } };
}
test('seen waits five seconds and commits once', () => {
  const c = clock(); let seen = 0;
  scheduleSeen(() => seen++, c.schedule, c.cancel);
  assert.equal(SEEN_DELAY_MS, 5000); assert.equal(seen, 0);
  const fire = [...c.pending.values()][0]; fire(); fire(); assert.equal(seen, 1);
});
test('closing or pausing before the delay cancels marking', () => {
  const c = clock(); let seen = 0;
  const stop = scheduleSeen(() => seen++, c.schedule, c.cancel);
  const stale = [...c.pending.values()][0]; stop(); stale();
  assert.equal(seen, 0); assert.equal(c.pending.size, 0);
});
test('switching episodes cancels the old marker and marks only the new episode', () => {
  const c = clock(); const seen = [];
  const stop = scheduleSeen(() => seen.push('episode1'), c.schedule, c.cancel);
  const stale = [...c.pending.values()][0]; stop();
  scheduleSeen(() => seen.push('episode2'), c.schedule, c.cancel);
  stale(); [...c.pending.values()][0](); assert.deepEqual(seen, ['episode2']);
});
