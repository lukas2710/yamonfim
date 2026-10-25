(function () {
  'use strict';
  if (window.YamonTvPerformance) return;
  var root = document.documentElement, placeholder = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';
  var pending = new Map(), queued = new Set(), ready = new Set(), navigationUntil = 0, workTimer, restoreTimer, saveTimer;
  var activeKey = null, restoring = false, restored = false, lastSelection = null;
  function playing() { return root.getAttribute('data-tv-playback') === 'true' || document.hidden; }
  function smallSource(source) {
    try {
      var url = new URL(source, location.href);
      // Only the public TMDB image service has known, interchangeable sizes.
      if (url.protocol !== 'https:' || url.hostname !== 'image.tmdb.org') return source;
      if (!/^\/t\/p\/(original|w[0-9]+)\//.test(url.pathname)) return source;
      var size = url.pathname.match(/^\/t\/p\/w([0-9]+)\//);
      if (size && Number(size[1]) <= 342) return source;
      url.pathname = url.pathname.replace(/^\/t\/p\/(original|w[0-9]+)\//, '/t/p/w342/');
      return url.href;
    } catch (_) { return source; }
  }
  function release(image) {
    ready.delete(image);
    var source = pending.get(image);
    if (!source) return;
    ready.delete(image); pending.delete(image); if (intersection) intersection.unobserve(image);
    if (image.getAttribute('src') === placeholder) image.setAttribute('src', source);
  }
  var intersection = typeof IntersectionObserver === 'function' ? new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) { if (entry.isIntersecting) ready.add(entry.target); else ready.delete(entry.target); });
    if (!workTimer && ready.size && !playing()) workTimer = setTimeout(drain,32);
  }, {rootMargin:'350px 300px',threshold:0}) : null;
  function optimize(image) {
    if (!image.isConnected || !image.closest('.yf-poster-card,.yf-history,.yf-collection-titles')) return;
    if (image.hasAttribute('srcset') || image.closest('.watch-stage')) return;
    var source = image.getAttribute('src');
    if (!source || source === placeholder) return;
    image.decoding = 'async'; image.loading = 'lazy'; image.setAttribute('fetchpriority','low');
    // Already decoded pictures cost no additional download: keep them intact.
    if (image.complete && image.naturalWidth > 0) return;
    source = smallSource(source);
    var bounds = image.getBoundingClientRect();
    var nearby = bounds.bottom >= -350 && bounds.top <= innerHeight + 350 && bounds.right >= -300 && bounds.left <= innerWidth + 300;
    if (!nearby && intersection) {
      pending.set(image,source); image.setAttribute('src',placeholder); intersection.observe(image);
    } else if (image.getAttribute('src') !== source) image.setAttribute('src',source);
  }
  function drain() {
    workTimer = null;
    if (playing()) return;
    if (Date.now() < navigationUntil) { workTimer = setTimeout(drain, navigationUntil - Date.now()); return; }
    var released = 0;
    for (var image of ready) { release(image); if (++released === 4) break; }
    var count = 0;
    for (var image of queued) { queued.delete(image); optimize(image); if (++count === 12) break; }
    if (queued.size || ready.size) workTimer = setTimeout(drain,32);
  }
  function enqueue(node) {
    if (node.nodeType !== 1) return;
    if (node.matches('img')) queued.add(node);
    node.querySelectorAll('img').forEach(function (image) { queued.add(image); });
    if (!workTimer && queued.size && !playing()) workTimer = setTimeout(drain,32);
  }
  function storageKey() {
    if (!document.querySelector('main.yf-page') || document.querySelector('main.yf-auth,main.yf-profiles')) return null;
    var profile = 'default';
    try { var value = JSON.parse(localStorage.getItem('active_profile')); if (value && value.id != null) profile = String(value.id); } catch (_) {}
    return 'yamon-tv-position:' + profile + ':' + location.pathname + ':' + (root.getAttribute('data-yamon-tv-section') || 'home');
  }
  function controls() { return Array.from(document.querySelectorAll('main.yf-page a[href],main.yf-page button,main.yf-page [role="button"]')).filter(function (item) { return !item.closest('header,.watch-stage,[role="dialog"]'); }); }
  function label(item) { return item.getAttribute('aria-label') || item.getAttribute('href') || item.textContent.trim().slice(0,120); }
  function scrollers() { return Array.from(document.querySelectorAll('main.yf-page .snap-x,main.yf-page [class*="overflow-x-auto"]')); }
  function save() {
    if (restoring || playing() || !activeKey || activeKey !== storageKey()) return;
    var current = document.activeElement, items = controls();
    if (!items.includes(current)) current = lastSelection;
    if (!current || !items.includes(current)) return;
    var value = {time:Date.now(),label:label(current),index:items.indexOf(current),top:window.scrollY || 0,left:scrollers().map(function (item) { return item.scrollLeft; })};
    try { sessionStorage.setItem(activeKey,JSON.stringify(value)); } catch (_) {}
  }
  function restore() {
    restoreTimer = null;
    if (playing()) return;
    var key = storageKey();
    if (!key) return;
    if (activeKey !== key) { activeKey = key; restored = false; lastSelection = null; }
    if (restored) return;
    var value;
    try { value = JSON.parse(sessionStorage.getItem(key)); } catch (_) {}
    if (!value || !Array.isArray(value.left) || Date.now() - value.time > 86400000) { restored = true; restoring = false; return; }
    var items = controls();
    var item = items[value.index];
    if (!item || label(item) !== value.label) item = items.find(function (entry) { return label(entry) === value.label; });
    // Wait for the real React catalogue instead of focusing a loading placeholder.
    if (!item) { restoring = false; return; }
    restoring = true;
    scrollers().forEach(function (entry,index) { entry.scrollLeft = Math.max(0,Number(value.left[index]) || 0); });
    window.scrollTo(0,Math.max(0,Number(value.top) || 0));
    item.focus({preventScroll:true}); restored = true; restoring = false;
  }
  function scheduleRestore() { clearTimeout(restoreTimer); restoreTimer = setTimeout(restore,200); }
  new MutationObserver(function (records) {
    records.forEach(function (record) {
      if (record.type === 'attributes') {
        var source = record.target.getAttribute('src');
        if (source !== placeholder && pending.has(record.target)) { pending.delete(record.target); if (intersection) intersection.unobserve(record.target); }
        if (source !== placeholder) enqueue(record.target);
      } else {
        record.addedNodes.forEach(enqueue);
        if (record.removedNodes.length) pending.forEach(function (_,image) { if (!image.isConnected) { ready.delete(image); pending.delete(image); if(intersection) intersection.unobserve(image); } });
      }
    });
    if (!restored) scheduleRestore();
  }).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['src']});
  new MutationObserver(function () {
    var key = storageKey();
    if (activeKey !== key) { activeKey = key; restored = false; lastSelection = null; }
    if (playing()) { clearTimeout(workTimer); workTimer = null; return; }
    if ((queued.size || ready.size) && !workTimer) workTimer = setTimeout(drain,32);
    // Intersection callbacks may have arrived while playback had priority.
    pending.forEach(function (_,image) { if (!image.isConnected) { ready.delete(image); pending.delete(image); if(intersection) intersection.unobserve(image); } else { intersection.unobserve(image); intersection.observe(image); } });
    if (!restored) scheduleRestore();
  }).observe(root,{attributes:true,attributeFilter:['data-tv-playback','data-yamon-tv-section']});
  document.addEventListener('keydown',function (event) { if (/^Arrow/.test(event.key)) navigationUntil = Date.now() + 180; },true);
  document.addEventListener('visibilitychange',function () { if (!document.hidden) { if(queued.size) drain(); scheduleRestore(); } });
  document.addEventListener('focusin',function (event) {
    if (event.target.matches('a[href],button,[role=button]') && event.target.closest('main.yf-page') && !event.target.closest('header,.watch-stage,[role=dialog]') && activeKey === storageKey()) lastSelection = event.target;
    clearTimeout(saveTimer); saveTimer = setTimeout(save,150); });
  document.addEventListener('scroll',function () { clearTimeout(saveTimer); saveTimer = setTimeout(save,200); },true);
  document.addEventListener('click',function (event) { if (event.target.closest('main.yf-page')) save(); },true);
  window.addEventListener('pagehide',save);
  window.YamonTvPerformance = {save:save,restore:restore,smallSource:smallSource};
  enqueue(document.body); scheduleRestore();
})();
