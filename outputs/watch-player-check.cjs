const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const assert = require('node:assert/strict');
const { JSDOM } = require('../android-tv-apk/.tools/dom-tests/node_modules/jsdom');
const React = require('react');
const { createRoot } = require('react-dom/client');
const { act } = React;
function compile(file) { return ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText; }
async function check(mode, hlsMode = false, blockSound = false, nativeHls = false) {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://test.local', pretendToBeVisual: true });
  const win = dom.window, doc = win.document, timers = new Map();
  let timerId = 0, iosEntries = 0, pauses = 0, loads = 0;
  const progressEvents = [];
  const state = new WeakMap();
  Object.defineProperty(win.HTMLMediaElement.prototype, 'paused', { get() { return state.get(this) !== false; } });
  Object.defineProperty(win.HTMLMediaElement.prototype, 'readyState', { get() { return 4; } });
  Object.defineProperty(win.HTMLMediaElement.prototype, 'duration', { get() { return 120; } });
  Object.defineProperty(win.HTMLMediaElement.prototype, 'audioTracks', { get() { return undefined; } });
  win.HTMLMediaElement.prototype.load = function () { loads++; };
  win.HTMLMediaElement.prototype.canPlayType = () => nativeHls ? 'probably' : '';
  let soundBlocked = false;
  win.HTMLMediaElement.prototype.play = function () {
    if (blockSound && !soundBlocked && !this.muted) { soundBlocked = true; return Promise.reject(new win.DOMException('Sound requires a gesture', 'NotAllowedError')); }
    state.set(this, false); this.dispatchEvent(new win.Event('play')); return Promise.resolve();
  };
  win.HTMLMediaElement.prototype.pause = function () { if (!this.paused) { pauses++; state.set(this, true); this.dispatchEvent(new win.Event('pause')); } };
  if (mode === 'standard') {
    win.HTMLElement.prototype.requestFullscreen = async function () { Object.defineProperty(doc, 'fullscreenElement', { configurable: true, value: this }); doc.dispatchEvent(new win.Event('fullscreenchange')); };
    doc.exitFullscreen = async () => { Object.defineProperty(doc, 'fullscreenElement', { configurable: true, value: null }); doc.dispatchEvent(new win.Event('fullscreenchange')); };
  }
  if (mode === 'ios') {
    win.HTMLMediaElement.prototype.webkitEnterFullscreen = function () { iosEntries++; this.webkitDisplayingFullscreen = true; this.dispatchEvent(new win.Event('webkitbeginfullscreen')); };
    win.HTMLMediaElement.prototype.webkitExitFullscreen = function () { this.webkitDisplayingFullscreen = false; this.dispatchEvent(new win.Event('webkitendfullscreen')); };
  }
  global.window = win; global.document = doc; global.IS_REACT_ACT_ENVIRONMENT = true;
  const helpers = {}; vm.runInNewContext(compile('lib/player-controls.ts'), { exports: helpers, Intl });
  const styles = new Proxy({}, { get: (_, key) => key });
  const exports = {};
  let engineConfig, engineCreations = 0, networkRestarts = 0, mediaRestarts = 0;
  const engineEvents = new Map();
  class FakeHls {
    static Events = { ERROR: 'error' };
    static ErrorTypes = { NETWORK_ERROR: 'networkError', MEDIA_ERROR: 'mediaError' };
    static isSupported() { return true; }
    constructor(config) { engineConfig = config; engineCreations++; }
    on(type, fn) { engineEvents.set(type, fn); } loadSource() {} attachMedia() {} destroy() {}
    startLoad() { networkRestarts++; } recoverMediaError() { mediaRestarts++; }
  }
  vm.runInNewContext(compile('components/WatchPlayer.tsx'), { exports, window: win, document: doc, process: { env: { NODE_ENV: 'test' } }, localStorage: win.localStorage, URL, AbortController, setTimeout: (fn, delay) => { timers.set(++timerId, { fn, delay }); return timerId; }, clearTimeout: id => timers.delete(id), require: id => {
    if (id === 'react' || id === 'react/jsx-runtime') return require(id);
    if (id === 'hls.js') return { default: FakeHls };
    if (id.endsWith('.module.css')) return { default: styles };
    if (id === '@/lib/player-controls') return helpers;
    if (id === '@/lib/watch-progress') return { isNativePlayback: () => true, isMoviezPlayer: () => false, playbackProgress: (currentTime, duration) => ({ currentTime, duration }) };
    if (id === '@/lib/auth-session') return {};
    if (id === '@/lib/playback-request') return {};
    if (id === '@/lib/catalogue-source') return { isCataloguePlayer: () => false, isSupportedEmbed: () => false, MAX_SOURCE_EMBEDS: 40 };
    throw Error(id);
  } });
  const root = createRoot(doc.getElementById('root'));
  const source = hlsMode ? '/test.m3u8' : '/test.mp4';
  await act(async () => root.render(React.createElement(exports.default, { src: source, title: 'Test', resumeAt: hlsMode ? 12 : 0, controlRef: React.createRef(), onProgress(...values) { progressEvents.push(values); }, onState() {}, onEnded() {}, onExit() {}, nextEpisodeIn: 3 })));
  const video = doc.querySelector('video'), player = doc.querySelector('[data-controls]');
  if (blockSound) {
    assert.equal(video.paused, false, 'playback starts automatically despite blocked sound');
    assert.equal(video.muted, true);
    const unmute = [...doc.querySelectorAll('button')].find(button => button.textContent.includes('Activer le son'));
    assert.ok(unmute);
    await act(async () => unmute.click());
    assert.equal(video.muted, false);
  }
  await act(async () => video.dispatchEvent(new win.Event('loadedmetadata')));
  const loadsBeforeResumeUpdate = loads;
  await act(async () => root.render(React.createElement(exports.default, { src: source, title: 'Test', resumeAt: 24, controlRef: React.createRef(), onProgress(...values) { progressEvents.push(values); }, onState() {}, onEnded() {}, onExit() {}, nextEpisodeIn: 3 })));
  assert.equal(loads, loadsBeforeResumeUpdate, 'updating resume position must not reload playback');
  assert.equal(video.paused, false, 'launch/resume update must not interrupt a prepared video');
  if (hlsMode && !nativeHls) {
    assert.equal(engineCreations, 1);
    assert.equal(engineConfig.startPosition, 12, 'load the saved segment immediately');
    assert.equal(engineConfig.startLevel, 0);
    assert.equal(engineConfig.testBandwidth, false);
    await act(async () => engineEvents.get('error')(null, { fatal: true, type: 'networkError' }));
    await act(async () => engineEvents.get('error')(null, { fatal: true, type: 'mediaError' }));
    assert.equal(networkRestarts, 1, 'recover the existing network source');
    assert.equal(mediaRestarts, 1, 'recover the existing decoder');
    assert.equal(engineCreations, 1, 'recoverable errors must not replace the source');
  }
  if (nativeHls) { assert.equal(engineCreations, 0, 'iPhone uses native HLS'); assert.ok(video.src.includes('test.m3u8')); }
  await act(async () => video.dispatchEvent(new win.Event('waiting')));
  assert.ok([...timers.values()].some(timer => timer.delay === 45000));
  video.currentTime += 1;
  await act(async () => video.dispatchEvent(new win.Event('timeupdate')));
  assert.ok(![...timers.values()].some(timer => timer.delay === 45000), 'advancing video cancels stale failure timers');
  await act(async () => video.dispatchEvent(new win.Event('waiting')));
  Object.defineProperty(doc, 'hidden', { configurable: true, value: true });
  await act(async () => doc.dispatchEvent(new win.Event('visibilitychange')));
  assert.ok(![...timers.values()].some(timer => timer.delay === 45000), 'backgrounding the phone cancels failure timers');
  Object.defineProperty(doc, 'hidden', { configurable: true, value: false });
  if (nativeHls) {
    const originalSource = video.src, previousLoads = loads;
    Object.defineProperty(video, 'error', { configurable: true, value: { code: 1 } });
    await act(async () => video.dispatchEvent(new win.Event('error')));
    assert.equal(loads, previousLoads, 'Safari abort events do not replace a healthy source');
    Object.defineProperty(video, 'error', { configurable: true, value: { code: 2 } });
    await act(async () => video.dispatchEvent(new win.Event('error')));
    assert.equal(loads, previousLoads + 1, 'a network failure first reloads the same native source');
    assert.equal(video.src, originalSource);
    Object.defineProperty(video, 'error', { configurable: true, value: null });
    await act(async () => video.dispatchEvent(new win.Event('loadedmetadata')));
    assert.equal(doc.querySelector('[role="alert"]'), null);
  }
  const hide = async () => { const entries = [...timers].filter(([, timer]) => timer.delay === 3000); const [id, timer] = entries.at(-1); timers.delete(id); await act(async () => timer.fn()); };
  await hide(); assert.equal(player.dataset.controls, 'hidden');
  await act(async () => video.dispatchEvent(new win.Event('timeupdate')));
  assert.equal(progressEvents.at(-1)[2], false);
  await act(async () => { const pointer = new win.Event('pointerdown', { bubbles: true }); Object.defineProperty(pointer, 'pointerType', { value: 'touch' }); video.dispatchEvent(pointer); video.click(); });
  assert.equal(player.dataset.controls, 'visible'); assert.equal(pauses, 0);
  await hide(); assert.equal(player.dataset.controls, 'hidden');
  await act(async () => doc.querySelector('button[aria-label="Pause"]').click());
  await act(async () => video.dispatchEvent(new win.Event('canplay')));
  assert.equal(video.paused, true, 'a readiness event must respect an intentional pause');
  assert.equal(player.dataset.controls, 'visible');
  assert.equal(progressEvents.at(-1)[2], true);
  assert.ok(player.textContent.includes('Lecture suivante dans 3 s'));
  const settings = () => doc.querySelector('button[aria-label="Réglages du lecteur"]');
  await act(async () => settings().click());
  assert.ok(doc.querySelector('[aria-label="Fermer les réglages"]'));
  await act(async () => doc.querySelector('[aria-label="Fermer les réglages"]').click());
  await act(async () => doc.querySelector('button[aria-label="Plein écran"]').click());
  assert.ok(doc.querySelector('button[aria-label="Quitter le plein écran"]'));
  if (mode === 'standard') assert.equal(doc.fullscreenElement, player);
  if (mode === 'ios') { assert.equal(iosEntries, 0); assert.equal(player.dataset.expanded, 'true'); }
  if (mode === 'fallback') assert.equal(player.dataset.expanded, 'true');
  await act(async () => root.render(React.createElement(exports.default, { src: hlsMode ? '/episode-2.m3u8' : '/episode-2.mp4', title: 'Épisode 2', resumeAt: 0, controlRef: React.createRef(), onProgress() {}, onState() {}, onEnded() {}, onExit() {} })));
  assert.equal(doc.querySelector('[data-controls]'), player, 'the fullscreen container survives an episode change');
  assert.equal(doc.querySelector('video'), video, 'the video element survives an episode change');
  if (mode === 'standard') assert.equal(doc.fullscreenElement, player);
  else assert.equal(player.dataset.expanded, 'true');
  await act(async () => doc.querySelector('button[aria-label="Quitter le plein écran"]').click());
  assert.ok(doc.querySelector('button[aria-label="Plein écran"]'));
  await act(async () => root.unmount());
  assert.equal([...timers].filter(([, timer]) => timer.delay === 3000).length, 0);
  dom.window.close();
  console.log('PASS:', mode, 'autohide, touch reveal without pause, pause, settings, fullscreen enter/exit, cleanup');
}
(async () => { await check('standard'); await check('ios'); await check('fallback'); await check('standard', true); await check('standard', true, true); await check('ios', true, false, true); })().catch(error => { console.error(error); process.exitCode = 1; });
