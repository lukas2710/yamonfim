(function () {
  'use strict';
  if (window.YamonTv) return;
  var selector = 'a[href],button,input:not([type="hidden"]),textarea,select,iframe,[role="button"],[tabindex],label[data-yamon-tv-control]';
  var style = document.createElement('style');
  style.textContent = '.ytv-focus{outline:3px solid #f87171!important;outline-offset:5px!important;scroll-margin:75px!important;box-shadow:0 0 0 7px #ef444429!important} .ytv-focus img{opacity:1}';
  document.head.appendChild(style);
  var cachedItems = null, cachedScope = null, marked = null;
  var geometry = new WeakMap(), geometryUntil = 0, lastContent = null;
  function clearGeometry() { geometry = new WeakMap(); geometryUntil = 0; }
  function rect(element) {
    if (Date.now() > geometryUntil) { geometry = new WeakMap(); geometryUntil = Date.now() + 200; }
    var value = geometry.get(element);
    if (!value) { value = element.getBoundingClientRect(); geometry.set(element, value); }
    return value;
  }
  function invalidate() { cachedItems = null; clearGeometry(); }
  function enhanceControls() {
    document.querySelectorAll('label').forEach(function (label) {
      var control = label.control;
      if (!control || !/^(checkbox|radio)$/.test(control.type)) return;
      // Custom watch markers often hide the input and draw a larger clickable label.
      var r = control.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) {
        label.setAttribute('data-yamon-tv-control', 'true');
        label.setAttribute('tabindex', '0');
      }
    });
  }

  function visible(element) {
    if (element.disabled || element.getAttribute('aria-disabled') === 'true' || element.closest('[inert],fieldset:disabled') || element.getAttribute('tabindex') === '-1') return false;
    var bounds = rect(element);
    if (bounds.width <= 0 || bounds.height <= 0) return false;
    if (element.tagName === 'INPUT' && /^(checkbox|radio)$/.test(element.type) && (bounds.width < 4 || bounds.height < 4)) return false;
    if (element.tagName === 'LABEL' && element.control && element.control.disabled) return false;
    var css = getComputedStyle(element);
    return css.display !== 'none' && css.visibility !== 'hidden';
  }
  function modal() {
    var dialogs = Array.from(document.querySelectorAll('[role="dialog"],[aria-modal="true"]')).filter(visible);
    return dialogs[dialogs.length - 1] || null;
  }
  function candidates() {
    var scope = modal() || document;
    if (!cachedItems || scope !== cachedScope) {
      enhanceControls();
      cachedScope = scope;
      cachedItems = Array.from(scope.querySelectorAll(selector)).filter(visible);
    }
    return cachedItems.filter(function (item) { return document.contains(item) && !item.disabled; });
  }
  function editable(element) {
    return element && (element.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(element.tagName));
  }
  function mark(element) {
    if (marked === element && (!marked || marked.classList.contains('ytv-focus'))) return;
    if (marked) marked.classList.remove('ytv-focus');
    marked = element && element.matches(selector) ? element : null;
    if (marked) marked.classList.add('ytv-focus');
  }
  function focus(element) {
    if (!element) return;
    element.focus({ preventScroll: true });
    var bounds = rect(element);
    if (bounds.top < 80 || bounds.bottom > innerHeight - 28 || (!element.closest('#yamon-tv-rail') && (bounds.left < 24 || bounds.right > innerWidth - 24))) {
      element.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' }); clearGeometry();
    }
    if (!element.closest('#yamon-tv-rail')) lastContent = element;
    mark(element);
  }
  function quickMove(current,direction) {
    if (!current || editable(current)) return false;
    var horizontal = direction === 'ArrowLeft' || direction === 'ArrowRight';
    var sign = direction === 'ArrowLeft' || direction === 'ArrowUp' ? -1 : 1;
    var rail = current.closest('#yamon-tv-rail');
    if (rail && !horizontal) {
      var menu = Array.from(rail.querySelectorAll('button')).filter(visible), position = menu.indexOf(current);
      if (position < 0) return false;
      if (menu[position+sign]) focus(menu[position+sign]);
      return true;
    }
    var row = current.closest('#catalogue-accueil .snap-x');
    if (!row) return false;
    var cards = Array.from(row.children).filter(function(item){ return item.matches(selector) && !item.disabled; });
    var index = cards.indexOf(current);
    if (index < 0) return false;
    if (horizontal) {
      for (var next=index+sign; next>=0 && next<cards.length; next+=sign) {
        if (visible(cards[next])) { focus(cards[next]); return true; }
      }
      return sign > 0;
    }
    // Measure rows first, then only cards in the closest row, not the entire catalogue.
    var rows = Array.from(document.querySelectorAll('#catalogue-accueil .snap-x,#catalogue-accueil .yf-collection-grid'));
    var from = rect(current), center = from.left+from.width/2, origin = rect(row), bestRow, distance = Infinity;
    rows.forEach(function(other){
      if(other===row)return;
      var bounds=rect(other), delta=(bounds.top-origin.top)*sign;
      if(bounds.height>0 && delta>3 && delta<distance){bestRow=other;distance=delta;}
    });
    if(!bestRow)return false;
    var choices=Array.from(bestRow.querySelectorAll('.yf-poster-card,[role="button"],button,a[href]')).filter(visible);
    var best,score=Infinity;
    choices.forEach(function(item){var bounds=rect(item),delta=Math.abs(bounds.left+bounds.width/2-center);if(delta<score){best=item;score=delta;}});
    if(best){focus(best);return true;}
    return false;
  }
  function move(direction) {
    if (!modal() && quickMove(document.activeElement,direction)) return true;
    var items = candidates();
    if (!items.length) return false;
    var current = document.activeElement;
    if (items.indexOf(current) === -1) {
      focus(items.find(function (item) { var r = rect(item); return r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth; }) || items[0]);
      return true;
    }
    if (editable(current)) return false;
    var from = rect(current), x = from.left + from.width / 2, y = from.top + from.height / 2;
    var horizontal = direction === 'ArrowLeft' || direction === 'ArrowRight';
    var sign = direction === 'ArrowLeft' || direction === 'ArrowUp' ? -1 : 1;
    var rail = current.closest('#yamon-tv-rail');
    if (rail && direction === 'ArrowRight' && lastContent && items.indexOf(lastContent) >= 0) { focus(lastContent); return true; }
    var best = null, bestScore = Infinity;
    items.forEach(function (item) {
      if (item === current || current.contains(item) || item.contains(current)) return;
      if (rail && !horizontal && !rail.contains(item)) return;
      var r = rect(item), dx = r.left + r.width / 2 - x, dy = r.top + r.height / 2 - y;
      var forward = (horizontal ? dx : dy) * sign, side = Math.abs(horizontal ? dy : dx);
      if (forward <= 3) return;
      var overlap = horizontal ? (r.top < from.bottom && r.bottom > from.top) : (r.left < from.right && r.right > from.left);
      var score = forward + side * (overlap ? 1.5 : 5) + (overlap ? 0 : 100);
      if (score < bestScore) { best = item; bestScore = score; }
    });
    if (best) focus(best);
    else if (!rail) window.scrollBy({ top: horizontal ? 0 : sign * innerHeight * .55, left: horizontal ? sign * innerWidth * .35 : 0, behavior: 'auto' });
    return true;
  }
  document.addEventListener('focusin', function (event) { mark(event.target); });
  window.addEventListener('resize', invalidate);
  document.addEventListener('scroll', clearGeometry, true);
  document.addEventListener('keydown', function (event) {
    if (event.target.tagName === 'IFRAME' && document.documentElement && document.documentElement.getAttribute('data-tv-playback') === 'true') return;
    if (event.altKey || event.ctrlKey || event.metaKey || event.isComposing) return;
    if (/^Arrow(Left|Right|Up|Down)$/.test(event.key) && !editable(event.target) && move(event.key)) {
      event.preventDefault(); event.stopPropagation();
    }
  }, true);
  window.YamonTv = {
    move: move,
    target: function () {
      var element = document.activeElement;
      if (!element || element.tagName === 'IFRAME' || !visible(element)) return null;
      var scope = modal();
      if (scope && !scope.contains(element)) return null;
      var r = element.getBoundingClientRect();
      // Normalized viewport coordinates let Android generate a genuine touch event.
      // This also activates React role=button tiles and opens the native keyboard.
      return { x: Math.max(.005, Math.min(.995, (r.left + r.width / 2) / innerWidth)), y: Math.max(.005, Math.min(.995, (r.top + r.height / 2) / innerHeight)) };
    },
    back: function () {
      if (window.YamonTvPlayer && window.YamonTvPlayer.back()) return true;
      if (document.fullscreenElement) { document.exitFullscreen(); return true; }
      if (window.YamonTvShell && window.YamonTvShell.back()) return true;
      var scope = modal();
      if (!scope) return false;
      var close = Array.from(scope.querySelectorAll('button')).find(function (button) {
        return /fermer|revenir|plus tard/i.test((button.getAttribute('aria-label') || '') + ' ' + button.textContent);
      });
      if (!close) return false;
      close.click(); return true;
    }
  };
  // Wait for the initial React/Supabase screen, then focus a real visible control.
  var timer;
  var navigationObserver = new MutationObserver(function (records) {
    var cleanClass = function (value) { return (value || '').split(/\s+/).filter(function (name) { return name && name !== 'ytv-focus'; }).sort().join(' '); };
    if (records.length && records.every(function (record) {
      return record.type === 'attributes' && record.attributeName === 'class' && cleanClass(record.oldValue) === cleanClass(record.target.getAttribute('class'));
    })) return;
    invalidate();
    clearTimeout(timer);
    timer = setTimeout(function () {
      var current = document.activeElement, scope = modal();
      if (!current || current === document.body || !document.contains(current) || (scope && !scope.contains(current))) {
        var items = candidates();
        focus(items.find(function (item) { var r = rect(item); return r.bottom > 0 && r.top < innerHeight; }) || items[0]);
      } else mark(current);
    }, 120);
  });
  navigationObserver.observe(document.body, { childList: true, subtree: true, attributes: true, attributeOldValue: true, attributeFilter: ['class', 'style', 'hidden', 'inert', 'disabled', 'aria-hidden', 'aria-modal', 'aria-expanded'] });
  if (document.documentElement) navigationObserver.observe(document.documentElement, { attributes:true, attributeFilter:['data-tv-controls','data-tv-episodes','data-tv-playback','data-yamon-tv-auth','data-yamon-tv-search','data-yamon-tv-dialog','data-yamon-tv-player'] });
  if (!editable(document.activeElement)) {
    if (candidates().indexOf(document.activeElement) >= 0) mark(document.activeElement);
    else focus(candidates()[0]);
  }
})();


