const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync(__dirname + '/page.html', 'utf8');
const source = html.match(/<script>([\s\S]*?)<\/script>/)[1];
test('ajout direct sans fenêtre externe et connexion explicite',()=>{const add=source.slice(source.indexOf('async function add('),source.indexOf('function render()'));assert.ok(add.includes('importCatalogueItem'));assert.ok(add.includes('confirmInDatabase'));assert.ok(add.includes('if(!authenticated)'));assert.ok(!source.includes('window.open'));});
test('la confirmation exige le bon identifiant et le bon type dans la base', async () => {
  let rows = [], requested;
  const context = { URL, URLSearchParams, AbortSignal, site: 'https://yamonfim.vercel.app', fetch: async url => { requested = url; return { ok: true, json: async () => rows }; } };
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf('async function confirmInDatabase('), source.indexOf('function status(')), context);
  vm.runInContext(source.slice(source.indexOf('function identity('), source.indexOf('const normalize=')), context);
  assert.equal(await context.confirmInDatabase({ id: '42', type: 'movie' }), false);
  rows = [{ id: 'row', tmdb_id: 42, type: 'series' }];
  assert.equal(await context.confirmInDatabase({ id: '42', type: 'movie' }), false);
  rows[0].type = 'movie';
  assert.equal(await context.confirmInDatabase({ id: '42', type: 'movie' }), true);
  assert.equal(requested.searchParams.get('tmdb_id'), 'eq.42');
  assert.equal(requested.searchParams.get('type'), 'eq.movie');
});
test('syntaxe du script local', () => { new vm.Script(source); });
test('les candidats films précèdent les séries', () => {
  const server = fs.readFileSync(__dirname + '/server.cjs', 'utf8');
  const candidates = vm.runInNewContext(server.match(/const candidates = ([^;]+);/)[1], { groups: [[{kind:'movie'}, {kind:'movie'}], [{kind:'series'}]] });
  assert.equal(candidates.map(x => x.kind).join(','), 'movie,movie,series');
});
