import test from 'node:test';
import assert from 'node:assert/strict';
import { introDbCredits, communityCredits, skipDbCredits, reachedEpisodeCredits, compatibleCredits, playbackCreditsMarker, episodeCreditsDecision } from './episode-credits.ts';
import { parseCreditsTime } from './credits-time.ts';
const payload = extra => ({ type: 'tv', season: 1, episode: 2, group_duration_ms: 3000000, credits: [{ start_ms: 2942000, end_ms: null, confidence: .95 }], ...extra });
test('advances at the per-episode credits marker, never a fixed 90-second offset', () => {
  const marker = introDbCredits(payload(), 1, 2, 3000);
  assert.equal(marker.start, 2942);
  assert.equal(reachedEpisodeCredits(2910, 3000, marker), false);
  assert.equal(reachedEpisodeCredits(2941.99, 3000, marker), false);
  assert.equal(reachedEpisodeCredits(2942, 3000, marker), true);
});
test('missing, low-confidence or other-episode data never cuts the ending', () => {
  assert.equal(introDbCredits(null, 1, 2, 3000), null);
  assert.equal(introDbCredits(payload({ credits: [null] }), 1, 2, 3000), null);
  assert.equal(introDbCredits(payload({ episode: 3 }), 1, 2, 3000), null);
  assert.equal(introDbCredits(payload({ credits: [{ start_ms: 2942000, end_ms: null, confidence: .25 }] }), 1, 2, 3000), null);
  assert.equal(reachedEpisodeCredits(2999, 3000, null), false);
});
test('a different video release duration rejects otherwise valid markers', () => {
  assert.equal(introDbCredits(payload(), 1, 2, 3020), null);
  assert.equal(introDbCredits(payload(), 1, 2, 3001)?.start, 2942);
  assert.equal(compatibleCredits(2900, Infinity, 3000), false);
  assert.equal(compatibleCredits(2900, 3000, NaN), false);
  assert.equal(compatibleCredits(20, 120, 120), false);
});
test('only final credits can trigger, preserving scenes between credit segments', () => {
  const marker = introDbCredits(payload({ credits: [{ start_ms: 2880000, end_ms: 2900000, confidence: 1 }, { start_ms: 2960000, end_ms: null, confidence: .9 }] }), 1, 2, 3000);
  assert.equal(marker.start, 2960);
});
test('community fallback checks identity, end duration, confidence and post-credit scenes', () => {
  const data = { imdb_id: 'tt1234567', media_type: 'tv', season: 1, episode: 2, outro: { start_sec: 2942, end_sec: 3000, confidence: 1 }, post_credits: null };
  assert.equal(communityCredits(data, 'tt1234567', 1, 2, 3000).start, 2942);
  assert.equal(communityCredits(data, 'tt9999999', 1, 2, 3000), null);
  assert.equal(communityCredits(data, 'tt1234567', 1, 2, 3020), null);
  assert.equal(communityCredits({ ...data, post_credits: { start_sec: 2990 } }, 'tt1234567', 1, 2, 3000), null);
});
test('five second notice begins at the marker and fallback remains thirty seconds', () => {
 const marker={start:2800,duration:3000,source:'IntroDB'};
 assert.deepEqual(episodeCreditsDecision(2799,3000,marker,false,false,true),{advance:false,countdown:null});
 for(let n=5;n>=1;n--) assert.deepEqual(episodeCreditsDecision(2805-n,3000,marker,false,false,true),{advance:false,countdown:n});
 assert.equal(episodeCreditsDecision(2805,3000,marker,false,false,true).advance,true);
 assert.equal(episodeCreditsDecision(2970,3000,null,false,false,true).advance,true);
 assert.equal(episodeCreditsDecision(2805,3020,marker,false,false,true).advance,true);
 assert.equal(episodeCreditsDecision(2970,3000,null,true,false,true).advance,false);
 assert.equal(episodeCreditsDecision(2970,3000,null,false,true,true).advance,false);
 assert.equal(episodeCreditsDecision(2970,3000,null,false,false,false).advance,false);
 assert.deepEqual(episodeCreditsDecision(2900,3000,null,false,false,true),{advance:false,countdown:null});
});
test('manual override may use any valid point and honors pause and cancellation', () => {
 const marker = { start: 1500, duration: 3000, source: 'admin' };
 assert.equal(episodeCreditsDecision(1500,3000,marker,false,false,true).countdown,5);
 assert.equal(episodeCreditsDecision(1505,3000,marker,false,false,true).advance,true);
 assert.equal(episodeCreditsDecision(1505,3000,marker,true,false,true).advance,false);
 assert.equal(episodeCreditsDecision(1505,3000,marker,false,true,true).advance,false);
});
test('SkipDB accepts only exact releases and rejects previews and malformed data', () => {
 const data = { imdb_id: 'tt1234567', season: 1, episode: 2, segments: { outro: { start_ms: 2942000, end_ms: 3000000, confidence: .9, match: 'exact' }, preview: null } };
 assert.equal(skipDbCredits(data,'tt1234567',1,2,3000)?.start,2942);
 assert.equal(skipDbCredits(data,'tt1234567',1,3,3000),null);
 assert.equal(skipDbCredits(data,'tt1234567',1,2,3020),null);
 assert.equal(skipDbCredits({...data,segments:{...data.segments,preview:{start_ms:2990000}}},'tt1234567',1,2,3000),null);
 assert.equal(skipDbCredits(null,'tt1234567',1,2,3000),null);
});
test('manual time parsing validates minutes, hours and bounds', () => {
 assert.equal(parseCreditsTime('42:15'),2535);
 assert.equal(parseCreditsTime('1:02:15'),3735);
 assert.equal(parseCreditsTime('00:00'),0);
 for(const input of ['42:99','-1:00','8:00:00','42','1:2:15','NaN','']) assert.equal(parseCreditsTime(input),null);
});


test('Lupin release padding keeps imported timings and works with the TV 2.4.1 clock', () => {
  for (const [start, reference, actual] of [[2773.84,2829.07,2834.743],[3075.42,3133.5,3136.567]]) {
    const stored = { start, duration: reference, source: 'IntroDB' };
    const playback = playbackCreditsMarker(stored, actual);
    assert.equal(playback.start, start);
    assert.equal(playback.duration, actual);
    assert.equal(playback.referenceDuration, reference);
    assert.equal(stored.duration, reference);
    assert.equal(episodeCreditsDecision(start,actual,playback,false,false,true).countdown,5);
    assert.equal(episodeCreditsDecision(start+5,actual,playback,false,false,true).advance,true);
    assert.equal(playbackCreditsMarker(stored,reference+20)?.start,start);
  }
});
