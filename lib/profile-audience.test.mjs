import test from 'node:test';
import assert from 'node:assert/strict';
import {canWatch, releaseYear} from './profile-audience.ts';
test('child catalogue is opt-in and never infers safety from Animation', () => {
 assert.equal(canWatch({genres:['Animation']}, 'kids'),false);
 assert.equal(canWatch({audience:'junior'}, 'kids'),false);
 assert.equal(canWatch({audience:'kids'}, 'kids'),true);
 assert.equal(canWatch({audience:'kids'}, 'junior'),true);
 assert.equal(canWatch({audience:'junior'}, 'junior'),true);
 assert.equal(canWatch({audience:'standard'}, 'junior'),false);
 assert.equal(canWatch({}, 'standard'),true);
});
test('year supports explicit metadata and legacy title suffix without matching title numbers', () => {
 assert.equal(releaseYear({release_year:2020,title:'Film (1999)'}),2020);
 assert.equal(releaseYear({title:'Film (1999)'}),1999);
 assert.equal(releaseYear({title:'2001 : odyssée'}),null);
 assert.equal(releaseYear({release_year:9999}),null);
});
