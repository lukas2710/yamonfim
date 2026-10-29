import test from 'node:test';
import assert from 'node:assert/strict';
import { inCategory, isJapaneseAnimation, withMangaGenre, hasFrenchAudio, withLanguageGenre, MANGA_GENRE, FOREIGN_GENRE } from './catalogue-categories.ts';

test('mangas and foreign-language titles leave Films and Séries for their own sections', () => {
  const film = { type: 'movie', genres: ['Action'] }, manga = { type: 'series', genres: [MANGA_GENRE] }, vost = { type: 'movie', genres: ['Drame', FOREIGN_GENRE] };
  assert.deepEqual([film, manga, vost].map(item => inCategory(item, 'movie')), [true, false, false]);
  assert.deepEqual([film, manga, vost].map(item => inCategory(item, 'series')), [false, false, false]);
  assert.deepEqual([film, manga, vost].map(item => inCategory(item, 'manga')), [false, true, false]);
  assert.deepEqual([film, manga, vost].map(item => inCategory(item, 'foreign')), [false, false, true]);
  assert.deepEqual([film, manga, vost].map(item => inCategory(item, 'all')), [true, true, true]);
});

test('only Japanese animation from TMDB is a manga, and it leaves the Animation genre', () => {
  assert.equal(isJapaneseAnimation({ genres: [{ id: 16 }], original_language: 'ja' }), true);
  assert.equal(isJapaneseAnimation({ genres: [{ id: 16 }, { id: 10759 }], original_language: 'en', origin_country: ['JP'] }), true);
  assert.equal(isJapaneseAnimation({ genres: [{ id: 16 }], original_language: 'en', origin_country: ['US'] }), false);
  assert.equal(isJapaneseAnimation({ genres: [{ id: 18 }], original_language: 'ja' }), false);
  assert.deepEqual(withMangaGenre(['Animation', 'Action'], true), [MANGA_GENRE, 'Action']);
  assert.deepEqual(withMangaGenre(['Animation', 'Action'], false), ['Animation', 'Action']);
});

test('a title is foreign only when its named audio tracks contain no French one', () => {
  assert.equal(hasFrenchAudio([{ name: 'Français (VF)', lang: 'fr' }]), true);
  assert.equal(hasFrenchAudio([{ name: 'French', lang: 'fre' }, { name: 'English', lang: 'eng' }]), true);
  assert.equal(hasFrenchAudio([{ name: 'Japanese', lang: 'jpn' }]), false);
  assert.equal(hasFrenchAudio([{ name: 'VOSTFR', lang: 'fr' }]), false);
  assert.equal(hasFrenchAudio([]), null);
  assert.equal(hasFrenchAudio([{ name: '', lang: '' }]), null);
  assert.deepEqual(withLanguageGenre(['Drame'], false), ['Drame', FOREIGN_GENRE]);
  assert.deepEqual(withLanguageGenre(['Drame', FOREIGN_GENRE], true), ['Drame']);
  assert.deepEqual(withLanguageGenre(['Drame'], null), ['Drame']);
});
