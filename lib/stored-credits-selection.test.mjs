import test from 'node:test';
import assert from 'node:assert/strict';
import { selectStoredCredits } from './stored-credits-selection.ts';
import { episodeCreditsDecision } from './episode-credits.ts';
const now = Date.parse('2026-10-27T12:00:00Z');
const row = changes => ({ start_sec: 2400, duration_ms: 3000000, source: 'IntroDB', expires_at: '2026-11-01T12:00:00Z', ...changes });
test('every listed timestamp is applied despite version runtime differences', () => {
  for (const duration of [2500, 2800, 3020, 3300, 4000]) {
    const result = selectStoredCredits([row()], duration, now);
    assert.equal(result.hit, true);
    assert.equal(result.marker.start, 2400);
    assert.equal(result.marker.duration, duration);
    for (let left = 5; left >= 1; left--) assert.equal(episodeCreditsDecision(2405-left,duration,result.marker,false,false,true).countdown,left);
    assert.equal(episodeCreditsDecision(2405,duration,result.marker,false,false,true).advance,true);
  }
});
test('manual value wins even when automatic and missing records exist', () => {
  const result = selectStoredCredits([row({ start_sec: null, source: 'missing' }),row(),row({ start_sec: 2880, duration_ms: 0, source: 'admin', expires_at: null })], 3100, now);
  assert.equal(result.marker.start, 2880);
  assert.equal(episodeCreditsDecision(2880,3100,result.marker,false,false,true).countdown,5);
  assert.equal(episodeCreditsDecision(2885,3100,result.marker,false,false,true).advance,true);
});
test('missing lookup does not hide a filled timestamp for another duration', () => {
  const result = selectStoredCredits([row({ start_sec: null, source: 'missing', duration_ms: 3100000 }),row()],3100,now);
  assert.equal(result.marker.start,2400);
});
test('an impossible timestamp after video end cannot trigger; pause and cancellation hold', () => {
  assert.equal(selectStoredCredits([row()],2300,now).marker,null);
  const marker = selectStoredCredits([row()],3000,now).marker;
  assert.equal(episodeCreditsDecision(2405,3000,marker,true,false,true).advance,false);
  assert.equal(episodeCreditsDecision(2405,3000,marker,false,true,true).advance,false);
  assert.equal(episodeCreditsDecision(2405,3000,marker,false,false,false).advance,false);
});
