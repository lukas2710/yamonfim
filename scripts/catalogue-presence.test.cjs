const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const ts = require('typescript');
function fixture(data) {
  const identity = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/content-identity.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, { exports: identity, URL });
  const node = () => ({ append() {}, setAttribute() {}, replaceChildren() {} });
  const context = { data, catalogueIdentity: identity, valid: new Set(data.map(item => String(item.source_id))), Map, Set, URL, location: { origin: 'null', protocol: 'file:' }, document: { createElement: node, querySelector: node }, window: { addEventListener() {} }, dbDone: new Set(), render() {} };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('scripts/catalogue-direct-import.js', 'utf8') + '\n' + fs.readFileSync('scripts/catalogue-presence.js', 'utf8') + '\ncatalogueStatusReady=true; globalThis.reconcile=reconcileCatalogueRows; globalThis.button=importButton;', context);
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
test('downloadable pages use server-backed checks and a 15 second refresh', () => {
  for (const name of ['catalogue-films-moviez.html', 'catalogue-series-moviez.html']) {
    const html = fs.readFileSync('public/catalogues/' + name, 'utf8');
    assert.ok(html.includes('href="catalogues-yamonfim.zip" download'));
    assert.ok(html.includes('function rebuildDone(){done=new Set(dbDone)}'));
    assert.ok(html.includes('setInterval(()=>{if(!document.hidden)syncDatabase()},15000)'));
    assert.ok(html.includes('check.disabled=true;'));
  }
});
