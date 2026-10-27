const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const original = 'C:/Users/Admin/Documents/Codex/2026-10-22/je-x20/outputs';
const output = path.resolve(__dirname, '../outputs/catalogue-direct');
fs.mkdirSync(output, { recursive: true });
const hosted = path.resolve(__dirname, '../public/catalogues');
fs.mkdirSync(hosted, { recursive: true });
const bridge = fs.readFileSync(path.join(__dirname, 'catalogue-direct-import.js'), 'utf8');
const identity = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../lib/content-identity.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const presence = 'const catalogueIdentity = (() => { const exports = {};\n' + identity + '\nreturn exports; })();\n' + fs.readFileSync(path.join(__dirname, 'catalogue-presence.js'), 'utf8');
for (const name of ['catalogue-films-moviez.html', 'catalogue-series-moviez.html']) {
  let html = fs.readFileSync(path.join(original, name), 'utf8');
  if (html.includes('const importSite =')) {
    let start = html.indexOf('// Included inline in the two standalone catalogue pages (file://).');
    if (start < 0) start = html.indexOf('// The catalogue and background worker share');
    const end = html.indexOf('function render(){', start);
    if (start < 0 || end < 0) throw Error('Ancien bouton introuvable');
    html = html.slice(0, start) + bridge + '\n' + html.slice(end);
  } else {
    const marker = 'function render(){';
    if (!html.includes(marker)) throw Error('Structure du catalogue inconnue');
    html = html.replace(marker, bridge + '\n' + marker);
    const actions = "actions.className='actions';actions.append(";
    if (!html.includes(actions)) throw Error('Actions introuvables');
    html = html.replace(actions, "actions.className='actions';actions.append(importButton(x));actions.append(");
  }
  if (!html.includes('if(location.protocol==="file:")location.replace(')) html = html.replace('<head>', '<head><script>if(location.protocol==="file:")location.replace("https://yamonfi.netlify.app/catalogues/' + name + '");</script>');
  const presenceStart = html.includes('const catalogueIdentity =') ? html.indexOf('const catalogueIdentity =') : html.indexOf('async function syncDatabase(){');
  const presenceEnd = html.indexOf("$('#syncNow').onclick=syncDatabase;", presenceStart);
  if (presenceStart < 0 || presenceEnd < 0) throw Error('Suivi du catalogue introuvable');
  html = html.slice(0, presenceStart) + presence + '\n' + html.slice(presenceEnd);
  if (!html.includes('id="downloadCatalogues"')) html = html.replace('</nav><div class="eyebrow">', '<a id="downloadCatalogues" class="link primary" href="catalogues-yamonfim.zip" download>Télécharger les catalogues ↓</a></nav><p class="note">Même catalogue sur tous tes PC · ajouts synchronisés depuis le site toutes les 15 secondes. Connecte-toi avec ton compte administrateur pour ajouter des titres.</p><div class="eyebrow">');
  html = html.replace('function rebuildDone(){done=new Set([...manualDone,...dbDone])}', 'function rebuildDone(){done=new Set(dbDone)}');
  html = html.replace('check.disabled=dbDone.has(id);', 'check.disabled=true;');
  html = html.replace("text.textContent=dbDone.has(id)?'Ajouté sur ton site ✓':isDone?'Ajouté manuellement ✓':'Marquer comme ajouté'", "text.textContent=dbDone.has(id)?'Ajouté sur ton site ✓':'Pas encore ajouté au site'");
  html = html.replace("text.textContent=dbDone.has(id)?'Ajoutée sur ton site ✓':isDone?'Ajoutée manuellement ✓':'Marquer comme ajoutée'", "text.textContent=dbDone.has(id)?'Ajoutée sur ton site ✓':'Pas encore ajoutée au site'");
  html = html.replace('setInterval(()=>{if(!document.hidden)syncDatabase()},60000)', 'setInterval(()=>{if(!document.hidden)syncDatabase()},15000)');
  html = html.replace(/toutes les minutes/g, 'toutes les 15 secondes');
  html = html.replace('Garder une copie de ma progression', 'Anciennes annotations locales').replace('Exporte tes coches manuelles pour les conserver. Les coches automatiques sont récupérées depuis ton site à chaque connexion.', 'Les vrais ajouts au site sont synchronisés automatiquement entre tes PC. Cette sauvegarde conserve uniquement tes anciennes annotations locales.');
  html = html.replace(/Les (?:films|séries) sans identifiant TMDB ne peuvent pas être reconnus automatiquement\./g, 'Les anciens titres sont également reconnus grâce à leurs liens Moviez.').replace('Aucun ajout ni changement n’est envoyé à ta base.', 'Le bouton Ajouter au site est réservé au compte administrateur.');
  for (const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) new vm.Script(match[1]);
  fs.writeFileSync(path.join(output, name), html);
  fs.writeFileSync(path.join(hosted, name), html);
  process.stdout.write(name + ' : bouton ajouté, JavaScript valide\n');
}
