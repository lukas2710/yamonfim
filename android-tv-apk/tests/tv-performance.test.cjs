const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM}=require('../.tools/dom-tests/node_modules/jsdom');
const source=fs.readFileSync('android-tv-apk/app/src/main/assets/tv-performance.js','utf8');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
function setup(t,options={}){
 const dom=new JSDOM(`<html data-yamon-tv-section="home"><body><main class="yf-page yf-home"><div class="snap-x"><button class="yf-poster-card" aria-label="Film A"><img src="https://image.tmdb.org/t/p/w780/a.jpg"></button><button class="yf-poster-card" aria-label="Film B"><img src="https://image.tmdb.org/t/p/original/b.jpg"></button></div></main></body></html>`,{url:'https://yamonfim.vercel.app/',runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window,d=w.document;
 w.scrollTo=(x,y)=>{w.lastScroll=y;};
 const images=d.querySelectorAll('img');
 images.forEach((img,i)=>{img.getBoundingClientRect=()=>({left:0,right:120,top:i?3000:100,bottom:i?3180:280});});
 const observed=new Set();let callback;
 w.IntersectionObserver=class{constructor(fn){callback=fn;}observe(x){observed.add(x);}unobserve(x){observed.delete(x);}};
 w.localStorage.setItem('active_profile',JSON.stringify({id:options.profile||'one'}));
 if(options.record)w.sessionStorage.setItem('yamon-tv-position:one:/:home',JSON.stringify(options.record));
 if(options.playing)d.documentElement.setAttribute('data-tv-playback','true');
 w.eval(source);t.after(()=>w.close());return {w,d,images,observed,enter:image=>callback([{target:image,isIntersecting:true}])};
}
test('image resizing is limited to TMDB and never enlarges a small image',t=>{
 const {w}=setup(t);const resize=w.YamonTvPerformance.smallSource;
 assert.equal(resize('https://image.tmdb.org/t/p/original/a.jpg'),'https://image.tmdb.org/t/p/w342/a.jpg');
 assert.equal(resize('https://image.tmdb.org/t/p/w185/a.jpg'),'https://image.tmdb.org/t/p/w185/a.jpg');
 assert.equal(resize('https://example.org/original/a.jpg'),'https://example.org/original/a.jpg');
 assert.equal(resize('https://image.tmdb.org.evil.test/t/p/w780/a.jpg'),'https://image.tmdb.org.evil.test/t/p/w780/a.jpg');
});
test('nearby posters use smaller files while distant ones wait for intersection',async t=>{
 const e=setup(t);await delay(90);
 assert.equal(e.images[0].getAttribute('src'),'https://image.tmdb.org/t/p/w342/a.jpg');
 assert.match(e.images[1].getAttribute('src'),/^data:/);assert.ok(e.observed.has(e.images[1]));
 e.images[1].getBoundingClientRect=()=>({left:0,right:120,top:400,bottom:580});e.enter(e.images[1]);await delay(60);
 assert.equal(e.images[1].getAttribute('src'),'https://image.tmdb.org/t/p/w342/b.jpg');
 assert.equal(e.observed.has(e.images[1]),false);
});
test('poster processing pauses during playback and resumes after closing it',async t=>{
 const e=setup(t,{playing:true});await delay(70);
 assert.equal(e.images[0].getAttribute('src'),'https://image.tmdb.org/t/p/w780/a.jpg');
 e.d.documentElement.setAttribute('data-tv-playback','false');await delay(100);
 assert.equal(e.images[0].getAttribute('src'),'https://image.tmdb.org/t/p/w342/a.jpg');
});
test('selection and scroll are restored for the same profile and category',async t=>{
 const e=setup(t,{record:{time:Date.now(),label:'Film B',index:1,top:270,left:[420]}});await delay(260);
 assert.equal(e.d.activeElement.getAttribute('aria-label'),'Film B');assert.equal(e.w.lastScroll,270);
 assert.equal(e.d.querySelector('.snap-x').scrollLeft,420);
});
test('saved viewing position does not leak into a different profile',async t=>{
 const e=setup(t,{profile:'two',record:{time:Date.now(),label:'Film B',index:1,top:270,left:[420]}});await delay(260);
 assert.notEqual(e.d.activeElement.getAttribute('aria-label'),'Film B');
});
test('position records stay separate for each TV category',async t=>{
 const e=setup(t);await delay(260);e.d.querySelector('button').focus();e.w.YamonTvPerformance.save();
 assert.ok(e.w.sessionStorage.getItem('yamon-tv-position:one:/:home'));
 e.d.documentElement.setAttribute('data-yamon-tv-section','films');await delay(250);
 e.d.querySelectorAll('button')[1].focus();e.w.YamonTvPerformance.save();
 const value=JSON.parse(e.w.sessionStorage.getItem('yamon-tv-position:one:/:films'));assert.equal(value.label,'Film B');
 assert.equal(JSON.parse(e.w.sessionStorage.getItem('yamon-tv-position:one:/:home')).label,'Film A');
});


test('already downloaded images are kept to avoid another download',async t=>{
 const e=setup(t);Object.defineProperty(e.images[0],'complete',{value:true});Object.defineProperty(e.images[0],'naturalWidth',{value:780});
 await delay(90);assert.equal(e.images[0].getAttribute('src'),'https://image.tmdb.org/t/p/w780/a.jpg');
});
test('posters mounted after initial load also use progressive loading',async t=>{
 const e=setup(t);await delay(90);const image=e.d.createElement('img');image.src='https://image.tmdb.org/t/p/w780/new.jpg';
 image.getBoundingClientRect=()=>({left:0,right:120,top:6000,bottom:6180});e.d.querySelector('button').appendChild(image);
 await delay(90);assert.match(image.getAttribute('src'),/^data:/);assert.ok(e.observed.has(image));
});

test('poster work yields to a recent remote arrow press',async t=>{
 const e=setup(t);e.d.dispatchEvent(new e.w.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));
 await delay(80);assert.equal(e.images[0].getAttribute('src'),'https://image.tmdb.org/t/p/w780/a.jpg');
 await delay(180);assert.equal(e.images[0].getAttribute('src'),'https://image.tmdb.org/t/p/w342/a.jpg');
});
