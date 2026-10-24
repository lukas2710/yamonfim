import test from 'node:test';import assert from 'node:assert/strict';
import { createResourceCache } from './resource-cache.ts';
test('returning to a resource reuses the response instead of repeating the request',async()=>{
 const cache=createResourceCache();let reads=0;const load=()=>Promise.resolve({title:'Film',read:++reads});
 assert.deepEqual(await cache.read('catalogue',load),await cache.read('catalogue',load));assert.equal(reads,1);
});
test('concurrent preparations and navigation share one request',async()=>{
 const cache=createResourceCache();let reads=0,finish;const load=()=>{reads++;return new Promise(resolve=>{finish=resolve;});};
 const a=cache.read('film',load),b=cache.read('film',load);await Promise.resolve();finish('loaded');assert.equal(await a,await b);assert.equal(reads,1);
});
test('expired metadata is fetched again',async()=>{
 let now=0,reads=0;const cache=createResourceCache(3,()=>now),load=()=>Promise.resolve(++reads);
 assert.equal(await cache.read('x',load,60),1);now=61;assert.equal(await cache.read('x',load,60),2);
});
test('logout or mutation clears cached data and late responses cannot repopulate it',async()=>{
 const cache=createResourceCache();let finish;const pending=cache.read('private',()=>new Promise(resolve=>{finish=resolve;}));await Promise.resolve();cache.clear();finish('old account');await pending;assert.equal(cache.get('private'),undefined);
 assert.equal(await cache.read('private',()=>Promise.resolve('new account')),'new account');
});
test('cache is bounded and keeps recently used resources',()=>{
 const cache=createResourceCache(2);cache.set('a',1);cache.set('b',2);cache.get('a');cache.set('c',3);assert.equal(cache.get('b'),undefined);assert.equal(cache.get('a'),1);
});
test('failed requests are not cached or kept in flight',async()=>{
 const cache=createResourceCache();await assert.rejects(cache.read('x',()=>Promise.reject(new Error('network'))),/network/);assert.equal(await cache.read('x',()=>Promise.resolve('retry')),'retry');
});
