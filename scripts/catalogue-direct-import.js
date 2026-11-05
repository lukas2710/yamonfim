// The catalogue and background worker share the site's authenticated origin.
const importSite = location.protocol === 'file:' ? 'https://yamonfi.netlify.app' : location.origin;
const importStates = new Map(), importQueue = [];
const unavailableKey = 'moviez-unavailable-films-v1';
const unavailableErrors = new Set(['Titre introuvable sur TMDB.', 'Aucune saison exploitable sur cette fiche.', 'Aucun épisode sur cette fiche. La série n’a pas été ajoutée.']);
let unavailableImports = new Map();
try {
  const saved = JSON.parse(localStorage.getItem(unavailableKey) || '[]');
  // Only a confirmed TMDB answer is permanent. Older versions stored temporary
  // auth/network/database failures here too, which incorrectly blocked retry.
  if (Array.isArray(saved)) unavailableImports = new Map(saved.filter(row => Array.isArray(row) && /^\d+$/.test(row[0]) && unavailableErrors.has(row[1])));
} catch { /* Storage may be unavailable. */ }
// Confirmed on TMDB when the pages were generated: hidden on every PC.
const knownUnavailable = new Set(typeof catalogueUnavailable === 'undefined' ? [] : catalogueUnavailable.map(String));
for (const id of knownUnavailable) unavailableImports.set(id, 'Titre indisponible sur TMDB.');
function saveUnavailableImports() {
  try { localStorage.setItem(unavailableKey, JSON.stringify([...unavailableImports].filter(([id]) => !knownUnavailable.has(id)))); }
  catch { directStatus.textContent = 'Les films non disponibles sont ignorés pour cette session. Leur mémorisation est impossible dans ce navigateur.'; }
}

let importFrame = null, importChannel = '', importPending = null, importReady = false, catalogueStatusReady = false, importTimer = 0;
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
    importStates.set(importPending.id, { error: 'Le site ne répond plus pour ce titre.' });
    directStatus.textContent = 'Le site ne répond plus pour ce titre. Tu peux réessayer.';
    importPending = null; updateBulkStatus(); render(); sendImport();
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
    importStates.set(message.id, message.ok === true ? { ok: true, confirmedAt: Date.now() } : { error: String(message.error || 'Ajout impossible') });
    if (message.ok === true) { dbDone.add(message.id); unavailableImports.delete(message.id); rebuildDone(); }
    else if (message.permanent === true && unavailableErrors.has(message.error)) { unavailableImports.set(message.id, message.error); importStates.delete(message.id); }
    else unavailableImports.delete(message.id);
    saveUnavailableImports();
    directStatus.textContent = message.ok === true ? (message.already ? 'Déjà présent sur ton site ✓' : 'Ajouté sur ton site ✓') : String(message.error || 'Ajout impossible') + (message.permanent ? ' Titre retiré de la liste.' : ' Tu peux réessayer.');
    importPending = null; watchImport(); updateBulkStatus(); render(); sendImport();
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
resetUnavailableButton.textContent = 'Réinitialiser les films non disponibles';
resetUnavailableButton.onclick = () => {
  for (const id of [...unavailableImports.keys()]) if (!knownUnavailable.has(id)) unavailableImports.delete(id);
  saveUnavailableImports(); render();
};
const bulkStatus = document.createElement('p');
bulkStatus.className = 'note'; bulkStatus.setAttribute('role', 'status');
let bulkTotal = 0, bulkFinished = 0, bulkErrors = 0;
function canQueueImport(item) {
  const id = String(item.source_id), state = importStates.get(id);
  return !dbDone.has(id) && !state?.busy && !state?.ok && !unavailableImports.has(id);
}
function queueImportItems(items) {
  if (!catalogueStatusReady) return;
  if (!importPending && !importQueue.length) { bulkTotal = 0; bulkFinished = 0; bulkErrors = 0; }
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
  bulkStatus.textContent = bulkTotal ? bulkFinished + ' / ' + bulkTotal + ' titres traités · ' + importQueue.length + ' en attente' + (bulkErrors ? ' · ' + bulkErrors + ' échec(s), à relancer avec « Réessayer l’ajout »' : '') + '. Garde cet onglet ouvert jusqu’à la fin.' : '';
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
