// The catalogue and background worker share the site's authenticated origin.
const importSite = location.protocol === 'file:' ? 'https://yamonfi.netlify.app' : location.origin;
const importStates = new Map(), importQueue = [], importAttempts = new Map();
// Film and series numbers overlap on TMDB: each page keeps its own list.
const unavailableKey = 'moviez-unavailable-' + (/series/.test(location.pathname) ? 'series' : 'films') + '-v2';
let unavailableImports = new Map();
try {
  const saved = JSON.parse(localStorage.getItem(unavailableKey) || '[]');
  if (Array.isArray(saved)) unavailableImports = new Map(saved.filter(row => Array.isArray(row) && /^\d+$/.test(row[0]) && typeof row[1] === 'string'));
} catch { /* Storage may be unavailable. */ }
// Confirmed on TMDB when the pages were generated: hidden on every PC.
const knownUnavailable = new Set(typeof catalogueUnavailable === 'undefined' ? [] : catalogueUnavailable.map(String));
for (const id of knownUnavailable) unavailableImports.set(id, 'Titre indisponible sur TMDB.');
function saveUnavailableImports() {
  try { localStorage.setItem(unavailableKey, JSON.stringify([...unavailableImports].filter(([id]) => !knownUnavailable.has(id)))); }
  catch { directStatus.textContent = 'Les films non disponibles sont ignorés pour cette session. Leur mémorisation est impossible dans ce navigateur.'; }
}

let importFrame = null, importChannel = '', importPending = null, importReady = false, catalogueStatusReady = false, importTimer = 0, importFailures = 0;
const importRetryDelay = 3000;
// A login problem or a busy worker says nothing about the title itself.
const sessionError = /^(Connecte-toi|La connexion administrateur|Un ajout est déjà)/;
// What the site refuses leaves the list at once. A passing failure gets three
// tries, unless several titles in a row fail: then the site or TMDB is down.
function importFailed(job, reason, permanent) {
  const id = job.id, tries = (importAttempts.get(id) || 0) + 1;
  if (job.update || sessionError.test(reason)) {
    importStates.set(id, { error: reason }); directStatus.textContent = reason + ' Tu peux réessayer.';
    return;
  }
  if (!permanent && tries < 3) {
    importAttempts.set(id, tries); importQueue.unshift({ ...job, job: crypto.randomUUID() });
    directStatus.textContent = reason + ' Nouvel essai…';
    return;
  }
  importAttempts.delete(id);
  if (!permanent && ++importFailures >= 3) {
    importFailures = 0; importStates.set(id, { error: reason });
    for (const item of importQueue) importStates.delete(item.id);
    bulkTotal -= importQueue.length; importQueue.length = 0;
    directStatus.textContent = 'Ajouts arrêtés : le site ou TMDB ne répond plus. Relance-les dans un moment.';
    return;
  }
  unavailableImports.set(id, reason); importStates.delete(id); bulkRemoved++; saveUnavailableImports();
  directStatus.textContent = reason + ' Titre retiré de la liste.';
}
function sendImport() {
  if (!importReady || !importFrame?.contentWindow || importPending) return;
  importPending = importQueue.shift() || null;
  if (!importPending) return;
  watchImport();
  importFrame.contentWindow.postMessage({ ...importPending, channel: importChannel, action: 'catalogue:add' }, importSite);
}
// A worker that stops answering must not leave the queue on « Ajout en cours… ».
function watchImport() {
  clearTimeout(importTimer);
  if (!importPending) return;
  importTimer = setTimeout(() => {
    if (!importPending) return;
    const job = importPending; importPending = null;
    importFailed(job, 'Le site ne répond plus pour ce titre.', false);
    updateBulkStatus(); render(); setTimeout(sendImport, importRetryDelay);
  }, 120000);
}
function importButton(item) {
  const id = String(item.source_id), state = importStates.get(id);
  const button = document.createElement('button');
  button.className = 'link primary';
  button.disabled = !catalogueStatusReady || !!(dbDone.has(id) || state?.busy || state?.ok || unavailableImports.has(id));
  button.textContent = dbDone.has(id) || state?.ok ? 'Ajouté sur le site ✓' : unavailableImports.has(id) ? 'Non disponible' : !catalogueStatusReady ? 'Vérification…' : state?.busy ? 'Ajout en cours…' : state?.error ? 'Réessayer l’ajout' : 'Ajouter au site ＋';
  button.title = unavailableImports.get(id) || state?.error || 'Ajouter directement sur ton site';
  button.onclick = () => {
    if (!catalogueStatusReady || dbDone.has(id) || importStates.get(id)?.busy || importStates.get(id)?.ok) return;
    queueImportItems([item]);
  };
  return button;
}
window.addEventListener('message', event => {
  if (event.origin !== importSite || event.source !== importFrame?.contentWindow || event.data?.channel !== importChannel) return;
  const message = event.data;
  if (message.action === 'catalogue:ready') { importReady = true; sendImport(); return; }
  if (message.action === 'catalogue:auth-required') {
    importReady = false;
    directStatus.replaceChildren(document.createTextNode('Connecte-toi une fois avec ton compte administrateur : '));
    const login = document.createElement('a'); login.href = importSite + '/login'; login.target = '_blank'; login.rel = 'noopener'; login.textContent = 'Se connecter au site ↗'; directStatus.append(login); return;
  }
  if (message.action === 'catalogue:progress') {
    if (importPending && message.job === importPending.job && message.id === importPending.id) { directStatus.textContent = String(message.message || 'Ajout en cours…'); watchImport(); }
    return;
  }
  if (!importPending || message.job !== importPending.job || message.id !== importPending.id || message.type !== importPending.type) return;
  if (message.action === 'catalogue:result') {
    const job = importPending; importPending = null;
    if (message.ok === true) {
      importStates.set(job.id, { ok: true, confirmedAt: Date.now() }); importAttempts.delete(job.id); importFailures = 0;
      dbDone.add(job.id); unavailableImports.delete(job.id);
      // The site holds this title although the list did not show it: never offer it again.
      if (message.already && !job.update) unavailableImports.set(job.id, 'Déjà présent sur ton site.');
      saveUnavailableImports(); rebuildDone();
      directStatus.textContent = !message.already ? 'Ajouté sur ton site ✓' : job.update ? 'Déjà à jour sur ton site ✓' : 'Déjà présent sur ton site ✓ Titre retiré de la liste.';
    } else importFailed(job, String(message.error || 'Ajout impossible'), message.permanent === true);
    watchImport(); updateBulkStatus(); render();
    if (message.ok === true) sendImport(); else setTimeout(sendImport, importRetryDelay);
  }
});
const directStatus = document.createElement('p');
directStatus.id = 'directImportStatus'; directStatus.className = 'note'; directStatus.setAttribute('role', 'status');
directStatus.textContent = 'Ajoute les films affichés sur cette page en un clic. Garde cet onglet ouvert pendant les ajouts et connecte-toi avec ton compte administrateur.';
document.querySelector('.toolbar').append(directStatus);
if (location.origin === importSite) {
  importChannel = crypto.randomUUID(); importFrame = document.createElement('iframe');
  importFrame.hidden = true; importFrame.title = 'Ajout automatique au catalogue';
  importFrame.src = importSite + '/catalogue-import#channel=' + encodeURIComponent(importChannel);
  document.body.append(importFrame);
  setInterval(() => { if (!importReady) importFrame.contentWindow?.postMessage({ action: 'catalogue:hello', channel: importChannel }, importSite); }, 1500);
}

let cataloguePageItems = [];
const bulkControls = document.createElement('div');
bulkControls.className = 'filters';
const addPageButton = document.createElement('button');
addPageButton.textContent = 'Ajouter toute cette page au site';
addPageButton.disabled = true;
const stopImportsButton = document.createElement('button');
stopImportsButton.textContent = 'Arrêter les ajouts en attente';
const resetUnavailableButton = document.createElement('button');
resetUnavailableButton.textContent = 'Remettre les titres retirés';
resetUnavailableButton.onclick = () => {
  for (const id of [...unavailableImports.keys()]) if (!knownUnavailable.has(id)) unavailableImports.delete(id);
  saveUnavailableImports(); render();
};
const bulkStatus = document.createElement('p');
bulkStatus.className = 'note'; bulkStatus.setAttribute('role', 'status');
let bulkTotal = 0, bulkFinished = 0, bulkErrors = 0, bulkRemoved = 0;
function canQueueImport(item) {
  const id = String(item.source_id), state = importStates.get(id);
  return !dbDone.has(id) && !state?.busy && !state?.ok && !unavailableImports.has(id);
}
function queueImportItems(items) {
  if (!catalogueStatusReady) return;
  if (!importPending && !importQueue.length) { bulkTotal = 0; bulkFinished = 0; bulkErrors = 0; bulkRemoved = 0; }
  for (const item of items) {
    if (!canQueueImport(item)) continue;
    const id = String(item.source_id);
    importQueue.push({ id, type: item.kind === 'movie' ? 'movie' : 'series', job: crypto.randomUUID() });
    importStates.set(id, { busy: true }); bulkTotal++;
  }
  updateBulkStatus(); sendImport(); render();
}
function updateBulkStatus() {
  bulkFinished = bulkTotal - importQueue.length - (importPending ? 1 : 0);
  bulkErrors = [...importStates.values()].filter(state => state.error).length;
  bulkStatus.textContent = bulkTotal ? bulkFinished + ' / ' + bulkTotal + ' titres traités · ' + importQueue.length + ' en attente' + (bulkRemoved ? ' · ' + bulkRemoved + ' retiré(s) de la liste' : '') + (bulkErrors ? ' · ' + bulkErrors + ' à relancer avec « Réessayer l’ajout »' : '') + '. Garde cet onglet ouvert jusqu’à la fin.' : '';
}
function updateBulkControls() {
  addPageButton.disabled = !catalogueStatusReady || !cataloguePageItems.some(canQueueImport);
  stopImportsButton.disabled = !importQueue.length;
  resetUnavailableButton.disabled = ![...unavailableImports.keys()].some(id => !knownUnavailable.has(id));
}
addPageButton.onclick = () => queueImportItems(cataloguePageItems);
stopImportsButton.onclick = () => {
  for (const item of importQueue) importStates.delete(item.id);
  bulkTotal -= importQueue.length; importQueue.length = 0;
  updateBulkStatus(); render();
};
bulkControls.append(addPageButton, stopImportsButton, resetUnavailableButton);
document.querySelector('.toolbar').append(bulkControls, bulkStatus);
