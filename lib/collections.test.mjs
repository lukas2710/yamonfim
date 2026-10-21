import test from 'node:test';
import assert from 'node:assert/strict';
import { collectionItems, collectionPayload, safeCollectionImage } from './collections.ts';
const catalogue = [{id:1,title:'Fast & Furious',type:'movie',poster:''},{id:'star-wars',title:'Star Wars',type:'movie',poster:''}];
const draft = {title:'  Une saga  ',description:' Test ',cover_url:'',media_ids:['star-wars','1'],active:true,position:0};
test('collections preserve the chosen order and match numeric catalogue identifiers',()=>{
  assert.deepEqual(collectionItems(draft,catalogue).map(x=>x.id),['star-wars',1]);
});
test('duplicate and removed titles are omitted without modifying the catalogue',()=>{
  assert.deepEqual(collectionItems({media_ids:['1','gone','1']},catalogue).map(x=>x.id),[1]);
  assert.equal(catalogue.length,2);
});
test('saving normalizes titles and uses only existing catalogue titles',()=>{
  assert.deepEqual(collectionPayload({...draft,media_ids:['1','gone','1']},catalogue),{title:'Une saga',description:'Test',cover_url:'',media_ids:['1'],active:true,position:0});
});
test('empty selections, invalid positions and unsafe covers cannot be saved',()=>{
  for(const update of [{title:' '},{media_ids:[]},{media_ids:['missing']},{position:-1},{position:1.5},{position:10000},{cover_url:'javascript:alert(1)'},{description:'x'.repeat(1001)}]) assert.throws(()=>collectionPayload({...draft,...update},catalogue));
  assert.equal(safeCollectionImage('data:text/html,test'),'');
  assert.equal(safeCollectionImage(' https://example.test/cover.jpg '),'https://example.test/cover.jpg');
});
test('draft visibility and collection order survive saving',()=>{
  assert.equal(collectionPayload({...draft,active:false,position:5},catalogue).active,false);
  assert.equal(collectionPayload({...draft,position:5},catalogue).position,5);
});
