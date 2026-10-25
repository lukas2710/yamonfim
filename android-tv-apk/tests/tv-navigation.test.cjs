const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const script = fs.readFileSync(path.join(__dirname, '../app/src/main/assets/tv-navigation.js'), 'utf8');

function environment(options = {}) {
  let document;
  let candidateQueries = 0, rectangleReads = 0;
  const listeners = {}, scrolls = [], clicked = [];
  const nodes = [];
  function node(id, x, y, tag = 'BUTTON', extra = {}) {
    const element = {
      id, tagName: tag, disabled: false, isContentEditable: false, attributes: {}, children: [], classes: new Set(),
      textContent: id, hidden: false,
      getAttribute(name) { return this.attributes[name] ?? null; },
      setAttribute(name, value) { this.attributes[name] = value; },
      getBoundingClientRect() { rectangleReads++; return this.hidden ? { left: 0, right: 0, top: 0, bottom: 0, width: 0, height: 0 } : { left: x, top: y, right: x + 120, bottom: y + 50, width: 120, height: 50 }; },
      closest() { return null; },
      contains(item) { return item === this || this.children.includes(item); },
      matches() { return tag !== 'BODY' && tag !== 'DIALOG'; },
      focus() { document.activeElement = this; },
      scrollIntoView() { this.scrolled = true; },
      click() { clicked.push(id); if (this.close) modal.hidden = true; },
      querySelectorAll() { return this.children; },
      ...extra,
    };
    element.classList = { contains(name) { return element.classes.has(name); }, add(name) { element.classes.add(name); }, remove(name) { element.classes.delete(name); } };
    nodes.push(element);
    return element;
  }
  const a = node('a', 0, 50), b = node('b', 150, 50), disabled = node('disabled', 300, 50, 'BUTTON', { disabled: true });
  const c = node('c', 0, 150, 'DIV'), d = node('d', 150, 150), search = node('search', 0, 250, 'INPUT');
  const iframe = node('iframe', 450, 150, 'IFRAME');
  const modal = node('modal', 0, 0, 'DIALOG', { hidden: !options.modal });
  const vip = node('vip', 100, 100), close = node('close', 250, 100, 'BUTTON', { textContent: 'Fermer', close: true });
  modal.children = [vip, close];
  const tiny = node('tiny', 300, 250, 'INPUT', { type: 'checkbox', getBoundingClientRect() { return { left:300,top:250,right:301,bottom:251,width:1,height:1 }; } });
  const watched = node('watched', 300, 250, 'LABEL', { control: tiny });
  if (options.rail) {
    const rail = { contains: item => item === a || item === b, querySelectorAll: () => [a,b] };
    a.closest = b.closest = selector => selector === '#yamon-tv-rail' ? rail : null;
  }
  const main = [a, b, disabled, c, d, search, iframe];
  if (options.checkbox) main.push(tiny, watched);
  document = {
    activeElement: null, body: { children: [] }, head: { appendChild() {} }, fullscreenElement: null,
    createElement() { return {}; }, contains(item) { return nodes.includes(item); },
    addEventListener(name, fn) { listeners[name] = fn; },
    exitFullscreen() { document.fullscreenElement = null; },
    querySelectorAll(selector) {
      if (selector === 'label') return options.checkbox ? [watched] : [];
      if (selector === '.ytv-focus') return nodes.filter(item => item.classes.has('ytv-focus'));
      if (selector.includes('[role="dialog"]')) return [modal];
      candidateQueries++;
      return main;
    },
  };
  document.activeElement = document.body;
  const window = { addEventListener() {}, scrollBy(value) { scrolls.push(value); } };
  vm.runInNewContext(script, {
    window, document, innerWidth: 1280, innerHeight: 720,
    getComputedStyle: () => ({ display: 'block', visibility: 'visible' }),
    MutationObserver: class { observe() {} }, setTimeout, clearTimeout,
  });
  function key(value) {
    const event = { key: value, target: document.activeElement, preventDefault() { this.prevented = true; }, stopPropagation() {} };
    listeners.keydown(event);
    return event;
  }
  return { document, window, key, queryCount: () => candidateQueries, rectangleReads: () => rectangleReads, scroll: () => listeners.scroll(), nodes: { a, b, c, d, search, iframe, vip, close, modal, tiny, watched }, scrolls, clicked };
}

test('initial focus is assigned to a real selectable control', () => {
  const e = environment(); assert.equal(e.document.activeElement.id, 'a'); assert.ok(e.nodes.a.classes.has('ytv-focus'));
});
test('right navigation follows the row and skips disabled controls', () => {
  const e = environment(); e.key('ArrowRight'); assert.equal(e.document.activeElement.id, 'b');
  e.key('ArrowRight'); assert.equal(e.document.activeElement.id, 'iframe');
});
test('down and left navigation choose the aligned controls', () => {
  const e = environment(); e.key('ArrowRight'); e.key('ArrowDown'); assert.equal(e.document.activeElement.id, 'd');
  e.key('ArrowLeft'); assert.equal(e.document.activeElement.id, 'c');
});
test('moving focus removes the previous highlight and scrolls the target into view', () => {
  const e = environment(); e.key('ArrowRight'); assert.equal(e.nodes.a.classes.has('ytv-focus'), false);
  assert.ok(e.nodes.b.classes.has('ytv-focus')); assert.equal(e.nodes.b.scrolled, true);
});
test('typing and cursor keys inside a text field keep their normal behavior', () => {
  const e = environment(); e.nodes.search.focus(); const event = e.key('ArrowRight');
  assert.equal(event.prevented, undefined); assert.equal(e.document.activeElement.id, 'search');
});
test('a visible modal confines navigation to its own buttons', () => {
  const e = environment({ modal: true }); assert.equal(e.document.activeElement.id, 'vip');
  e.key('ArrowRight'); assert.equal(e.document.activeElement.id, 'close');
});
test('Back closes a modal through its existing close control', () => {
  const e = environment({ modal: true }); assert.equal(e.window.YamonTv.back(), true);
  assert.deepEqual(e.clicked, ['close']); assert.equal(e.nodes.modal.hidden, true);
});
test('Back exits DOM fullscreen before navigating away', () => {
  const e = environment(); e.document.fullscreenElement = {};
  assert.equal(e.window.YamonTv.back(), true); assert.equal(e.document.fullscreenElement, null);
});
test('Back without a modal returns control to native Android history', () => {
  assert.equal(environment().window.YamonTv.back(), false);
});
test('an exhausted direction scrolls instead of trapping the remote', () => {
  const e = environment(); e.key('ArrowUp'); assert.equal(e.scrolls.length, 1); assert.ok(e.scrolls[0].top < 0);
});
test('video iframes can receive focus without reading their cross-origin document', () => {
  const e = environment(); e.nodes.d.focus(); e.key('ArrowRight'); assert.equal(e.document.activeElement.id, 'iframe');
});
test('installing the navigation adapter twice does not reset focus', () => {
  const e = environment(); e.key('ArrowRight');
  vm.runInNewContext(script, { window: e.window }); assert.equal(e.document.activeElement.id, 'b');
});


test('repeated remote movements reuse the selectable list instead of rescanning the page', () => {
  const e = environment();
  const initial = e.queryCount();
  e.key('ArrowRight'); e.key('ArrowDown'); e.key('ArrowLeft'); e.key('ArrowUp');
  assert.equal(e.queryCount(), initial);
});


test('OK supplies normalized touch coordinates for React tiles and regular buttons', () => {
  const e = environment();
  assert.equal(e.window.YamonTv.target().x, 60 / 1280);
  assert.equal(e.window.YamonTv.target().y, 75 / 720);
  e.nodes.c.focus(); assert.ok(e.window.YamonTv.target().y > 0);
});
test('cross-origin video frames retain native OK handling', () => {
  const e = environment(); e.nodes.iframe.focus(); assert.equal(e.window.YamonTv.target(), null);
});
test('OK cannot activate a background control behind a modal', () => {
  const e = environment({modal:true}); e.nodes.a.focus(); assert.equal(e.window.YamonTv.target(), null);
});
test('custom hidden watch checkboxes expose their visible clickable label to the remote', () => {
  const e = environment({checkbox:true});
  assert.equal(e.nodes.watched.getAttribute('tabindex'), '0');
  e.nodes.iframe.focus(); e.key('ArrowDown'); assert.equal(e.document.activeElement.id, 'watched');
  assert.ok(e.window.YamonTv.target());
  e.nodes.tiny.focus(); assert.equal(e.window.YamonTv.target(), null);
});

test('nearby directional moves reuse measured rectangles on the TV', () => {
  const e = environment(); e.nodes.d.focus();
  e.window.YamonTv.move('ArrowRight');
  const reads = e.rectangleReads();
  e.window.YamonTv.move('ArrowLeft');
  assert.equal(e.rectangleReads(), reads);
});
test('scroll invalidates cached positions before the next remote movement', () => {
  const e = environment(); e.nodes.d.focus(); e.window.YamonTv.move('ArrowLeft');
  const reads = e.rectangleReads(); e.scroll(); e.window.YamonTv.move('ArrowRight');
  assert.ok(e.rectangleReads() > reads);
});
test('onscreen controls are focused without issuing another scroll', () => {
  const e = environment(); e.nodes.c.focus(); e.window.YamonTv.move('ArrowRight');
  assert.equal(e.document.activeElement, e.nodes.d);
  assert.equal(e.nodes.d.scrolled, undefined);
});

test('vertical menu navigation stays in the TV rail without scrolling the catalogue', () => {
  const e = environment({rail:true}); e.nodes.b.focus(); e.key('ArrowDown');
  assert.equal(e.document.activeElement, e.nodes.b); assert.equal(e.scrolls.length,0);
});
test('Right from the TV rail returns to the previous catalogue selection', () => {
  const e = environment({rail:true}); e.nodes.c.focus(); e.key('ArrowRight');
  assert.equal(e.document.activeElement,e.nodes.d); e.nodes.a.focus(); e.key('ArrowRight');
  assert.equal(e.document.activeElement,e.nodes.d);
});
