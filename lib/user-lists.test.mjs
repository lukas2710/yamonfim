import test from 'node:test';
import assert from 'node:assert/strict';
import { listsMissing, listTitles } from './user-lists.ts';
import { continueWatchingEntries } from './watch-progress.ts';

test('list rows keep the latest additions first and skip titles the profile cannot see', () => {
  const entries = [{ media_id: '2', list: 'favorite', created_at: 'b' }, { media_id: '9', list: 'favorite', created_at: 'a' }, { media_id: '1', list: 'favorite', created_at: 'a' }, { media_id: '3', list: 'later', created_at: 'a' }];
  assert.deepEqual(listTitles(entries, 'favorite', [{ id: 1 }, { id: 2 }, { id: 3 }]).map(item => item.id), [2, 1]);
  assert.deepEqual(listTitles(entries, 'later', [{ id: 3 }]).map(item => item.id), [3]);
});
test('only a missing table hides the lists', () => {
  assert.equal(listsMissing({ code: '42P01' }), true);
  assert.equal(listsMissing({ code: 'PGRST205', message: 'user_lists' }), true);
  assert.equal(listsMissing({ code: '42501', message: 'permission denied for table user_lists' }), false);
  assert.equal(listsMissing({ code: '500', message: 'timeout' }), false);
  assert.equal(listsMissing(null), false);
});
test('a film stopped in its last two minutes leaves « Reprendre », one at 80 % stays', () => {
  const rows = [{ media_id: 'a', type: 'movie', current_time: 5500, duration: 5600, updated_at: '2' }, { media_id: 'b', type: 'movie', current_time: 4480, duration: 5600, updated_at: '1' }];
  assert.deepEqual(continueWatchingEntries(rows, () => true).map(entry => entry.id), ['b']);
});
