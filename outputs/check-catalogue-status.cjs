const fs=require('node:fs');
const source=fs.readFileSync('lib/supabase.ts','utf8');
const base=source.match(/supabaseUrl\s*=\s*'([^']+)'/)[1];
const key=source.match(/supabaseAnonKey\s*=\s*'([^']+)'/)[1];
(async()=>{
const u=new URL('/rest/v1/media',base);u.search=new URLSearchParams({select:'id,title,type,tmdb_id,url,embedUrl',or:'(title.ilike.*vaiana*,title.ilike.*brand new*,tmdb_id.eq.1108427,tmdb_id.eq.969681)',limit:'100'});
const r=await fetch(u,{headers:{apikey:key},signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('HTTP '+r.status);const rows=await r.json();
console.log(JSON.stringify(rows.map(x=>({id:x.id,title:x.title,type:x.type,tmdb_id:x.tmdb_id,source:(x.url||x.embedUrl||'').slice(0,200)})),null,2));
})().catch(e=>{console.error(e.message);process.exitCode=1});
