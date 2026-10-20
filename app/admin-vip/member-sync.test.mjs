import test from 'node:test';
import assert from 'node:assert/strict';
import { reconcileMemberDrafts, newlyActivatedMembers } from './member-sync.ts';

test('background synchronization preserves unsaved administrator edits', () => {
  assert.deepEqual(reconcileMemberDrafts({ a: 8, b: 2, removed: 5 }, { a: 5, b: 2, removed: 5 }, { a: 6, b: 3, added: 0 }), { a: 8, b: 3, added: 0 });
});
test('new VIP status triggers a notification, but the initial member load does not', () => {
  const before = [{ id: 'a', is_vip: false }, { id: 'b', is_vip: true }];
  const after = [{ id: 'a', is_vip: true }, { id: 'b', is_vip: true }, { id: 'c', is_vip: true }];
  assert.deepEqual(newlyActivatedMembers(before, after, true).map(m => m.id), ['a', 'c']);
  assert.deepEqual(newlyActivatedMembers([], after, false), []);
});
test('renewal of an existing VIP does not count as a new VIP and false strings stay free', () => {
  assert.deepEqual(newlyActivatedMembers([{ id: 'a', is_vip: 'true' }, { id: 'b', is_vip: 'false' }], [{ id: 'a', is_vip: true }, { id: 'b', is_vip: false }], true), []);
});
