// The catalogue and background worker share the site's authenticated origin.
const importSite = location.protocol === 'file:' ? 'https://yamonfi.netlify.app' : location.origin;
const importStates = new Map(), importQueue = [];
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
  button.disabled = !catalogueStatusReady || !!(dbDone.has(id) || state?.busy || state?.ok);
  button.textContent = dbDone.has(id) || state?.ok ? 'Ajouté sur le site ✓' : !catalogueStatusReady ? 'Vérification…' : state?.busy ? 'Ajout en cours…' : state?.error ? 'Réessayer l’ajout' : 'Ajouter au site ＋';
  button.title = state?.error || 'Ajouter directement sur ton site';
  button.onclick = () => {
    if (!catalogueStatusReady || dbDone.has(id) || importStates.get(id)?.busy || importStates.get(id)?.ok) return;
    importQueue.push({ id, type: item.kind === 'movie' ? 'movie' : 'series', job: crypto.randomUUID() });
    importStates.set(id, { busy: true }); sendImport(); render();
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
    if (message.ok === true) { dbDone.add(message.id); rebuildDone(); }
    directStatus.textContent = message.ok === true ? (message.already ? 'Déjà présent sur ton site ✓' : 'Ajouté sur ton site ✓') : String(message.error || 'Ajout impossible. Réessaie.');
    importPending = null; render(); sendImport();
  }
});
const directStatus = document.createElement('p');
directStatus.id = 'directImportStatus'; directStatus.className = 'note'; directStatus.setAttribute('role', 'status');
directStatus.textContent = 'Clique sur « Ajouter au site ». Les ajouts se font ici, en arrière-plan. Tu peux sélectionner plusieurs titres.';
document.querySelector('.toolbar').append(directStatus);
if (location.origin === importSite) {
  importChannel = crypto.randomUUID(); importFrame = document.createElement('iframe');
  importFrame.hidden = true; importFrame.title = 'Ajout automatique au catalogue';
  importFrame.src = importSite + '/catalogue-import#channel=' + encodeURIComponent(importChannel);
  document.body.append(importFrame);
  setInterval(() => { if (!importReady) importFrame.contentWindow?.postMessage({ action: 'catalogue:hello', channel: importChannel }, importSite); }, 1500);
}
