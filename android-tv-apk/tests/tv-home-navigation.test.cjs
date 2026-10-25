const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');
const {JSDOM}=require('../.tools/dom-tests/node_modules/jsdom');
function setup(t){
 const html=Array.from({length:12},(_,r)=>`<section><div class="snap-x" data-row="${r}">${Array.from({length:30},(_,c)=>`<button class="yf-poster-card" data-col="${c}">${r}-${c}</button>`).join('')}</div></section>`).join('');
 const dom=new JSDOM(`<html><head></head><body><main><div id="catalogue-accueil">${html}</div></main></body></html>`,{runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window,d=w.document;let reads=0;
 w.HTMLElement.prototype.scrollIntoView=function(){};w.scrollBy=function(){};
 w.HTMLElement.prototype.getBoundingClientRect=function(){reads++;let row=this.closest('[data-row]'),r=row?Number(row.dataset.row):0,c=Number(this.dataset.col)||0;return {left:250+c*140,right:372+c*140,top:100+r*240,bottom:290+r*240,width:122,height:190};};
 w.eval(fs.readFileSync('android-tv-apk/app/src/main/assets/tv-navigation.js','utf8'));t.after(()=>w.close());return {w,d,reads:()=>reads,reset:()=>{reads=0;}};
}
test('horizontal navigation does not measure all 360 posters on the home page',t=>{const e=setup(t);e.d.querySelector('[data-row="0"] [data-col="0"]').focus();e.reset();e.w.YamonTv.move('ArrowRight');assert.equal(e.d.activeElement.textContent,'0-1');assert.ok(e.reads()<8,`rectangle reads: ${e.reads()}`);});
test('vertical navigation selects the same column in the next home row',t=>{const e=setup(t);e.d.querySelector('[data-row="0"] [data-col="2"]').focus();e.reset();e.w.YamonTv.move('ArrowDown');assert.equal(e.d.activeElement.textContent,'1-2');assert.ok(e.reads()<60,`rectangle reads: ${e.reads()}`);});
test('Right at the end of a home row stays on that row',t=>{const e=setup(t);const end=e.d.querySelector('[data-row="0"] [data-col="29"]');end.focus();e.w.YamonTv.move('ArrowRight');assert.equal(e.d.activeElement,end);});
