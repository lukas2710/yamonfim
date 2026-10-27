const fs = require('node:fs');
const path = require('node:path');
const colors = {
  dc2626:'003cda', ef4444:'064cff', e50914:'003cda', b91c1c:'002ca6',
  '991b1b':'00217b', '7f1d1d':'102147', '450a0a':'071431',
  f87171:'87a5ff', fca5a5:'a3baff', fecaca:'becfff',
  f28b95:'a3baff', ed4f5d:'064cff', f16c79:'87a5ff', ec6474:'87a5ff',
  b85061:'5d7fe0', '331d25':'102147', '211014':'0c1730',
  '17090b':'09132b', '120c0e':'0b1327', '141012':'0c1428',
  '161114':'0c1428', '1b1216':'0c1428', '17131a':'0c1428',
  '6b192a':'112d69', '9a2837':'103995', d44455:'003cda', '9f273a':'003cda',
  '0a0a0b':'060a15', '09090b':'060a15', '080809':'060a15', '08080b':'060a15',
  '111113':'0c1428', '121214':'0c1428', '101012':'091124', '101013':'091124',
};
const files=[];
function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
  const file=path.join(dir,entry.name);
  if(entry.isDirectory())walk(file);else if(/\.(css|tsx)$/.test(file))files.push(file);
}}
walk('app'); walk('components');
const changed=[];
for(const file of files){
  if(file.endsWith('royal-theme.css'))continue;
  const original=fs.readFileSync(file,'utf8');let next=original;
  if(file.endsWith('.css')) next=next.replace(/#([\da-f]{6})([\da-f]{2})?\b/gi,(all,color,alpha)=>colors[color.toLowerCase()]?'#'+colors[color.toLowerCase()]+(alpha||''):all);
  next=next.replace(/rgba?\(239,\s*68,\s*68([,)])/g,(all,last)=>all.replace(/239,\s*68,\s*68/,'6,76,255'))
    .replace(/rgba?\(220,\s*38,\s*38([,)])/g,(all,last)=>all.replace(/220,\s*38,\s*38/,'0,60,218'));
  if(file.endsWith('.tsx')) next=next.replace(/YAMON\s*<span([^>]*)>FIM<\/span>/g,'YAMON<span$1>FILM</span>');
  if(file==='app'+path.sep+'page.tsx') next=next.replace('onClick={handleLogout}\n','onClick={handleLogout}\n').replace('className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-red-400','className="yf-danger flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-red-400').replace('<button type="button" onClick={() => handleMediaClick(featured, featured.heroStart ?? null)}','<button type="button" data-yf-play={!userLimitReached || undefined} onClick={() => handleMediaClick(featured, featured.heroStart ?? null)}');
  if(next!==original){fs.writeFileSync(file,next);changed.push(file);}
}
fs.writeFileSync('outputs/royal-theme-changed-files.json',JSON.stringify(changed,null,2));
console.log('Palette appliquée à '+changed.length+' fichiers de styles et de présentation.');
