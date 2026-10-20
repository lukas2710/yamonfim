import test from 'node:test';
import assert from 'node:assert/strict';
import { episodeDurationSeconds, createEpisodeClock, elapsedEpisodeTime, pauseEpisodeClock, resumeEpisodeClock } from './episode-clock.ts';

test('each episode uses its own runtime with a series runtime or explicit estimate as fallback', () => {
  assert.equal(episodeDurationSeconds(23, 45), 1380);
  assert.equal(episodeDurationSeconds(52, 45), 3120);
  assert.equal(episodeDurationSeconds(undefined, 42), 2520);
  assert.equal(episodeDurationSeconds(0, undefined), 2700);
  assert.equal(episodeDurationSeconds(NaN, -5), 2700);
});
test('pausing freezes the estimated episode even if a long time passes', () => {
  const clock = pauseEpisodeClock(createEpisodeClock(120, 1000), 31000);
  assert.equal(elapsedEpisodeTime(clock, 999999), 30000);
});
test('resuming counts only time after resumption and repeated resume does not reset the clock', () => {
  const paused = pauseEpisodeClock(createEpisodeClock(120, 1000), 31000);
  const resumed = resumeEpisodeClock(paused, 100000);
  assert.equal(elapsedEpisodeTime(resumed, 110000), 40000);
  assert.deepEqual(resumeEpisodeClock(resumed, 108000), resumed);
});
test('browser timer throttling does not require missed interval ticks to be replayed', () => {
  const clock = createEpisodeClock(60, 1000);
  assert.equal(elapsedEpisodeTime(clock, 100000), 60000);
  assert.equal(elapsedEpisodeTime(clock, 500), 0);
});
test('resuming an estimate retains elapsed time and a new episode starts its own duration', () => {
  assert.equal(elapsedEpisodeTime(createEpisodeClock(300, 1000, 120), 11000), 130000);
  assert.equal(elapsedEpisodeTime(createEpisodeClock(240, 20000), 20000), 0);
});
