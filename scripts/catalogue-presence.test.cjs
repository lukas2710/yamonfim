const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const ts = require('typescript');
function fixture(data) {
  const identity = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/content-identity.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, { exports: identity, URL });
  const node = () => ({ append() {}, setAttribute() {}, replaceChildren() {} });
  const context = { data, catalogueIdentity: identity, valid: new Set(data.map(item => String(item.source_id))), Map, Set, URL, URLSearchParams, Date, AbortSignal, location: { origin: 'null', protocol: 'file:' }, document: { createElement: node, querySelector: node }, window: { addEventListener() {}, yfNews: new Map() }, dbDone: new Set(), unavailableImports: new Map(), render() {} };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('scripts/catalogue-direct-import.js', 'utf8') + '\n' + fs.readFileSync('scripts/catalogue-presence.js', 'utf8') + '\ncatalogueStatusReady=true; globalThis.reconcile=reconcileCatalogueRows; globalThis.button=importButton; globalThis.hidden=hideCatalogueItem; globalThis.setUnavailable=rows=>{unavailableImports=new Map(rows)};', context);
  return context;
}
test('real catalogue cards recognize both reported films and disable addition after reload', () => {
  const html = fs.readFileSync('public/catalogues/catalogue-films-moviez.html', 'utf8');
  const start = html.indexOf('const data=') + 'const data='.length;
  let end = start, depth = 0, quoted = false, escaped = false;
  for (; end < html.length; end++) {
    const char = html[end];
    if (quoted) { if (escaped) escaped = false; else if (char === '\\') escaped = true; else if (char === '"') quoted = false; }
    else if (char === '"') quoted = true;
    else if (char === '[') depth++;
    else if (char === ']' && --depth === 0) { end++; break; }
  }
  const data = JSON.parse(html.slice(start, end));
  const api = fixture(data);
  const rows = [
    { id: 268, title: 'Spider-Man : Brand New Day', type: 'movie', tmdb_id: null, url: '<iframe src="https://api.moviez.ac/969681?autoplay=1"></iframe>' },
    { id: 482, title: 'Vaiana, la légende du bout du monde', type: 'movie', tmdb_id: null, url: '<iframe src="https://api.moviez.ac/1108427?autoplay=1"></iframe>' },
  ];
  const found = api.reconcile(rows);
  assert.equal(found.has('1108427'), true); assert.equal(found.has('969681'), true);
  api.dbDone = new Set(found.keys());
  for (const id of ['1108427', '969681']) {
    const item = data.find(item => String(item.source_id) === id);
    assert.ok(item);
    assert.equal(api.button(item).disabled, true);
    assert.match(api.button(item).textContent, /Ajouté sur le site/);
  }
});
test('title fallback never marks all remakes as added', () => {
  const data = [{ kind: 'movie', source_id: 1, title: 'Dune', year: 1984 }, { kind: 'movie', source_id: 2, title: 'Dune', year: 2021 }];
  const api = fixture(data);
  assert.equal(api.reconcile([{ type: 'movie', title: 'Dune' }]).size, 0);
  assert.equal(api.reconcile([{ type: 'movie', title: 'Dune (1984)' }]).has('1'), true);
  const identified = api.reconcile([{ type: 'movie', title: 'Dune', url: 'https://api.moviez.ac/2' }]);
  assert.equal(identified.has('1'), false); assert.equal(identified.has('2'), true);
});
test('an empty film card never marks the catalogue title as added', () => {
  const api = fixture([{ kind: 'movie', source_id: 1, title: 'Avengers : Doomsday', year: 2026 }]);
  assert.equal(api.reconcile([{ type: 'movie', title: 'Avengers : Doomsday', tmdb_id: null, url: '', embedUrl: '' }]).size, 0);
  assert.equal(api.reconcile([{ type: 'movie', title: 'Avengers : Doomsday', tmdb_id: null, url: 'https://example.test/film', embedUrl: '' }]).has('1'), true);
});
function syncFixture(fetch, overrides = {}) {
  const api = fixture([{ kind: 'movie', source_id: 1, title: 'Un', year: 2020 }, { kind: 'movie', source_id: 2, title: 'Deux', year: 2021 }]);
  const nodes = {};
  Object.assign(api, { $: selector => nodes[selector] ||= { textContent: '' }, syncing: false, lastSync: null, cachedCatalogueRows: null, cachedCatalogueAt: 0, importStates: new Map(), genreCache: new Map(), updateGenreOptions() {}, rebuildDone() {}, saveUnavailableImports() {}, databaseUrl: 'https://db.example.test', publicKey: 'k', setTimeout() {}, fetch, ...overrides });
  vm.runInContext('globalThis.sync = syncDatabase; globalThis.seen = () => [...dbDone]; globalThis.ready = () => catalogueStatusReady;', api);
  return api;
}
const preparedRows = { ok: true, json: async () => [{ id: 10, title: 'Un', type: 'movie', tmdb_id: '1' }] };
test('the prepared catalogue is read once, then only the latest additions', async () => {
  const asked = [], latest = [];
  const api = syncFixture(async url => { const prepared = url === '/api/catalogue'; asked.push(prepared ? 'prepared' : 'latest'); return prepared ? preparedRows : { ok: true, json: async () => latest }; });
  await api.sync();
  assert.deepEqual([...api.seen()], ['1']);
  latest.push({ id: 11, title: 'Deux', type: 'movie', tmdb_id: '2', url: 'x', embedUrl: 'x' });
  await api.sync();
  assert.deepEqual(asked, ['prepared', 'latest', 'latest']);
  assert.deepEqual([...api.seen()].sort(), ['1', '2']);
});
test('a failed read of the latest rows never locks the add buttons', async () => {
  for (const latest of [async () => { throw new Error('timeout'); }, async () => ({ ok: false, json: async () => ({}) })]) {
    const api = syncFixture(async url => url === '/api/catalogue' ? preparedRows : latest());
    await api.sync();
    assert.equal(api.ready(), true);
    assert.deepEqual([...api.seen()], ['1']);
  }
});
test('without the prepared catalogue the check tries again within seconds', async () => {
  const timers = [];
  let down = true;
  const api = syncFixture(async url => { if (url === '/api/catalogue' && down) throw new Error('offline'); return url === '/api/catalogue' ? preparedRows : { ok: true, json: async () => [] }; }, { setTimeout(run, delay) { timers.push({ run, delay }); } });
  vm.runInContext('catalogueStatusReady = false;', api);
  await api.sync();
  assert.equal(api.ready(), false);
  assert.equal(timers.length, 1); assert.equal(timers[0].delay, 5000);
  down = false;
  await api.sync();
  assert.equal(api.ready(), true);
  assert.equal(timers.length, 1);
});
test('two separate PCs recognize the same persisted additions without sharing local annotations', () => {
  const data = [{ kind: 'movie', source_id: 969681, title: 'Spider-Man : Brand New Day', year: 2026 }];
  const firstPC = fixture(data), secondPC = fixture(data);
  assert.equal(firstPC.button(data[0]).disabled, false);
  assert.equal(secondPC.button(data[0]).disabled, false);
  const persistedRows = [{ type: 'movie', title: data[0].title, url: 'https://api.moviez.ac/969681', tmdb_id: null }];
  firstPC.dbDone = new Set(firstPC.reconcile(persistedRows).keys());
  secondPC.dbDone = new Set(secondPC.reconcile(persistedRows).keys());
  assert.equal(firstPC.button(data[0]).disabled, true);
  assert.equal(secondPC.button(data[0]).disabled, true);
});
test('downloadable pages use server-backed checks and a one minute refresh', () => {
  for (const name of ['catalogue-films-moviez.html', 'catalogue-series-moviez.html']) {
    const html = fs.readFileSync('public/catalogues/' + name, 'utf8');
    assert.ok(html.includes('href="catalogues-yamonfim.zip" download'));
    assert.ok(html.includes('function rebuildDone(){done=new Set(dbDone)}'));
    assert.ok(html.includes('setInterval(()=>{if(!document.hidden)syncDatabase()},60000)'));
    assert.ok(!html.includes('15 secondes'));
    assert.ok(html.includes('check.disabled=true;'));
    assert.ok(html.includes('data.filter(x=>!hideCatalogueItem(x,filter)'));
    assert.ok(html.includes('window.yfNews=yfNews'));
  }
});
test('every title confirmed unavailable is listed in its catalogue page', () => {
  const unavailable = require('./catalogue-unavailable.json');
  for (const [kind, name] of [['movie', 'catalogue-films-moviez.html'], ['series', 'catalogue-series-moviez.html']]) {
    const html = fs.readFileSync('public/catalogues/' + name, 'utf8');
    const listed = JSON.parse(html.match(/const catalogueUnavailable=(\[[\d,]*\]);/)[1]);
    assert.deepEqual(listed, unavailable[kind].map(row => row.id));
    assert.ok(listed.length > 0);
  }
});
test('unavailable titles disappear and already-added movie news stays hidden', () => {
  const data = [{ kind: 'movie', source_id: 1, title: 'Indisponible', year: 2020 }, { kind: 'movie', source_id: 2, title: 'Déjà ajouté', year: 2021 }, { kind: 'movie', source_id: 3, title: 'À compléter', year: 2022 }];
  const api = fixture(data);
  api.setUnavailable([['1', 'Non disponible']]);
  api.dbDone.add('2');
  api.window.yfNews.set('2', { label: 'Déjà sorti' });
  api.window.yfNews.set('3', { label: 'Nouvelle sortie' });
  assert.equal(api.hidden(data[0], 'all'), true);
  assert.equal(api.hidden(data[1], 'news'), true);
  assert.equal(api.hidden(data[2], 'news'), false);
  api.window.yfNews.set('2', { update: true, label: 'Nouvelle saison' });
  assert.equal(api.hidden(data[1], 'news'), false);
});
