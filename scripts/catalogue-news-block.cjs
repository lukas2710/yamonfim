// Adds a « Nouveautés » filter to the standalone Moviez catalogue pages, fed by
// /api/catalogue-news (TMDB data): series of the site with new seasons or
// episodes, which the add button then completes, and recent films of the Moviez
// list not yet on the site. Run alone to update the hosted pages, or from
// prepare-catalogue-import.cjs when they are regenerated.
const fs = require('node:fs');
const path = require('node:path');

const START = '<!-- yamonfim-news -->', END = '<!-- /yamonfim-news -->';

function script(kind) {
  return `<script>(()=>{const kind=${JSON.stringify(kind)};const status=document.getElementById('yfNewsStatus');
const when=d=>new Date(d+'T12:00:00').toLocaleDateString('fr-FR',{day:'numeric',month:'long'});
// Runs after the catalogue script: wraps its add button for series to complete.
const baseButton=importButton;
importButton=function(item){const id=String(item.source_id),news=yfNews.get(id);if(!news||!news.update||!dbDone.has(id))return baseButton(item);
const state=importStates.get(id),button=document.createElement('button');button.className='link primary';
button.disabled=!catalogueStatusReady||!!(state&&(state.busy||state.ok));
button.textContent=state&&state.ok?'Nouveautés ajoutées ✓':state&&state.busy?'Ajout en cours…':state&&state.error?'Réessayer l’ajout':!catalogueStatusReady?'Vérification…':news.button;
button.title=state&&state.error||'Ajouter les nouveaux épisodes à la série de ton site';
button.onclick=()=>{if(!catalogueStatusReady||importStates.get(id)?.busy)return;if(!importPending&&!importQueue.length){bulkTotal=0;bulkFinished=0;bulkErrors=0}
importQueue.push({id,type:'series',job:crypto.randomUUID(),update:true});importStates.set(id,{busy:true});bulkTotal++;updateBulkStatus();sendImport();render()};return button};
let at=0;const describe=()=>{status.textContent=yfNews.size?yfNews.size+(kind==='movie'?' film(s) récent(s) de la liste à ajouter':' série(s) de ton site avec une nouvelle saison ou de nouveaux épisodes')+' · filtre « Nouveautés » · TMDB, mis à jour le '+new Date(at).toLocaleString('fr-FR',{dateStyle:'medium',timeStyle:'short'}):'Aucune nouveauté à ajouter pour le moment.'};
// Once the site confirms an addition, the title leaves the news at once.
window.addEventListener('message',event=>{const m=event.data;if(event.origin!==importSite||!m||m.action!=='catalogue:result'||m.ok!==true||!yfNews.has(String(m.id)))return;yfNews.delete(String(m.id));if(at)describe();render()});
fetch('/api/catalogue-news',{cache:'no-store',signal:AbortSignal.timeout(40000)}).then(r=>r.ok?r.json():Promise.reject()).then(n=>{at=n.at;
if(kind==='movie'){const listed=new Set(data.map(x=>x.source_id));for(const m of n.movies)if(!m.mediaId&&listed.has(m.tmdb))yfNews.set(String(m.tmdb),{label:'🆕 Sorti le '+when(m.releaseDate)})}
else for(const s of n.series)if(s.missingFrom!==null)yfNews.set(String(s.tmdb),{update:true,label:'🆕 '+(s.newSeason?'Nouvelle saison '+s.season:'Saison '+s.season+' : nouveaux épisodes dès l’épisode '+s.missingFrom)+' · diffusé le '+when(s.airDate),button:s.newSeason&&s.missingFrom===1?'Ajouter la saison '+s.season+' ＋':'Ajouter les nouveaux épisodes ＋'});
describe();render()}).catch(()=>{status.textContent='Nouveautés momentanément indisponibles. Recharge la page dans une minute.'});})();</script>`;
}

const FILTER = /(<div class="filters"><button data-filter="all" class="active">[^<]*<\/button>)/;
const CLAUSE = "(filter==='all'||(filter==='done'?done.has(String(x.source_id)):!done.has(String(x.source_id))))";
const YEAR = "year.textContent=x.year||'Année inconnue'";
function injectNews(html, kind) {
  for (let start; (start = html.indexOf(START)) >= 0;) {
    const end = html.indexOf(END, start);
    if (end < 0) throw Error('Bloc des nouveautés incomplet');
    html = html.slice(0, start) + html.slice(end + END.length);
  }
  if (!html.includes('data-filter="news"')) {
    if (!FILTER.test(html)) throw Error('Filtres introuvables');
    html = html.replace(FILTER, '$1<button data-filter="news">🆕 Nouveautés</button>');
  }
  if (!html.includes("filter==='news'")) {
    if (!html.includes(CLAUSE) || !html.includes(YEAR)) throw Error('Rendu du catalogue introuvable');
    html = html.replace(CLAUSE, "(filter==='all'||(filter==='news'?yfNews.has(String(x.source_id)):filter==='done'?done.has(String(x.source_id)):!done.has(String(x.source_id))))")
      .replace(YEAR, "year.textContent=(x.year||'Année inconnue')+(yfNews.has(id)?' · '+yfNews.get(id).label:'')")
      .replace('let done=new Set(),', 'const yfNews=new Map();let done=new Set(),');
    if (!html.includes('const yfNews=new Map();')) throw Error('Données du catalogue introuvables');
  }
  if (!html.includes('data.filter(x=>!hideCatalogueItem(x,filter)')) html = html.replace('data.filter(x=>x.search.includes(term)', 'data.filter(x=>!hideCatalogueItem(x,filter)&&x.search.includes(term)');
  if (!html.includes('window.yfNews=yfNews')) html = html.replace('const yfNews=new Map();let done=', 'const yfNews=new Map();window.yfNews=yfNews;let done=');
  html = html.replace('</div></section><div class="results">', `</div>${START}<p id="yfNewsStatus" class="note" role="status">Chargement des nouveautés…</p>${END}</section><div class="results">`);
  const body = html.lastIndexOf('</body>');
  if (body < 0 || !html.includes('yfNewsStatus')) throw Error('Emplacement des nouveautés introuvable');
  return html.slice(0, body) + START + script(kind) + END + html.slice(body);
}
module.exports = { injectNews };

if (require.main === module) {
  const hosted = path.resolve(__dirname, '../public/catalogues');
  for (const [name, kind] of [['catalogue-films-moviez.html', 'movie'], ['catalogue-series-moviez.html', 'tv']]) {
    const file = path.join(hosted, name);
    fs.writeFileSync(file, injectNews(fs.readFileSync(file, 'utf8'), kind));
    process.stdout.write(name + ' : filtre Nouveautés ajouté\n');
  }
}
