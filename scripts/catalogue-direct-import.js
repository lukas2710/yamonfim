// The catalogue and background worker share the site's authenticated origin.
const importSite = location.protocol === 'file:' ? 'https://yamonfi.netlify.app' : location.origin;
const importStates = new Map(), importQueue = [];
const unavailableKey = 'moviez-unavailable-films-v1';
let unavailableImports = new Map();
try {
  const saved = JSON.parse(localStorage.getItem(unavailableKey) || '[]');
  if (Array.isArray(saved)) unavailableImports = new Map(saved.filter(row => Array.isArray(row) && /^\d+$/.test(row[0]) && typeof row[1] === 'string'));
} catch { /* Storage may be unavailable. */ }
function saveUnavailableImports() {
  try { localStorage.setItem(unavailableKey, JSON.stringify([...unavailableImports])); }
  catch { directStatus.textContent = 'Les films non disponibles sont ignorés pour cette session. Leur mémorisation est impossible dans ce navigateur.'; }
}

let importFrame = null, importChannel = '', importPending = null, importReady = false, catalogueStatusReady = false;
function sendImport() {
  if (!importReady || !importFrame?.contentWindow || importPending) return;
  importPending = importQueue.shift() || null;
  if (!importPending) return;
  importFrame.contentWindow.postMessage({ ...importPending, channel: importChannel, action: 'catalogue:add' }, importSite);
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
  if (!importPending || message.job !== importPending.job || message.id !== importPending.id || message.type !== importPending.type) return;
  if (message.action === 'catalogue:result') {
    importStates.set(message.id, message.ok === true ? { ok: true, confirmedAt: Date.now() } : { error: String(message.error || 'Ajout impossible') });
    if (message.ok === true) { dbDone.add(message.id); unavailableImports.delete(message.id); rebuildDone(); }
    else { unavailableImports.set(message.id, String(message.error || 'Ajout impossible')); }
    saveUnavailableImports();
    directStatus.textContent = message.ok === true ? (message.already ? 'Déjà présent sur ton site ✓' : 'Ajouté sur ton site ✓') : 'Non disponible : ' + String(message.error || 'Ajout impossible');
    importPending = null; updateBulkStatus(); render(); sendImport();
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
const stopImportsButton = document.createElement('button');
stopImportsButton.textContent = 'Arrêter les ajouts en attente';
const resetUnavailableButton = document.createElement('button');
resetUnavailableButton.textContent = 'Réinitialiser les films non disponibles';
resetUnavailableButton.onclick = () => { unavailableImports.clear(); saveUnavailableImports(); render(); };
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
  bulkStatus.textContent = bulkTotal ? bulkFinished + ' / ' + bulkTotal + ' titres traités · ' + importQueue.length + ' en attente' + (bulkErrors ? ' · ' + bulkErrors + ' film(s) non disponible(s), ignoré(s) lors des prochains ajouts.' : '') + '. Garde cet onglet ouvert jusqu’à la fin.' : '';
}
function updateBulkControls() {
  addPageButton.disabled = !catalogueStatusReady || !cataloguePageItems.some(canQueueImport);
  stopImportsButton.disabled = !importQueue.length;
  resetUnavailableButton.disabled = !unavailableImports.size;
}
addPageButton.onclick = () => queueImportItems(cataloguePageItems);
stopImportsButton.onclick = () => {
  for (const item of importQueue) importStates.delete(item.id);
  bulkTotal -= importQueue.length; importQueue.length = 0;
  updateBulkStatus(); render();
};
bulkControls.append(addPageButton, stopImportsButton, resetUnavailableButton);
document.querySelector('.toolbar').append(bulkControls, bulkStatus);
