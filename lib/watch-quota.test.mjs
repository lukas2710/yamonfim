import test from 'node:test';
import assert from 'node:assert/strict';
import { reserveViewing } from './watch-quota.ts';

test('VIP has unlimited access without consuming the free quota', async () => {
  let updates = 0;
  for (let count = 0; count < 20; count++) {
    const access = await reserveViewing(async () => ({ vip: true, count: 100 }), async () => { updates++; return true; });
    assert.deepEqual(access, { allowed: true, vip: true, remaining: null });
  }
  assert.equal(updates, 0);
});

test('free accounts can launch exactly five viewings, then the sixth is refused', async () => {
  let count = 0;
  const read = async () => ({ vip: false, count });
  const increment = async expected => { if (count !== expected) return false; count++; return true; };
  for (let index = 0; index < 5; index++) {
    const access = await reserveViewing(read, increment);
    assert.equal(access.allowed, true);
    assert.equal(access.remaining, 4 - index);
  }
  assert.equal((await reserveViewing(read, increment)).allowed, false);
  assert.equal(count, 5);
});

test('two simultaneous tabs cannot both consume the last viewing', async () => {
  let count = 4;
  const read = async () => ({ vip: false, count });
  const increment = async expected => { if (count !== expected) return false; count++; return true; };
  const results = await Promise.all([reserveViewing(read, increment), reserveViewing(read, increment)]);
  assert.equal(results.filter(access => access.allowed).length, 1);
  assert.equal(count, 5);
});

test('an upgrade to VIP during a quota conflict allows access without incrementing', async () => {
  let vip = false;
  const access = await reserveViewing(async () => ({ vip, count: 4 }), async () => { vip = true; return false; });
  assert.equal(access.allowed, true);
  assert.equal(access.vip, true);
});

test('unavailable or invalid account data never silently grants a free viewing', async () => {
  await assert.rejects(reserveViewing(async () => { throw new Error('offline'); }, async () => true));
  await assert.rejects(reserveViewing(async () => ({ vip: false, count: NaN }), async () => true));
  await assert.rejects(reserveViewing(async () => ({ vip: false, count: 0 }), async () => false));
});
