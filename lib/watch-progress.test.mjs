import test from 'node:test';
import assert from 'node:assert/strict';
import { sameEpisode, isDirectVideo, playbackProgress, isCompleted, preparePlayerUrl, commitEpisodeTransition } from './watch-progress.ts';

test('progress reflects video timestamps and never an elapsed wall clock', () => {
  assert.deepEqual(playbackProgress(80, 100), { currentTime: 80, duration: 100 });
  assert.deepEqual(playbackProgress(150, 100), { currentTime: 100, duration: 100 });
  assert.deepEqual(playbackProgress(-10, Infinity), { currentTime: 0, duration: 0 });
  assert.deepEqual(playbackProgress(NaN, NaN), { currentTime: 0, duration: 0 });
  assert.equal(isCompleted(0, 1200), false);
  assert.equal(isCompleted(1140, 1200), true);
  assert.equal(isCompleted(0, 0), false);
});
test('resume positions distinguish both season and episode', () => {
  assert.equal(sameEpisode({ s: 0, e: 0 }, { s: 0, e: 1 }), false);
  assert.equal(sameEpisode({ s: 0, e: 0 }, { s: 1, e: 0 }), false);
  assert.equal(sameEpisode({ s: 0, e: 1 }, { s: 0, e: 1 }), true);
  assert.equal(sameEpisode(null, { s: 0, e: 0 }), false);
});
test('Moviez automatic advancement is disabled and other options are retained', () => {
  const url = new URL(preparePlayerUrl('https://api.moviez.ac/serie/123/1/2?next=1&lang=vf', 'https://site.test'));
  assert.equal(url.searchParams.get('next'), '0');
  assert.equal(url.searchParams.get('lang'), 'vf');
  assert.equal(url.pathname, '/serie/123/1/2');
  assert.equal(preparePlayerUrl('javascript:alert(1)', 'https://site.test'), '');
});
test('direct video streams retain signed query parameters without injected options', () => {
  for (const path of ['movie.mp4', 'movie.webm', 'master.m3u8']) {
    const url = 'https://media.test/' + path + '?signature=exact';
    assert.equal(isDirectVideo(url), true);
    assert.equal(preparePlayerUrl(url, 'https://site.test'), url);
  }
  assert.equal(isDirectVideo('https://api.moviez.ac/123'), false);
});

test('switching from episode 1 to episode 2 marks only episode 1 and saves episode 2 afterwards', async () => {
  const actions = [];
  await commitEpisodeTransition({ s: 0, e: 0 }, { s: 0, e: 1 }, async position => { actions.push(['seen', position]); }, async () => { actions.push(['history', { s: 0, e: 1 }]); });
  assert.deepEqual(actions, [['seen', { s: 0, e: 0 }], ['history', { s: 0, e: 1 }]]);
});
test('starting or resuming an episode never marks that episode as seen', async () => {
  let marks = 0, saves = 0;
  for (const previous of [null, { s: 1, e: 2 }]) {
    await commitEpisodeTransition(previous, { s: 1, e: 2 }, async () => { marks++; }, async () => { saves++; });
  }
  assert.equal(marks, 0); assert.equal(saves, 2);
});
test('moving to a new season completes the previous episode without marking skipped episodes', async () => {
  const marks = [];
  await commitEpisodeTransition({ s: 0, e: 8 }, { s: 1, e: 0 }, async position => { marks.push(position); }, async () => {});
  assert.deepEqual(marks, [{ s: 0, e: 8 }]);
});

test('resume follows the viewing history, newest first, and keeps movies until their credits', async () => {
  const { continueWatchingEntries, resumeStart, episodeFinished } = await import('./watch-progress.ts');
  const rows = [
    { media_id: 1, type: 'movie', current_time: 3000, duration: 6000, updated_at: '2026-10-01' },
    { media_id: 2, type: 'movie', current_time: 5700, duration: 6000, updated_at: '2026-10-03' },
    { media_id: 3, type: 'series', current_time: 2500, duration: 2600, season_number: 2, episode_number: 5, updated_at: '2026-10-04' },
    { media_id: 4, type: 'movie', current_time: 20, duration: 6000, updated_at: '2026-10-05' },
    { media_id: 5, type: 'series', current_time: 900, duration: 2600, season_number: 1, episode_number: 2, updated_at: '2026-10-02' },
    { media_id: 6, type: 'movie', current_time: 600, duration: 6000, updated_at: '2026-10-06' },
  ];
  const entries = continueWatchingEntries(rows, id => id !== '6');
  assert.deepEqual(entries.map(entry => entry.id), ['3', '5', '1']);
  assert.equal(entries[0].finished, true);
  assert.equal(entries[1].finished, false);
  assert.equal(entries[2].ratio, .5);
  assert.equal(resumeStart(125), 120);
  assert.equal(resumeStart(12), 0);
  assert.equal(episodeFinished(2500, 2600), true);
  assert.equal(episodeFinished(2000, 2600), false);
});

test('a movie reaching its end credits leaves the resume row', async () => {
  const { isMostlyWatched } = await import('./watch-progress.ts');
  assert.equal(isMostlyWatched(92, 100), true);
  assert.equal(isMostlyWatched(70, 100), false);
  assert.equal(isMostlyWatched(0, 0), false);
  assert.equal(isMostlyWatched(Number.NaN, 100), false);
});
