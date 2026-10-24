import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBannerEntry, bannerEntry, findSeason } from './banner-items.ts';

test('existing banners made of plain media ids keep working', () => {
  assert.deepEqual(parseBannerEntry('156'), { mediaId: '156', season: null });
  assert.deepEqual(parseBannerEntry(156), { mediaId: '156', season: null });
});

test('a season entry round-trips', () => {
  assert.equal(bannerEntry(156, 3), '156:s3');
  assert.deepEqual(parseBannerEntry('156:s3'), { mediaId: '156', season: 3 });
  assert.equal(bannerEntry('156'), '156');
});

test('seasons are found by number even when numbering skips', () => {
  const seasons = [{ seasonNumber: 1 }, { seasonNumber: 2 }, { seasonNumber: 4, poster_path: 'p4' }];
  assert.deepEqual(findSeason(seasons, 4), { index: 2, season: { seasonNumber: 4, poster_path: 'p4' } });
  assert.equal(findSeason(seasons, 3), null);
  assert.deepEqual(findSeason([{}, {}], 2), { index: 1, season: {} });
  assert.equal(findSeason(null, 1), null);
});
