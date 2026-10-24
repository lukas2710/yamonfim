import test from 'node:test';import assert from 'node:assert/strict';
import {fetchCatalogueCards,fetchCatalogueRows,CATALOGUE_CARD_COLUMNS} from './catalogue.ts';
function client(total,cap=250,failAt=Infinity,expectedColumns=CATALOGUE_CARD_COLUMNS){const seen=[];const mock={from(table){assert.equal(table,'media');let start=0,end=0,exact=false;const q={select(columns,opts){assert.equal(columns,expectedColumns);exact=opts?.count==='exact';return q;},order(){return q;},range(a,b){start=a;end=b;seen.push([a,b]);if(a>=failAt)return Promise.resolve({data:null,error:{message:'failed'},count:null});return Promise.resolve({data:Array.from({length:Math.max(0,Math.min(cap,total-a,b-a+1))},(_,i)=>({id:a+i,title:'Title '+(a+i)})),error:null,count:exact?total:null});}};return q;}};return {mock,seen};}
test('catalogue loads older titles past the default 1000-row limit with early pages',async()=>{const c=client(1251);const pages=[];const rows=await fetchCatalogueCards(c.mock,rows=>pages.push(rows.length));assert.equal(rows.length,1251);assert.equal(rows.at(-1).id,1250);assert.equal(pages[0],250);});
test('server row caps smaller than page size do not silently truncate the catalogue',async()=>{const c=client(271,100);const rows=await fetchCatalogueCards(c.mock);assert.equal(rows.length,271);assert.deepEqual(c.seen.map(r=>r[0]),[0,100,200]);});
test('home payload omits episode JSON and player URLs',()=>{assert.equal(CATALOGUE_CARD_COLUMNS.includes('seasons'),false);assert.equal(CATALOGUE_CARD_COLUMNS.split(',').includes('url'),false);});
test('later page failures are reported instead of pretending results are complete',async()=>{const c=client(501,250,250);await assert.rejects(()=>fetchCatalogueCards(c.mock),/catalogue/);});

test('admin full-record loading also covers catalogues exceeding 5000 titles',async()=>{
 const c=client(5001,100,Infinity,'*');const rows=await fetchCatalogueRows(c.mock,'*');
 assert.equal(rows.length,5001);assert.equal(rows.at(-1).id,5000);
});
