import test from 'node:test';
import assert from 'node:assert/strict';
import { hlsQuality, compareQuality } from './stream-quality.ts';
import { resolveBestCatalogueStream } from './catalogue-stream.ts';

test('reads resolution and bandwidth from actual HLS variants', () => {
  assert.deepEqual(hlsQuality('#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=2000000,RESOLUTION=1280x720\na.m3u8\n#EXT-X-STREAM-INF:BANDWIDTH=6000000,RESOLUTION=1920x1080\nb.m3u8'), { height: 1080, bandwidth: 6000000 });
  assert.deepEqual(hlsQuality('#EXTM3U\n#EXTINF:10,\na.ts'), { height: 0, bandwidth: 0 });
  assert.ok(compareQuality({ height: 2160, bandwidth: 5000000 }, { height: 1080, bandwidth: 8000000 }) > 0);
});
const primary='https://api.moviez.ac/123', fallback='https://embedorigin.cc/e/h8jlblj2cx1u';
const source={id:'123',type:'movie',season:1,episode:1};
const stream=height=>({url:'https://cdn.example/'+height+'.m3u8',audioTracks:[],quality:{height,bandwidth:height*1000}});
test('Moviez is first even when a faster higher-quality fallback exists', async()=>{
 let discoveries=0, others=0;
 const result=await resolveBestCatalogueStream({...source,embeds:[fallback]},[],new AbortController().signal,{
 primary:async()=>stream(720),embeds:async()=>{discoveries++;return [fallback]},resolve:async()=>{others++;return stream(2160)}
 });
 assert.equal(result.provider,'Moviez');assert.equal(result.quality.height,720);assert.equal(discoveries,0);assert.equal(others,0);
});
test('only EmbedOrigin fallback is tried after Moviez fails; Vidizi is excluded',async()=>{
 const attempted=[];
 const result=await resolveBestCatalogueStream({...source,embeds:['https://vidizi.example/e/abc',fallback]},[],new AbortController().signal,{
 primary:async()=>{attempted.push(primary);throw Error('offline')},embeds:async()=>[],resolve:async url=>{attempted.push(url);return stream(1080)}
 });
 assert.equal(result.embed,fallback);assert.deepEqual(attempted,[primary,fallback]);
});
test('excluded Moviez is not retried and incremental EmbedOrigin discovery need not finish',async()=>{
 let aborted=false;
 const result=await resolveBestCatalogueStream(source,[primary],new AbortController().signal,{
 primary:async()=>{throw Error('must not run')},
 embeds:(_,signal,onEmbeds)=>{onEmbeds([fallback]);return new Promise((_,reject)=>signal.addEventListener('abort',()=>{aborted=true;reject(Error('cancelled'))},{once:true}))},
 resolve:async()=>stream(720)
 });assert.equal(result.embed,fallback);assert.equal(aborted,true);
});
test('cancellation and absence of permitted sources do not launch anything',async()=>{
 const deps={primary:async()=>{throw Error('offline')},embeds:async()=>['https://vidizi.example/e/abc'],resolve:async()=>{throw Error('must not run')}};
 await assert.rejects(resolveBestCatalogueStream(source,[],new AbortController().signal,deps));
 const stop=new AbortController();stop.abort();await assert.rejects(resolveBestCatalogueStream(source,[],stop.signal,deps));
});
