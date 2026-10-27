const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const assert = require('node:assert/strict');
const { JSDOM } = require('../android-tv-apk/.tools/dom-tests/node_modules/jsdom');
const React = require('react');
const { createRoot } = require('react-dom/client');
const { act } = React;
const site = 'https://yamonfim.vercel.app';
const code = ts.transpileModule(fs.readFileSync('app/catalogue-import/page.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
async function check(admin, sameOrigin) {
  const parent = new JSDOM('', { url: sameOrigin ? site + '/catalogues/catalogue-films-moviez.html' : 'https://other.example' });
  const child = new JSDOM('<div id="root"></div>', { url: site + '/catalogue-import#channel=test-channel-123' });
  const sent = [], jobs = [];
  parent.window.postMessage = message => sent.push(message);
  Object.defineProperty(child.window, 'parent', { value: parent.window });
  global.window = child.window; global.document = child.window.document; global.IS_REACT_ACT_ENVIRONMENT = true;
  const exports = {};
  vm.runInNewContext(code, { exports, URLSearchParams, window: child.window, require: id => {
    if (id === 'react' || id === 'react/jsx-runtime') return require(id);
    if (id === 'next/link') return { default: props => React.createElement('a', props) };
    if (id === '@/lib/auth-session') return { getPersistentSession: async () => ({ data: { session: admin ? { user: { email: 'admin@example.test' } } : null } }) };
    if (id === '@/lib/catalogue-import') return { CATALOGUE_ADMIN: 'admin@example.test', parseImportRequest: ({ id, type, job }) => ({ id, type, job }), importCatalogueItem: async item => { jobs.push(item); return { already: false }; } };
    throw Error(id);
  } });
  const root = createRoot(child.window.document.getElementById('root'));
  await act(async () => { root.render(React.createElement(exports.default)); });
  const data = { channel: 'test-channel-123', action: 'catalogue:add', id: '123', type: 'movie', job: 'test-job-123' };
  await act(async () => child.window.dispatchEvent(new child.window.MessageEvent('message', { source: parent.window, origin: sameOrigin ? site : 'https://other.example', data })));
  assert.equal(jobs.length, admin && sameOrigin ? 1 : 0);
  if (admin && sameOrigin) assert.ok(sent.some(message => message.action === 'catalogue:result' && message.ok));
  if (!admin && sameOrigin) assert.ok(sent.some(message => message.action === 'catalogue:auth-required'));
  await act(async () => root.unmount()); parent.window.close(); child.window.close();
}
(async () => {
  await check(true, true); console.log('PASS: same-origin admin imports automatically in background');
  await check(false, true); console.log('PASS: signed-out visitor cannot import');
  await check(true, false); console.log('PASS: external embedded parent cannot import');
})().catch(error => { console.error(error); process.exitCode = 1; });
