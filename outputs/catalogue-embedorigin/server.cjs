const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const root = __dirname;
const token = fs.existsSync(path.join(root, 'token.txt')) ? fs.readFileSync(path.join(root, 'token.txt'), 'utf8') : crypto.randomBytes(24).toString('hex');
fs.writeFileSync(path.join(root, 'token.txt'), token);
const groups = ['films', 'series'].map(kind => {
  const html = fs.readFileSync(path.join(root, `../../public/catalogues/catalogue-${kind}-moviez.html`), 'utf8');
  return JSON.parse(html.match(/const data=(\[.*?\]);/s)[1]);
});
// Finish films before beginning series; retain saved results for both.
const candidates = groups.flat();
const statePath = path.join(root, 'resultats.json');
const state = fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath, 'utf8')) : { items: {}, tested: 0, errors: 0 };
let running = false, current = '', stop = false;
function writePage() {
  const snapshot = { ...state, items: Object.fromEntries(Object.entries(state.items).filter(([, x]) => x.links.length)), total: candidates.length, examined: Object.keys(state.items).length, running: false, current: '' };
  const html = fs.readFileSync(path.join(root, 'page.html'), 'utf8').replaceAll('__TOKEN__', token).replace('__DATA__', JSON.stringify(snapshot).replace(/</g, '\\u003c'));
  const client = fs.readFileSync(path.join(root, 'import-client.js'), 'utf8').replace(/<\/script/gi, '<\\/script');
  fs.writeFileSync(path.join(root, 'Catalogue EmbedOrigin.html'), html.replace('<!--LOCAL_CLIENT-->', () => '<script>' + client + '</script>'));
}
function save() { fs.writeFileSync(statePath + '.tmp', JSON.stringify(state)); fs.renameSync(statePath + '.tmp', statePath); writePage(); }
async function remote(url, json = true) {
  const r = await fetch(url, { signal: AbortSignal.timeout(15000), headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!r.ok) throw Error(`HTTP ${r.status}`);
  return json ? r.json() : r.text();
}
function embeds(value, result = [], context = {}) {
  if (typeof value === 'string' && /^https:\/\/embedorigin\.cc\/e\/[a-z0-9]{12}\/?$/.test(value)) result.push({ url: value, ...context });
  else if (Array.isArray(value)) value.forEach(v => embeds(v, result, context));
  else if (value && typeof value === 'object') {
    const next = { ...context, ...((value.season_number || value.season) ? { season: value.season_number || value.season } : {}), ...((value.episode_number || value.episode) ? { episode: value.episode_number || value.episode } : {}) };
    Object.entries(value).filter(([k]) => !['tmdb_details', 'overview'].includes(k)).forEach(([, v]) => embeds(v, result, next));
  }
  return result.filter((v, i, a) => a.findIndex(x => x.url === v.url && x.season === v.season && x.episode === v.episode) === i);
}
async function testEmbed(url) {
  const code = new URL(url).pathname.split('/')[2];
  const data = await remote(`https://embedorigin.cc/app/v1/play/${code}?embed=1`);
  if (typeof data.hls !== 'string' || !data.hls.startsWith('https://')) throw Error('Aucun HLS');
  const manifest = await remote(data.hls, false);
  if (!manifest.trimStart().startsWith('#EXTM3U')) throw Error('Manifeste invalide');
  const lines = manifest.split(/\r?\n/).map(x => x.trim());
  if (!lines.some(x => x.startsWith('#EXTINF:'))) {
    const variant = lines.find(x => x && !x.startsWith('#'));
    if (!variant) throw Error('Manifeste vide');
    const media = await remote(new URL(variant, data.hls).href, false);
    if (!media.trimStart().startsWith('#EXTM3U') || !media.includes('#EXTINF:')) throw Error('Variante invalide');
  }
  return { checkedAt: new Date().toISOString(), expiresAt: data.expires_at || null };
}
async function scan(limit) {
  if (running) return;
  running = true; stop = false;
  const todo = candidates.filter(x => !state.items[`${x.kind}:${x.source_id}`]?.complete).slice(0, limit);
  let cursor = 0;
  try {
    await Promise.all(Array.from({ length: 2 }, async () => {
      while (!stop && cursor < todo.length) {
        const item = todo[cursor++], key = `${item.kind}:${item.source_id}`;
        current = item.title;
        const type = item.kind === 'movie' ? 'movie' : 'tv', id = item.source_id;
        const paths = type === 'movie' ? ['links', 'tmdb', 'fstream', 'wiflix', 'j1f', 'swiftflow', 'cpasmal'].map(p => `${p}/movie/${id}`)
          : [`links/tv/${id}`, `tmdb/tv/${id}`, `fstream/tv/${id}/season/1`, `wiflix/tv/${id}/1`, `j1f/tv/${id}/season/1`, `swiftflow/tv/${id}/season/1`, `cpasmal/tv/${id}/1/1`];
        const links = [], errors = [];
        for (const p of paths) {
          try { links.push(...embeds(await remote(`https://api.movix.dog/api/${p}`))); }
          catch (e) { if (e.message !== 'HTTP 404') errors.push(`${p}: ${e.message}`); if (e.message === 'HTTP 429') { stop = true; break; } }
          await new Promise(r => setTimeout(r, 150));
        }
        const unique = embeds(links), tested = [];
        for (const link of unique) {
          try { tested.push({ ...link, ok: true, ...await testEmbed(link.url) }); }
          catch (e) { tested.push({ ...link, ok: false, error: e.message, checkedAt: new Date().toISOString() }); }
        }
        state.items[key] = { ...item, links: tested, errors, complete: errors.length === 0, scannedAt: new Date().toISOString() };
        state.tested++; state.errors += errors.length; save();
      }
    }));
  } finally { running = false; current = ''; save(); }
}
writePage();
http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1:48763');
  if (req.headers.host !== '127.0.0.1:48763' || url.searchParams.get('token') !== token || ![undefined, 'null'].includes(req.headers.origin)) { res.writeHead(403); return res.end(); }
  res.setHeader('Access-Control-Allow-Origin', 'null'); res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  try {
    if (req.method === 'POST' && url.pathname === '/scan') { void scan(url.searchParams.get('all') === '1' ? candidates.length : 100); return res.end(JSON.stringify({ ok: true })); }
    if (req.method === 'POST' && url.pathname === '/stop') { stop = true; return res.end('{}'); }
    if (req.method === 'GET' && url.pathname === '/data') return res.end(JSON.stringify({ running, current, total: candidates.length, ...state }));
    if (req.method === 'GET' && url.pathname === '/stream') {
      const link = Object.values(state.items).flatMap(x => x.links).find(x => x.url === url.searchParams.get('embed'));
      if (!link) throw Error('Lien absent du catalogue');
      const data = await remote(`https://embedorigin.cc/app/v1/play/${new URL(link.url).pathname.split('/')[2]}?embed=1`);
      return res.end(JSON.stringify({ hls: data.hls || '', expiresAt: data.expires_at }));
    }
    res.writeHead(404); res.end('{}');
  } catch (e) { res.writeHead(502); res.end(JSON.stringify({ error: e.message })); }
}).listen(48763, '127.0.0.1', () => console.log('Catalogue local prêt. Ouvrir Catalogue EmbedOrigin.html.'));
process.on('SIGINT', () => { save(); process.exit(); });
