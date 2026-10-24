import test from 'node:test';
import assert from 'node:assert/strict';
import { withTimeout } from './with-timeout.ts';
test('a stalled request fails instead of leaving a loader forever',async()=>{
 await assert.rejects(withTimeout(new Promise(()=>{}),10,'Chargement trop long'),/Chargement trop long/);
});
test('successful content keeps its result and network errors stay visible',async()=>{
 assert.equal(await withTimeout(Promise.resolve('film'),100,'timeout'),'film');
 await assert.rejects(withTimeout(Promise.reject(new Error('network')),100,'timeout'),/network/);
});
test('a request finishing after its timeout cannot replace the failure',async()=>{
 let finish;const request=new Promise(resolve=>{finish=resolve;});const result=withTimeout(request,10,'timeout');
 await assert.rejects(result,/timeout/);finish('late film');await assert.rejects(result,/timeout/);
});
