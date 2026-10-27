const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '../..');
const modules = ['content-identity', 'content-duplicates', 'catalogue-source', 'catalogue-import'];
const compiled = modules.map(name => {
  const source = fs.readFileSync(path.join(root, 'lib', name + '.ts'), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  return `${JSON.stringify('./' + name)}:function(require,exports){${js}\n}`;
}).join(',\n');
const vendor = fs.readFileSync(path.join(root, 'node_modules/@supabase/supabase-js/dist/umd/supabase.js'), 'utf8');
const client = `
window.localDb = window.supabase.createClient('https://nftiussedwyjheqrmlbw.supabase.co','sb_publishable_a07rZpPFzuy0BgrmCsr_Kw_Mq-TQ8x5',{auth:{persistSession:false,autoRefreshToken:true,detectSessionInUrl:false}});
(function(){const modules={${compiled}},cache={
'./supabase':{supabase:window.localDb},
'./auth-session':{getPersistentSession:()=>window.localDb.auth.getSession()},
'./resource-cache':{clearClientResources:()=>{}}
};function require(name){if(cache[name])return cache[name];if(!modules[name])throw Error('Module local absent : '+name);const exports={};cache[name]=exports;modules[name](require,exports);return exports;}window.localCatalogueImporter=require('./catalogue-import');})();
`;
fs.writeFileSync(path.join(__dirname, 'import-client.js'), vendor + '\n' + client);
console.log('Client local construit à partir de l’importeur existant.');
