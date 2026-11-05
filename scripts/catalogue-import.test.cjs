const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function setup({ admin = true, duplicate = false, available = true, series = false, locked = false, race = false, seasons = [{ season_number: 1, episode_count: 2 }], respond, saved, readError } = {}) {
  const inserts = [], calls = [], updates = [];
  let checks = 0, tail = Promise.resolve();
  const session = { user: { id: 'admin', email: admin ? 'lukas.leclerc312@gmail.com' : 'member@example.test' }, access_token: 'test-only' };
  const mocks = {
    './supabase': { supabase: { from: table => ({ insert: async rows => { inserts.push(...rows); return { error: race ? { code: '23505', message: 'YF_DUPLICATE_MEDIA' } : null }; }, select: () => ({ eq: () => ({ eq: () => ({ limit: () => ({ maybeSingle: async () => ({ data: saved || null, error: readError || null }) }) }) }) }), update: row => ({ eq: (column, value) => { updates.push({ row, column, value }); return Object.assign(Promise.resolve({ error: null }), { eq: async () => ({}) }); } }) }) } },
    './auth-session': { getPersistentSession: async () => ({ data: { session } }) },
    './content-duplicates': { checkContentDuplicate: async () => { checks++; return duplicate || (locked && inserts.length) || (race && checks >= 3) ? { item: { title: 'Existing' } } : null; } },
    './content-identity': { duplicateErrorMessage: (_, fallback) => fallback },
    './catalogue-source': { cataloguePlayer: source => `/api/catalogue-player?tmdb=${source.id}&type=${source.type}&season=${source.season}&episode=${source.episode}` },
    './resource-cache': { clearClientResources() {} },
  };
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync('lib/catalogue-import.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { exports, setTimeout: run => setImmediate(run), navigator: locked ? { locks: { request: (_, run) => { const result = tail.then(run); tail = result.catch(() => {}); return result; } } } : {}, require: name => mocks[name], AbortSignal, URLSearchParams, fetch: async (url, options) => {
    calls.push(url);
    const answer = respond?.(url, calls.filter(call => call === url).length);
    if (answer === 'network') throw new Error('offline');
    if (answer) return { ok: false, status: answer, json: async () => ({}) };
    const data = url === '/api/source-check' ? { available, url: available ? JSON.parse(options.body).url + '&verified=1' : undefined } : url.includes('/season/') ? { episodes: [{ episode_number: 1, name: 'Premier' }, { episode_number: 2, name: 'Deuxième' }] } : { title: 'Film test', name: 'Série test', release_date: '2026-01-01', number_of_seasons: series ? 1 : 0, seasons: series ? seasons : [], genres: [{ name: 'Action' }] };
    return { ok: true, json: async () => data };
  } });
  return { ...exports, inserts, calls, updates };
}
const request = { id: '123', type: 'movie', job: 'test-job-123' };
test('two concurrent copies of the same title insert only once', async () => {
  const api = setup({ locked: true });
  const outcomes = await Promise.all([api.importCatalogueItem(request, () => {}), api.importCatalogueItem({ ...request, job: 'second-job-123' }, () => {})]);
  assert.equal(api.inserts.length, 1);
  assert.equal(outcomes[0].already, false);
  assert.equal(outcomes[1].already, true);
});
test('database duplicate after a race reports already added', async () => {
  const api = setup({ race: true });
  assert.equal((await api.importCatalogueItem(request, () => {})).already, true);
});
test('request rejects unknown types and malformed IDs', () => {
  const api = setup();
  assert.equal(api.parseImportRequest({ ...request, type: 'bad' }), null);
  assert.equal(api.parseImportRequest({ ...request, id: '../x' }), null);
  assert.equal(api.parseImportRequest(request).id, '123');
});
test('non-admin never fetches or writes', async () => {
  const api = setup({ admin: false });
  await assert.rejects(api.importCatalogueItem(request, () => {}));
  assert.equal(api.calls.length, 0); assert.equal(api.inserts.length, 0);
});
test('existing title produces success without inserting duplicate', async () => {
  const api = setup({ duplicate: true });
  assert.equal((await api.importCatalogueItem(request, () => {})).already, true);
  assert.equal(api.calls.length, 0); assert.equal(api.inserts.length, 0);
});
test('movie saves metadata and stable player reference without waiting for stream extraction', async () => {
  const api = setup();
  await api.importCatalogueItem(request, () => {});
  assert.equal(api.inserts.length, 1);
  assert.equal(api.inserts[0].title, 'Film test (2026)');
  assert.match(api.inserts[0].url, /tmdb=123&type=movie/);
  assert.equal(api.calls.filter(url => url === '/api/source-check').length, 0);
  assert.equal(api.inserts[0].tmdb_id, '123');
});
test('source availability is resolved at playback rather than blocking catalogue import', async () => {
  const api = setup({ available: false });
  await api.importCatalogueItem(request, () => {});
  assert.equal(api.inserts.length, 1);
  assert.equal(api.calls.filter(url => url === '/api/source-check').length, 0);
});
test('series collects every episode and retains episode metadata', async () => {
  const api = setup({ series: true });
  await api.importCatalogueItem({ ...request, type: 'series' }, () => {});
  assert.equal(api.inserts[0].seasons[0].episodes.length, 2);
  assert.match(api.inserts[0].seasons[0].episodes[1].embedUrl, /episode=2/);
  assert.equal(api.calls.filter(url => url === '/api/source-check').length, 0);
});

test('series with gaps in its numbering and empty seasons reads only its real seasons', async () => {
  const api = setup({ series: true, seasons: [{ season_number: 0, episode_count: 5 }, { season_number: 1, episode_count: 2 }, { season_number: 3, episode_count: 2 }, { season_number: 4, episode_count: 0 }] });
  await api.importCatalogueItem({ ...request, type: 'series' }, () => {});
  assert.deepEqual([...api.inserts[0].seasons.map(season => season.seasonNumber)], [1, 3]);
  assert.equal(api.calls.filter(url => url.includes('/season/')).length, 2);
});
test('a series without any episode is reported as unavailable', async () => {
  const api = setup({ series: true, seasons: [{ season_number: 0, episode_count: 5 }, { season_number: 1, episode_count: 0 }] });
  await assert.rejects(api.importCatalogueItem({ ...request, type: 'series' }, () => {}), error => api.UNAVAILABLE_ERRORS.includes(error.message));
  assert.equal(api.inserts.length, 0);
});
test('a missing season does not make the whole series unavailable', async () => {
  const api = setup({ series: true, respond: url => url.includes('/season/') ? 404 : 0 });
  await assert.rejects(api.importCatalogueItem({ ...request, type: 'series' }, () => {}), error => /^Saison 1 introuvable/.test(error.message) && !api.UNAVAILABLE_ERRORS.includes(error.message));
});
test('a missing title is unavailable, TMDB outages are retried then stay temporary', async () => {
  await assert.rejects(setup({ respond: () => 404 }).importCatalogueItem(request, () => {}), error => setup().UNAVAILABLE_ERRORS.includes(error.message));
  const recovered = setup({ respond: (_, attempt) => attempt === 1 ? 429 : attempt === 2 ? 'network' : 0 });
  await recovered.importCatalogueItem(request, () => {});
  assert.equal(recovered.inserts.length, 1);
  const down = setup({ respond: () => 503 });
  await assert.rejects(down.importCatalogueItem(request, () => {}), /temporairement indisponible/);
  assert.equal(down.calls.length, 3);
});
test('new episodes join the saved series and keep what is already there', async () => {
  const saved = { id: 7, seasons: [{ seasonNumber: 1, poster_path: '', episodes: [{ number: 1, title: 'Gardé', embedUrl: 'garde', still_path: '', runtime: 40 }] }] };
  const api = setup({ series: true, saved });
  assert.equal((await api.importCatalogueItem({ ...request, type: 'series', update: true }, () => {})).added, 1);
  assert.equal(api.inserts.length, 0);
  assert.equal(api.updates[0].value, 7);
  assert.deepEqual([...api.updates[0].row.seasons[0].episodes.map(episode => episode.title)], ['Gardé', 'Deuxième']);
});
test('a failed read never passes for an up-to-date series', async () => {
  const api = setup({ series: true, readError: { message: 'timeout' } });
  await assert.rejects(api.importCatalogueItem({ ...request, type: 'series', update: true }, () => {}), /Lecture de la série impossible/);
  assert.equal(api.inserts.length, 0); assert.equal(api.updates.length, 0);
});

test('catalogue queues clicks in its hidden worker, without opening any window', () => {
  const messages = [], listeners = {}, done = new Set();
  const popup = { closed: false, focus() {}, postMessage: (message, origin) => messages.push({ message, origin }) };
  const node = () => ({ append() {}, setAttribute() {}, replaceChildren() {} });
  const status = node(); let sequence = 0;
  const context = { Map, location: { origin: 'https://yamonfi.netlify.app' }, crypto: { randomUUID: () => `test-id-${++sequence}` }, document: { body: node(), createElement: type => type === 'iframe' ? { contentWindow: popup } : node(), querySelector: node, getElementById: () => status }, window: { open: () => { throw Error('No popup allowed'); }, addEventListener: (type, fn) => { listeners[type] = fn; } }, dbDone: done, render() {}, rebuildDone() {}, setInterval() { return 1; }, setTimeout() { return 1; }, clearTimeout() {} };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('scripts/catalogue-direct-import.js', 'utf8') + '\ncatalogueStatusReady=true; globalThis.button=importButton({source_id:123,kind:"movie"});', context);
  context.button.onclick();
  const ready = { source: popup, origin: 'https://yamonfi.netlify.app', data: { action: 'catalogue:ready', channel: 'test-id-1' } };
  listeners.message({ ...ready, origin: 'https://other.example' });
  assert.equal(messages.length, 0);
  listeners.message(ready); listeners.message(ready);
  assert.equal(messages.length, 1);
  assert.equal(messages[0].message.action, 'catalogue:add');
  assert.equal(messages[0].origin, 'https://yamonfi.netlify.app');
  assert.equal(messages[0].message.id, '123');
  vm.runInContext('importButton({source_id:456,kind:"series"}).onclick()', context);
  assert.equal(messages.length, 1);
  listeners.message({ ...ready, data: { ...messages[0].message, action: 'catalogue:result', ok: true } });
  assert.equal(done.has('123'), true);
  assert.equal(messages.length, 2);
  assert.equal(messages[1].message.id, '456');
});

test('a worker that stops answering does not block the next titles', () => {
  const messages = [], listeners = {}, timers = [];
  const popup = { postMessage: message => messages.push(message) };
  const node = () => ({ append() {}, setAttribute() {}, replaceChildren() {} });
  let sequence = 0;
  const context = { Map, location: { origin: 'https://yamonfi.netlify.app' }, crypto: { randomUUID: () => `test-id-${++sequence}` }, document: { body: node(), createElement: type => type === 'iframe' ? { contentWindow: popup } : node(), querySelector: node }, window: { addEventListener: (type, fn) => { listeners[type] = fn; } }, dbDone: new Set(), render() {}, rebuildDone() {}, setInterval() { return 1; }, setTimeout(run) { timers.push(run); return timers.length; }, clearTimeout() {} };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('scripts/catalogue-direct-import.js', 'utf8') + '\ncatalogueStatusReady=true; queueImportItems([{source_id:1,kind:"movie"},{source_id:2,kind:"movie"}]); globalThis.state=id=>importStates.get(id);', context);
  listeners.message({ source: popup, origin: 'https://yamonfi.netlify.app', data: { action: 'catalogue:ready', channel: 'test-id-1' } });
  assert.equal(messages.length, 1);
  timers.at(-1)();
  assert.match(context.state('1').error, /ne répond plus/);
  assert.equal(messages.length, 2);
  assert.equal(messages[1].id, '2');
});

test('bulk import skips existing and queued titles, and stopping preserves the active job', () => {
  const node = () => ({ append() {}, setAttribute() {} });
  const context = { location: { origin: 'null', protocol: 'file:' }, crypto: require('node:crypto').webcrypto,
    document: { createElement: node, querySelector: node }, window: { addEventListener() {} },
    dbDone: new Set(['1']), render() {} };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('scripts/catalogue-direct-import.js', 'utf8') + `
    catalogueStatusReady = true;
    const items = [1,2,2,3].map(source_id => ({source_id,kind:'movie'}));
    queueImportItems(items);
    if (importQueue.length !== 2) throw Error('Duplicates queued');
    importPending = importQueue.shift();
    stopImportsButton.onclick();
    if (importQueue.length || !importStates.get('2').busy || importStates.has('3')) throw Error('Stop failed');
    queueImportItems(items);
    if (importQueue.length !== 1 || importQueue[0].id !== '3') throw Error('Resume failed');
  `, context);
});

test('only titles confirmed missing from TMDB stay disabled after reload', () => {
  const storage = new Map();
  const node = () => ({ append() {}, setAttribute() {} });
  function load() {
    const context = { location: { origin: 'null', protocol: 'file:' }, crypto: require('node:crypto').webcrypto,
      localStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) },
      document: { createElement: node, querySelector: node }, window: { addEventListener() {} }, dbDone: new Set(), render() {} };
    vm.createContext(context);
    vm.runInContext(fs.readFileSync('scripts/catalogue-direct-import.js', 'utf8') + '\ncatalogueStatusReady = true;', context);
    return context;
  }
  const first = load();
  vm.runInContext("unavailableImports.set('123','Titre introuvable sur TMDB.');saveUnavailableImports()", first);
  const second = load();
  vm.runInContext(`
    const item = {source_id:123,kind:'movie'};
    const button = importButton(item);
    if (!button.disabled || button.textContent !== 'Non disponible') throw Error('Unavailable status lost');
    queueImportItems([item]);
    if (importQueue.length) throw Error('Unavailable film queued');
    resetUnavailableButton.onclick();
    if (!canQueueImport(item)) throw Error('Reset failed');
  `, second);
});

test('titles confirmed unavailable at generation stay hidden, even after a reset', () => {
  const storage = new Map();
  const node = () => ({ append() {}, setAttribute() {} });
  const context = { location: { origin: 'null', protocol: 'file:' }, crypto: require('node:crypto').webcrypto,
    localStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) },
    document: { createElement: node, querySelector: node }, window: { addEventListener() {} }, dbDone: new Set(), render() {} };
  vm.createContext(context);
  vm.runInContext('const catalogueUnavailable=[123];\n' + fs.readFileSync('scripts/catalogue-direct-import.js', 'utf8') + `
    catalogueStatusReady = true;
    const item = {source_id:123,kind:'movie'};
    if (canQueueImport(item)) throw Error('Known unavailable title queued');
    unavailableImports.set('456','Aucune saison exploitable sur cette fiche.');
    updateBulkControls();
    if (resetUnavailableButton.disabled) throw Error('Reset should clear local titles');
    resetUnavailableButton.onclick();
    updateBulkControls();
    if (canQueueImport(item) || unavailableImports.has('456') || !resetUnavailableButton.disabled) throw Error('Reset must keep the known list only');
  `, context);
  assert.equal(storage.get('moviez-unavailable-films-v1'), '[]');
});

test('temporary add failures are not persisted as unavailable', () => {
  const storage = new Map([[ 'moviez-unavailable-films-v1', JSON.stringify([['123', 'Connexion administrateur indisponible']]) ]]);
  const node = () => ({ append() {}, setAttribute() {} });
  const context = { location: { origin: 'null', protocol: 'file:' }, crypto: require('node:crypto').webcrypto,
    localStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) },
    document: { createElement: node, querySelector: node }, window: { addEventListener() {} }, dbDone: new Set(), render() {} };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('scripts/catalogue-direct-import.js', 'utf8') + `
    catalogueStatusReady = true;
    const item = {source_id:123,kind:'movie'};
    if (unavailableImports.has('123') || !canQueueImport(item)) throw Error('Temporary failure still blocked retry');
  `, context);
});
