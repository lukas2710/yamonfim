(function () {
  'use strict';
  if (window.YamonTvShell) { window.YamonTvShell.sync(); return; }
  var storageKey = 'yamon-tv-pending-action';
  var sourceSearchTimer, syncTimer, pendingTimer;
  var lastActive = 'home', searchOpen = false, collectionsMode = false, lastOverlayFocus;
  var owned = document.createElement('div');
  owned.id = 'yamon-tv-shell';
  owned.setAttribute('data-yamon-tv-owned', 'true');
  var rail = document.createElement('nav');
  rail.id = 'yamon-tv-rail'; rail.setAttribute('aria-label', 'Menu principal de l’application TV');
  var logo = document.createElement('div');
  logo.className = 'ytv-brand'; logo.innerHTML = 'YAMON<span>FILM</span><small>TON CINÉMA · ÉDITION TV</small>';
  rail.appendChild(logo);
  var navList = document.createElement('div'); navList.className = 'ytv-nav-list'; rail.appendChild(navList);
  var buttons = {};
  var entries = [
    ['home', 'Accueil', '⌂'], ['films', 'Films', '▣'], ['series', 'Séries', '▤'],
    ['search', 'Rechercher', '⌕'], ['collections', 'Collections', '▦'],
    ['history', 'Mon historique', '↺'], ['more', 'Plus', '•••']
  ];
  function button(label, action, icon) {
    var element = document.createElement('button'); element.type = 'button';
    if (icon) { var symbol = document.createElement('span'); symbol.className = 'ytv-nav-icon'; symbol.setAttribute('aria-hidden', 'true'); symbol.textContent = icon; element.appendChild(symbol); }
    var text = document.createElement('span'); text.textContent = label; element.appendChild(text);
    element.addEventListener('click', action);
    return element;
  }
  entries.forEach(function (entry) {
    var item = button(entry[1], function () { go(entry[0]); }, entry[2]);
    item.setAttribute('data-tv-action', entry[0]); buttons[entry[0]] = item; navList.appendChild(item);
  });
  var profile = button('Mes profils', function () { navigate('/profiles'); }, '◉');
  profile.className = 'ytv-profile'; rail.appendChild(profile);
  var remoteHelp = document.createElement('p'); remoteHelp.className = 'ytv-remote-help'; remoteHelp.textContent = 'FLÈCHES + OK\nAppui long OK : commandes'; rail.appendChild(remoteHelp);
  owned.appendChild(rail);

  var topbar = document.createElement('div'); topbar.id = 'yamon-tv-topbar';
  var heading = document.createElement('div'); heading.className = 'ytv-page-heading'; topbar.appendChild(heading);
  var tvLabel = document.createElement('span'); tvLabel.className = 'ytv-tv-label'; tvLabel.textContent = 'YAMONFILM TV'; topbar.appendChild(tvLabel); owned.appendChild(topbar);

  var searchPanel = document.createElement('form'); searchPanel.id = 'yamon-tv-search'; searchPanel.hidden = true;
  var searchInput = document.createElement('input'); searchInput.type = 'search'; searchInput.placeholder = 'Un film, une série, un univers…'; searchInput.setAttribute('aria-label', 'Rechercher dans le catalogue TV');
  searchPanel.appendChild(searchInput);
  searchPanel.appendChild(button('Voir les résultats', function () { focusResult(); }));
  searchPanel.appendChild(button('Fermer', function () { closeSearch(); }));
  searchPanel.addEventListener('submit', function (event) { event.preventDefault(); focusResult(); });
  searchInput.addEventListener('input', function () { clearTimeout(sourceSearchTimer); sourceSearchTimer = setTimeout(updateOriginalSearch, 180); });
  owned.appendChild(searchPanel);
  var overlay = document.createElement('div'); overlay.id = 'yamon-tv-overlay'; overlay.hidden = true; owned.appendChild(overlay);
  document.body.appendChild(owned);
  document.documentElement.setAttribute('data-yamon-tv-interface', 'shell');

  function normalize(value) { return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase(); }
  function originalHome() { return document.querySelector('main.yf-home'); }
  function homeControl(label) {
    var home = originalHome();
    if (!home) return null;
    return Array.from(home.querySelectorAll(':scope > nav button, :scope > header nav button')).find(function (item) { return normalize(item.textContent) === normalize(label); }) || null;
  }
  function originalSearch() { return document.querySelector('main.yf-home header input[type="text"],main.yf-home header input[type="search"]'); }
  function savePending(action, prepared) {
    try { sessionStorage.setItem(storageKey, JSON.stringify({ action: action, prepared: !!prepared, time: Date.now() })); } catch (_) {}
  }
  function pending() {
    try { var value = JSON.parse(sessionStorage.getItem(storageKey)); return value && Date.now() - value.time < 600000 ? value : null; } catch (_) { return null; }
  }
  function clearPending() { try { sessionStorage.removeItem(storageKey); } catch (_) {} }
  function navigate(path) { closeOverlay(false); searchOpen = false; searchPanel.hidden = true; setFlag('data-yamon-tv-search', false); window.location.assign(path); }
  function focusResult() {
    clearTimeout(sourceSearchTimer); updateOriginalSearch();
    setTimeout(function () {
      var first = document.querySelector('#catalogue-accueil .yf-poster-card, #catalogue-accueil [role="button"]');
      if (first) { first.focus({ preventScroll: true }); first.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
    }, 100);
  }
  function updateOriginalSearch() {
    var original = originalSearch();
    if (!original) return;
    var setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(original, searchInput.value);
    original.dispatchEvent(new Event('input', { bubbles: true }));
    original.dispatchEvent(new Event('change', { bubbles: true }));
  }
  function openSearch() {
    var original = originalSearch();
    if (!original) return false;
    searchOpen = true; searchPanel.hidden = false; setFlag('data-yamon-tv-search', true); searchInput.value = original.value;
    searchInput.focus({ preventScroll: true });
    return true;
  }
  function closeSearch() { searchOpen = false; searchPanel.hidden = true; setFlag('data-yamon-tv-search', false); buttons.search.focus({ preventScroll: true }); }
  function setFlag(name, value) { var text = value ? 'true' : 'false'; if (document.documentElement.getAttribute(name) !== text) document.documentElement.setAttribute(name, text); }
  function setText(element, text) { if (element.textContent !== text) element.textContent = text; }
  function admin() {
    if (document.querySelector('main.yf-home a[href="/admin"]')) return true;
    try {
      return Object.keys(localStorage).filter(function (key) { return /^sb-.*-auth-token$/.test(key); }).some(function (key) {
        var session = JSON.parse(localStorage.getItem(key));
        var user = session && (session.user || (session.currentSession && session.currentSession.user));
        return user && normalize(user.email) === 'lukas.leclerc312@gmail.com';
      });
    } catch (_) { return false; }
  }
  function closeOverlay(restore) {
    overlay.hidden = true;
    overlay.replaceChildren();
    if (restore !== false && lastOverlayFocus && document.contains(lastOverlayFocus)) lastOverlayFocus.focus({ preventScroll: true });
  }
  function showOverlay(title, choices, description) {
    lastOverlayFocus = document.activeElement;
    overlay.replaceChildren(); overlay.hidden = false;
    var dialog = document.createElement('section'); dialog.className = 'ytv-dialog'; dialog.setAttribute('role', 'dialog'); dialog.setAttribute('aria-modal', 'true'); dialog.setAttribute('aria-label', title);
    var label = document.createElement('p'); label.className = 'ytv-eyebrow'; label.textContent = 'YAMONFILM TV'; dialog.appendChild(label);
    var titleElement = document.createElement('h2'); titleElement.textContent = title; dialog.appendChild(titleElement);
    if (description) { var paragraph = document.createElement('p'); paragraph.className = 'ytv-dialog-description'; paragraph.textContent = description; dialog.appendChild(paragraph); }
    var list = document.createElement('div'); list.className = 'ytv-dialog-actions';
    choices.forEach(function (choice) { list.appendChild(button(choice[0], function () { closeOverlay(false); choice[1](); })); });
    list.appendChild(button('Fermer', function () { closeOverlay(); })); dialog.appendChild(list); overlay.appendChild(dialog);
    list.querySelector('button').focus({ preventScroll: true });
  }
  function showMore() {
    var choices = [
      ['TV en direct', function () { navigate('/tv'); }], ['Faire une demande', function () { navigate('/requests'); }],
      ['Abonnement VIP', function () { navigate('/abonnement'); }], ['Assistance', function () { navigate('/report'); }],
      ['Mes profils', function () { navigate('/profiles'); }]
    ];
    if (admin()) choices.push(['Administration', showAdmin]);
    choices.push(['Déconnexion', function () {
      showOverlay('Te déconnecter ?', [['Me déconnecter', function () { queueHome('logout'); }]], 'Tu pourras te reconnecter avec ton compte habituel.');
    }]);
    showOverlay('Tout ton cinéma', choices);
  }
  function showAdmin() {
    showOverlay('Administration', [
      ['Catalogue', function () { navigate('/admin'); }], ['Collections', function () { navigate('/admin/collections'); }],
      ['Bannières', function () { navigate('/admin/banners'); }], ['Promotions', function () { navigate('/admin/promotions'); }],
      ['Membres et VIP', function () { navigate('/admin-vip'); }], ['Statistiques', function () { navigate('/admin/stats'); }]
    ]);
  }
  function queueHome(action) {
    clearTimeout(sourceSearchTimer);
    savePending(action, false);
    if (originalHome() && homeControl('Accueil')) { consumePending(); sync(); }
    else navigate('/');
  }
  function consumePending() {
    var todo = pending();
    if (!todo || !originalHome() || !homeControl('Accueil')) return;
    var names = { home: 'Accueil', films: 'Films', series: 'Séries' };
    if (names[todo.action]) {
      var original = homeControl(names[todo.action]);
      if (original) { clearPending(); original.click(); }
      return;
    }
    if (todo.action === 'search') { if (openSearch()) { clearPending(); sync(); } return; }
    if (todo.action === 'logout') {
      var logout = Array.from(document.querySelectorAll('main.yf-home header button')).find(function (item) { return normalize(item.textContent) === 'deconnexion'; });
      if (logout) { clearPending(); logout.click(); }
      else if (!todo.prepared) {
        var account = document.querySelector('main.yf-home button[aria-label="Menu du compte"]');
        if (account) { savePending('logout', true); account.click(); }
      }
      return;
    }
    if (todo.action === 'collections') {
      if (!todo.prepared) { savePending('collections', true); homeControl('Accueil').click(); }
      var title = document.getElementById('collections-title');
      if (title) {
        clearPending(); collectionsMode = true; title.scrollIntoView({ block: 'start', behavior: 'auto' });
        var first = title.closest('section').querySelector('button, a[href]');
        if (first) first.focus({ preventScroll: true });
        sync();
      } else {
        clearTimeout(pendingTimer);
        pendingTimer = setTimeout(function () {
          var stillPending = pending();
          if (stillPending && stillPending.action === 'collections') { clearPending(); showOverlay('Les collections', [], 'Aucune collection publiée n’est disponible pour le moment.'); }
        }, 6000);
      }
    }
  }
  function go(action) {
    if (window.YamonTvPerformance) window.YamonTvPerformance.save();
    closeOverlay(false);
    collectionsMode = action === 'collections';
    if (action !== 'search') { searchOpen = false; searchPanel.hidden = true; setFlag('data-yamon-tv-search', false); }
    if (action === 'more') { showMore(); return; }
    if (action === 'history') { navigate('/history'); return; }
    queueHome(action);
  }
  function selectedSection() {
    var path = window.location.pathname;
    if (path === '/') {
      var source = originalSearch();
      if (searchOpen || (source && source.value)) return ['search', 'Recherche'];
      var movie = homeControl('Films'), series = homeControl('Séries');
      if (movie && movie.classList.contains('text-white')) return ['films', 'Films'];
      if (series && series.classList.contains('text-white')) return ['series', 'Séries'];
      if (collectionsMode) return ['collections', 'Collections'];
      return ['home', 'Accueil'];
    }
    if (path === '/history') return ['history', 'Mon historique'];
    if (path.indexOf('/watch/') === 0) return ['home', 'Ta prochaine séance'];
    var titles = { '/tv': 'TV en direct', '/requests': 'Tes demandes', '/report': 'Assistance', '/abonnement': 'L’expérience VIP', '/vip': 'Ton espace VIP' };
    return ['more', titles[path] || (path.indexOf('/admin') === 0 ? 'Administration' : 'Ton espace')];
  }
  function sync() {
    if (!document.body.contains(owned)) document.body.appendChild(owned);
    var auth = /\/(login|profiles)\/?$/.test(window.location.pathname) || !!document.querySelector('main.yf-auth,main.yf-profiles');
    var player = !!document.querySelector('.watch-stage, .yf-tv [role="dialog"][aria-label^="Lecteur TV"]');
    var siteDialog = !!document.querySelector('main.yf-page [role="dialog"][aria-modal="true"]');
    setFlag('data-yamon-tv-auth', auth); setFlag('data-yamon-tv-player', player);
    setFlag('data-yamon-tv-dialog', siteDialog);
    setFlag('data-yamon-tv-search', searchOpen);
    var current = selectedSection();
    if (document.documentElement.getAttribute("data-yamon-tv-section") !== current[0]) document.documentElement.setAttribute("data-yamon-tv-section",current[0]);
    entries.forEach(function (entry) {
      var element = buttons[entry[0]], selected = entry[0] === current[0];
      if (selected) element.setAttribute('aria-current', 'page'); else element.removeAttribute('aria-current');
    });
    setText(heading, current[1]);
    try { var activeProfile = JSON.parse(localStorage.getItem('active_profile')); setText(profile.lastChild, activeProfile && activeProfile.name ? activeProfile.name : 'Mes profils'); } catch (_) {}
    if (!auth && !player && !siteDialog && (document.activeElement === document.body || !document.contains(document.activeElement))) buttons[current[0]].focus({ preventScroll: true });
    if (lastActive !== current[0]) { lastActive = current[0]; if (!searchOpen) searchPanel.hidden = true; }
    consumePending();
  }
  function ownMutation(record) {
    var element = record.target.nodeType === 1 ? record.target : record.target.parentElement;
    if (element && element.closest('[data-yamon-tv-owned]')) return true;
    if (record.type === 'attributes' && record.attributeName === 'class') {
      var clean = function (value) { return (value || '').split(/\s+/).filter(function (name) { return name && name !== 'ytv-focus'; }).sort().join(' '); };
      return clean(record.oldValue) === clean(element.getAttribute('class'));
    }
    return false;
  }
  new MutationObserver(function (records) {
    if (!window.document) return;
    if (document.documentElement.getAttribute('data-yamon-tv-player') === 'true' && document.querySelector('.watch-stage')) return;
    if (records.every(ownMutation)) return;
    clearTimeout(syncTimer); syncTimer = setTimeout(sync, 75);
  }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeOldValue: true, attributeFilter: ['class', 'aria-expanded'] });
  window.addEventListener('popstate', sync);
  window.YamonTvShell = { sync: sync, go: go, back: function () {
    if (!overlay.hidden) { closeOverlay(); return true; }
    if (searchOpen) { closeSearch(); return true; }
    var section = selectedSection()[0];
    if (window.location.pathname === '/' && ['films', 'series', 'search', 'collections'].indexOf(section) >= 0) {
      go('home'); buttons.home.focus({ preventScroll: true }); return true;
    }
    return false;
  } };
  sync();
})();
