const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM, VirtualConsole } = require('../.tools/dom-tests/node_modules/jsdom');
const assets = path.join(__dirname, '../app/src/main/assets');
const script = fs.readFileSync(path.join(assets, 'tv-shell.js'), 'utf8');
const css = fs.readFileSync(path.join(assets, 'tv-shell.css'), 'utf8');

function environment(t, options = {}) {
  const labels = ['Accueil', 'Films', 'Séries'];
  const nav = labels.map(label => `<button class="${label === 'Accueil' ? 'text-white' : 'text-zinc-500'}">${label}</button>`).join('');
  const html = `<html data-yamon-tv="compact"><head><style>${css}</style></head><body>
  <main class="yf-page ${options.profile ? 'yf-profiles' : options.history ? 'yf-history' : 'yf-home'}">
    <header><nav>${nav}</nav><input type="text" placeholder="Titres, descriptions…"><button aria-label="Menu du compte">Mon compte</button></header>
    <section class="yf-catalogue-hero"><button>Regarder</button></section>
    <div id="catalogue-accueil"><div class="yf-poster-card" role="button" tabindex="0">Un film</div></div>
    ${options.noCollections ? '' : '<section><h2 id="collections-title">Collections</h2><button id="saga">Une saga</button></section>'}
    <nav id="mobile-tabs">${nav}</nav>
  </main><footer class="yf-site-footer">Footer du site</footer></body></html>`;
  const dom = new JSDOM(html, { url: 'https://yamonfim.vercel.app/' + (options.profile ? 'profiles' : options.history ? 'history' : ''), runScripts: 'outside-only', virtualConsole: new VirtualConsole() });
  const w = dom.window, d = w.document;
  w.HTMLElement.prototype.scrollIntoView = function () { this.didScroll = true; };
  const originalClicks = [], searches = [];
  d.querySelectorAll('main header nav button,main > nav button').forEach(button => button.addEventListener('click', () => {
    originalClicks.push(button.textContent);
    d.querySelectorAll('main header nav button,main > nav button').forEach(item => { item.className = item.textContent === button.textContent ? 'text-white' : 'text-zinc-500'; });
    d.querySelector('header input').value = '';
  }));
  d.querySelector('header input').addEventListener('input', event => searches.push(event.target.value));
  let logoutCount = 0;
  d.querySelector('[aria-label="Menu du compte"]').addEventListener('click', () => {
    const logout = d.createElement('button'); logout.textContent = 'Déconnexion';
    logout.addEventListener('click', () => logoutCount++); d.querySelector('header').appendChild(logout);
  });
  if (options.admin) w.localStorage.setItem('sb-test-auth-token', JSON.stringify({ user: { email: 'lukas.leclerc312@gmail.com' } }));
  if (options.pending) w.sessionStorage.setItem('yamon-tv-pending-action', JSON.stringify({ action: options.pending, prepared: false, time: Date.now() }));
  w.eval(script);
  t.after(() => w.close());
  return { w, d, originalClicks, searches, logoutCount: () => logoutCount, go: action => w.YamonTvShell.go(action) };
}

test('the app creates one TV rail with all primary sections', t => {
  const e = environment(t);
  assert.equal(e.d.querySelectorAll('#yamon-tv-rail').length, 1);
  assert.equal(e.d.querySelectorAll('#yamon-tv-rail [data-tv-action]').length, 7);
  assert.equal(e.d.documentElement.getAttribute('data-yamon-tv-interface'), 'shell');
});
test('the mobile bottom bar and original PC header are hidden by the app stylesheet', t => {
  const e = environment(t);
  assert.equal(e.w.getComputedStyle(e.d.getElementById('mobile-tabs')).display, 'none');
  assert.equal(e.w.getComputedStyle(e.d.querySelector('main > header')).display, 'none');
  assert.equal(e.w.getComputedStyle(e.d.querySelector('.yf-site-footer')).display, 'none');
});
test('Films and Series reuse the real catalogue buttons instead of bypassing website logic', t => {
  const e = environment(t); e.go('films'); e.go('series');
  assert.deepEqual(e.originalClicks, ['Films', 'Séries']);
});
test('the selected TV category follows the original catalogue state', t => {
  const e = environment(t); e.go('films'); e.w.YamonTvShell.sync();
  assert.equal(e.d.querySelector('[data-tv-action="films"]').getAttribute('aria-current'), 'page');
  assert.equal(e.d.querySelector('.ytv-page-heading').textContent, 'Films');
});
test('TV search forwards typed text to the original input event', async t => {
  const e = environment(t); e.go('search');
  const field = e.d.querySelector('#yamon-tv-search input'); field.value = 'Star Wars';
  field.dispatchEvent(new e.w.Event('input', { bubbles: true }));
  await new Promise(resolve => setTimeout(resolve, 220));
  assert.equal(e.d.querySelector('header input').value, 'Star Wars');
  assert.deepEqual(e.searches, ['Star Wars']);
});
test('Back closes TV search and restores focus to its menu entry', t => {
  const e = environment(t); e.go('search');
  assert.equal(e.w.YamonTvShell.back(), true);
  assert.equal(e.d.getElementById('yamon-tv-search').hidden, true);
  assert.equal(e.d.activeElement.getAttribute('data-tv-action'), 'search');
});
test('opening Plus shows live TV, requests, VIP, profiles and assistance', t => {
  const e = environment(t); e.go('more');
  const labels = e.d.getElementById('yamon-tv-overlay').textContent;
  for (const text of ['TV en direct', 'Faire une demande', 'Abonnement VIP', 'Mes profils', 'Assistance']) assert.ok(labels.includes(text));
  assert.ok(!labels.includes('Administration'));
});
test('admin navigation is offered only for the existing admin UI identity', t => {
  const e = environment(t, { admin: true }); e.go('more');
  const admin = [...e.d.querySelectorAll('#yamon-tv-overlay button')].find(button => button.textContent === 'Administration');
  assert.ok(admin); admin.click();
  for (const text of ['Catalogue','Collections','Bannières','Promotions','Membres et VIP','Statistiques']) assert.ok(e.d.getElementById('yamon-tv-overlay').textContent.includes(text));
});
test('Back closes an app menu before Android navigates away', t => {
  const e = environment(t); e.go('more');
  assert.equal(e.w.YamonTvShell.back(), true);
  assert.equal(e.d.getElementById('yamon-tv-overlay').hidden, true);
  assert.equal(e.w.YamonTvShell.back(), false);
});
test('collections scroll to and focus the actual collection section', t => {
  const e = environment(t); e.go('collections');
  assert.equal(e.d.getElementById('collections-title').didScroll, true);
  assert.equal(e.d.activeElement.id, 'saga');
});
test('the TV interface hides on the full-screen profile picker and when playback opens', t => {
  const e = environment(t, { profile: true });
  assert.equal(e.d.documentElement.getAttribute('data-yamon-tv-auth'), 'true');
  assert.equal(e.w.getComputedStyle(e.d.getElementById('yamon-tv-shell')).display, 'none');
});
test('a pending film filter is applied after the original home catalogue mounts', t => {
  const e = environment(t, { pending: 'films' });
  assert.deepEqual(e.originalClicks, ['Films']);
  assert.equal(e.w.sessionStorage.getItem('yamon-tv-pending-action'), null);
});
test('sign-out invokes the existing account menu and original logout handler', t => {
  const e = environment(t, { pending: 'logout' });
  e.w.YamonTvShell.sync();
  assert.equal(e.logoutCount(), 1);
  assert.equal(e.w.sessionStorage.getItem('yamon-tv-pending-action'), null);
});
test('installing the shell again preserves a single rail and existing state', t => {
  const e = environment(t); e.w.eval(script);
  assert.equal(e.d.querySelectorAll('#yamon-tv-shell').length, 1);
});

test('playback hides the TV rail and closing playback restores it', t => {
  const e = environment(t);
  const stage = e.d.createElement('section'); stage.className = 'watch-stage'; e.d.querySelector('main').appendChild(stage);
  e.w.YamonTvShell.sync();
  assert.equal(e.d.documentElement.getAttribute('data-yamon-tv-player'), 'true');
  assert.equal(e.w.getComputedStyle(e.d.getElementById('yamon-tv-shell')).display, 'none');
  stage.remove(); e.w.YamonTvShell.sync();
  assert.equal(e.d.documentElement.getAttribute('data-yamon-tv-player'), 'false');
});
test('Back on a film category returns to the TV home before closing the app', t => {
  const e = environment(t); e.go('films');
  assert.equal(e.w.YamonTvShell.back(), true);
  assert.deepEqual(e.originalClicks, ['Films','Accueil']);
});
test('pending TV search opens its own panel and marks the correct section', t => {
  const e = environment(t, { pending: 'search' });
  assert.equal(e.d.getElementById('yamon-tv-search').hidden, false);
  assert.equal(e.d.querySelector('.ytv-page-heading').textContent, 'Recherche');
});
