const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const { JSDOM } = require('../.tools/dom-tests/node_modules/jsdom');
const project = createRequire(path.resolve(__dirname, '../../package.json'));

test('TV controls preserve React catalogue filters and controlled search input behavior', async () => {
  const dom = new JSDOM('<html><head></head><body><div id="root"></div></body></html>', { url: 'https://yamonfim.vercel.app/', runScripts: 'outside-only' });
  const saved = new Map();
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator, HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true })) {
    saved.set(key, Object.getOwnPropertyDescriptor(global, key));
    Object.defineProperty(global, key, { configurable: true, writable: true, value });
  }
  dom.window.HTMLElement.prototype.scrollIntoView = function () {};
  const React = project('react');
  const { createRoot } = project('react-dom/client');
  const h = React.createElement;
  function OriginalCatalogue() {
    const [type, setType] = React.useState('all');
    const [query, setQuery] = React.useState('');
    const nav = () => [['all','Accueil'],['movie','Films'],['series','Séries']].map(([key,label]) => h('button', { key, className: key === type ? 'text-white' : 'text-zinc-500', onClick: () => { setType(key); setQuery(''); } }, label));
    return h('main', { className: 'yf-home yf-page' },
      h('header', null, h('nav', null, nav()), h('input', { type: 'text', value: query, onChange: event => setQuery(event.target.value) })),
      h('div', { id: 'state', 'data-type': type, 'data-query': query }), h('div', { id: 'catalogue-accueil' }), h('nav', null, nav()));
  }
  const root = createRoot(dom.window.document.getElementById('root'));
  try {
    await React.act(async () => root.render(h(OriginalCatalogue)));
    dom.window.eval(fs.readFileSync(path.join(__dirname, '../app/src/main/assets/tv-shell.js'), 'utf8'));
    await React.act(async () => dom.window.YamonTvShell.go('films'));
    assert.equal(dom.window.document.getElementById('state').getAttribute('data-type'), 'movie');
    await React.act(async () => dom.window.YamonTvShell.go('search'));
    const field = dom.window.document.querySelector('#yamon-tv-search input');
    await React.act(async () => {
      field.value = 'Star Wars'; field.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
      await new Promise(resolve => setTimeout(resolve, 240));
    });
    assert.equal(dom.window.document.getElementById('state').getAttribute('data-query'), 'Star Wars');
    await React.act(async () => dom.window.YamonTvShell.go('series'));
    assert.equal(dom.window.document.getElementById('state').getAttribute('data-type'), 'series');
    assert.equal(dom.window.document.getElementById('state').getAttribute('data-query'), '');
  } finally {
    await React.act(async () => root.unmount());
    dom.window.close();
    for (const [key, descriptor] of saved) { if (descriptor) Object.defineProperty(global, key, descriptor); else delete global[key]; }
  }
});
