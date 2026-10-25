import test from 'node:test';
import assert from 'node:assert/strict';
import { playerTime, playerSeek, preferredAudioTrack, frenchFirstAudioTracks, audioTrackLabel } from './player-controls.ts';

test('shows hours for long films and handles unloaded durations', () => {
  assert.equal(playerTime(2650), '44:10');
  assert.equal(playerTime(7107.058), '1:58:27');
  assert.equal(playerTime(Infinity), '0:00');
  assert.equal(playerTime(-1), '0:00');
});
test('seeking stays inside the loaded video bounds', () => {
  assert.equal(playerSeek(-10, 2650), 0);
  assert.equal(playerSeek(2660, 2650), 2650);
  assert.equal(playerSeek(26.2, 2650), 26.2);
  assert.equal(playerSeek(10, NaN), 0);
});

test('audio preference follows the language rather than a track index between episodes', () => {
  const tracks = [{ id: 0, name: 'English', lang: 'eng' }, { id: 1, name: 'Français', lang: 'fr-FR' }];
  assert.equal(preferredAudioTrack(tracks, 'fra'), 1);
  assert.equal(preferredAudioTrack([...tracks].reverse(), 'en-US'), 0);
  assert.equal(preferredAudioTrack(tracks, 'ja'), null);
  assert.equal(preferredAudioTrack(tracks, ''), null);
  assert.equal(preferredAudioTrack([], 'fr'), null);
  assert.equal(audioTrackLabel(tracks[1]), 'Français');
  assert.match(audioTrackLabel({ id: 2, name: '', lang: 'en' }), /anglais/i);
});

test('French is listed first without changing the provider track identifiers', () => {
  const tracks = [{ id: 0, name: 'English', lang: 'en' }, { id: 1, name: 'Français', lang: 'fra' }];
  assert.deepEqual(frenchFirstAudioTracks(tracks).map(track => track.id), [1, 0]);
  assert.equal(tracks[0].id, 0);
  assert.equal(preferredAudioTrack(tracks, 'fr'), 1);
});
