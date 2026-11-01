// Adds the week's news (from /api/catalogue-news, TMDB data) at the top of the
// standalone Moviez catalogue pages. Run alone to update the hosted pages, or
// from prepare-catalogue-import.cjs when they are regenerated.
const fs = require('node:fs');
const path = require('node:path');

const START = '<!-- yamonfim-news -->', END = '<!-- /yamonfim-news -->';
const style = `<style>.news{background:white;border:1px solid #e2e6ef;border-radius:14px;padding:20px;margin:24px 0}.news h2{font-size:20px;margin:0}.news .head{display:flex;justify-content:space-between;align-items:baseline;gap:12px;flex-wrap:wrap}.news .head p{margin:4px 0 0;font-size:13px}.news .chips{display:flex;gap:8px;flex-wrap:wrap;margin:14px 0}.news .chips button.active{background:#4f46e5;color:white;border-color:#4f46e5}.news .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:10px;max-height:520px;overflow:auto}.news .item{display:flex;gap:12px;padding:10px;border:1px solid #e8ecf3;border-radius:10px}.news .item img{width:46px;height:69px;object-fit:cover;border-radius:6px;background:#e8ecf3;flex-shrink:0}.news .item strong{display:block;font-size:14px;line-height:1.35}.news .item small{display:block;color:#637086;font-size:12px;margin-top:2px}.news .tags{display:flex;gap:5px;flex-wrap:wrap;margin-top:6px}.news .tag{font-size:11px;font-weight:700;border-radius:6px;padding:2px 7px;background:#eef2ff;color:#4338ca}.news .tag.new{background:#fee2e2;color:#b91c1c}.news .tag.ok{background:#dcfce7;color:#15803d}.news .tag.todo{background:#fef3c7;color:#b45309}.news .day{grid-column:1/-1;font-weight:750;font-size:14px;margin-top:6px;text-transform:capitalize}</style>`;

function script(kind) {
  return `<script>(()=>{const kind=${JSON.stringify(kind)};const box=document.getElementById('yfNews');const list=box.querySelector('.grid'),status=box.querySelector('.head p');let news=null,filter='all';
const inMoviez=id=>typeof data!=='undefined'&&data.some(x=>x.source_id===id);
const day=d=>{const t=new Date().toISOString().slice(0,10),y=new Date(Date.now()-864e5).toISOString().slice(0,10);return d===t?'Aujourd’hui':d===y?'Hier':new Date(d+'T12:00:00').toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'})};
const tag=(text,cls)=>{const s=document.createElement('span');s.className='tag '+(cls||'');s.textContent=text;return s};
function card(img,title,line,tags,href){const a=document.createElement(href?'a':'div');a.className='item';if(href){a.href=href;a.target='_blank';a.rel='noopener';a.style.color='inherit';a.style.textDecoration='none'}const i=document.createElement('img');i.alt='';i.loading='lazy';if(img)i.src=img;const d=document.createElement('div');const s=document.createElement('strong');s.textContent=title;const m=document.createElement('small');m.textContent=line;const t=document.createElement('div');t.className='tags';t.append(...tags);d.append(s,m,t);a.append(i,d);return a}
function render(){list.replaceChildren();if(!news)return;
if(kind==='movie'){const items=news.movies.filter(m=>filter==='all'||filter==='moviez'&&inMoviez(m.tmdb)||filter==='todo'&&!m.mediaId);
if(!items.length)list.textContent='Aucun film pour ce filtre.';
for(const m of items)list.append(card(m.poster,m.title,m.releaseDate?'Sortie le '+new Date(m.releaseDate+'T12:00:00').toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'}):'',[...(inMoviez(m.tmdb)?[tag('Dans la liste Moviez')]:[]),m.mediaId?tag('Déjà sur ton site ✓','ok'):tag('Pas encore sur ton site','todo')],m.mediaId?'/watch/'+m.mediaId:'https://www.themoviedb.org/movie/'+m.tmdb))}
else{const items=news.series.filter(s=>filter==='all'||filter==='season'&&s.newSeason||filter==='todo'&&s.missingFrom!==null);let last='';
if(!items.length)list.textContent='Aucune série pour ce filtre.';
for(const s of items){if(s.airDate!==last){last=s.airDate;const h=document.createElement('div');h.className='day';h.textContent=day(s.airDate);list.append(h)}
list.append(card(s.poster,s.title,'Saison '+s.season+' · épisode '+s.episode,[...(s.newSeason?[tag('Nouvelle saison','new')]:[]),s.missingFrom!==null?tag('Manquant sur ton site dès l’épisode '+s.missingFrom,'todo'):tag('Déjà sur ton site ✓','ok')],'/watch/'+s.mediaId))}}}
box.querySelectorAll('.chips button').forEach(b=>b.onclick=()=>{filter=b.dataset.filter;box.querySelectorAll('.chips button').forEach(x=>x.classList.toggle('active',x===b));render()});
fetch('/api/catalogue-news',{signal:AbortSignal.timeout(40000)}).then(r=>r.ok?r.json():Promise.reject()).then(n=>{news=n;const count=kind==='movie'?n.movies.length:n.series.length;status.textContent=count+(kind==='movie'?' films sortis en VOD ou en vidéo ces 14 derniers jours':' séries de ton site avec un épisode diffusé ces 7 derniers jours')+' · mis à jour le '+new Date(n.at).toLocaleString('fr-FR',{dateStyle:'medium',timeStyle:'short'})+' (TMDB)';render()}).catch(()=>{status.textContent='Nouveautés momentanément indisponibles. Recharge la page dans une minute.'});})();</script>`;
}

function block(kind) {
  const movie = kind === 'movie';
  const chips = movie
    ? '<button class="active" data-filter="all">Tous</button><button data-filter="moviez">Dans la liste Moviez</button><button data-filter="todo">Pas encore sur mon site</button>'
    : '<button class="active" data-filter="all">Toutes</button><button data-filter="season">Nouvelles saisons</button><button data-filter="todo">Épisodes manquants sur mon site</button>';
  return `${START}${style}<section id="yfNews" class="news" aria-label="Nouveautés"><div class="head"><div><div class="eyebrow">NOUVEAUTÉS</div><h2>${movie ? 'Nouveaux films' : 'Nouveaux épisodes et saisons'}</h2><p>Chargement…</p></div></div><div class="chips">${chips}</div><div class="grid"></div></section>${script(kind)}${END}`;
}

function injectNews(html, kind) {
  const start = html.indexOf(START), end = html.indexOf(END);
  if (start >= 0 && end > start) html = html.slice(0, start) + html.slice(end + END.length);
  const marker = '<section class="stats">';
  if (!html.includes(marker)) throw Error('Emplacement des nouveautés introuvable');
  return html.replace(marker, block(kind) + marker);
}
module.exports = { injectNews };

if (require.main === module) {
  const hosted = path.resolve(__dirname, '../public/catalogues');
  for (const [name, kind] of [['catalogue-films-moviez.html', 'movie'], ['catalogue-series-moviez.html', 'tv']]) {
    const file = path.join(hosted, name);
    fs.writeFileSync(file, injectNews(fs.readFileSync(file, 'utf8'), kind));
    process.stdout.write(name + ' : nouveautés ajoutées\n');
  }
}
