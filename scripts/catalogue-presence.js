// BEGIN catalogue presence
// catalogueIdentity is generated from the same identity code as the admin form.
const catalogueType = data[0]?.kind === 'movie' ? 'movie' : 'series';
const catalogueTitles = new Map();
for (const item of data) {
  const title = catalogueIdentity.normalizeContentTitle(item.title);
  const candidates = catalogueTitles.get(title) || [];
  candidates.push(item); catalogueTitles.set(title, candidates);
}
function reconcileCatalogueRows(rows) {
  const found = new Map();
  for (const row of rows) {
    if (row.type !== catalogueType || catalogueIdentity.isEmptyFilm(row)) continue;
    const id = catalogueIdentity.contentTmdbId(row);
    if (id) { if (valid.has(id)) found.set(id, row); continue; }
    let candidates = catalogueTitles.get(catalogueIdentity.normalizeContentTitle(row.title || '')) || [];
    const year = (row.title || '').match(/\((\d{4})\)\s*$/)?.[1];
    if (year) candidates = candidates.filter(item => String(item.year) === year);
    const ids = new Set(candidates.map(item => String(item.source_id)));
    // A title shared by several remakes is not enough to mark them all added.
    if (ids.size === 1) found.set([...ids][0], row);
  }
  return found;
}
function hideCatalogueItem(item, selectedFilter) {
  const id = String(item.source_id);
  if (unavailableImports.has(id)) return true;
  if (selectedFilter !== 'news' || !dbDone.has(id)) return false;
  return window.yfNews?.get(id)?.update !== true;
}
async function syncDatabase() {
  if (syncing) return;
  syncing = true;
  const started = Date.now();
  $('#syncNow').disabled = true;
  $('#syncStatus').textContent = 'Vérification des titres déjà présents sur ton site…';
  let catalogueRows = cachedCatalogueRows;
  try {
    if (!catalogueRows || Date.now() - cachedCatalogueAt >= 5 * 60 * 1000) {
      const response = await fetch('/api/catalogue', { cache: 'force-cache', signal: AbortSignal.timeout(20000) });
      if (!response.ok) throw Error('Catalogue indisponible');
      const rows = await response.json();
      if (!Array.isArray(rows)) throw Error('Réponse catalogue invalide');
      cachedCatalogueRows = rows;
      cachedCatalogueAt = Date.now();
      catalogueRows = rows;
    }
    const endpoint = new URL(databaseUrl + '/rest/v1/media');
    endpoint.search = new URLSearchParams({ select: 'id,title,type,tmdb_id,url,embedUrl,genres', type: 'eq.' + catalogueType, order: 'created_at.desc,id.desc', limit: '250' });
    // A slow read of the latest rows must not lock the add buttons: the prepared
    // list is enough, and the database still refuses real duplicates.
    let latestRows = [];
    try {
      const latestResponse = await fetch(endpoint, { headers: { apikey: publicKey }, cache: 'no-store', signal: AbortSignal.timeout(15000) });
      const rows = latestResponse.ok ? await latestResponse.json() : null;
      if (Array.isArray(rows)) latestRows = rows;
    } catch { /* Read again at the next refresh. */ }
    const latestIds = new Set(latestRows.map(row => String(row.id)));
    catalogueRows = [...latestRows, ...catalogueRows.filter(row => row.type === catalogueType && !latestIds.has(String(row.id)))];
    const matched = reconcileCatalogueRows(catalogueRows);
    const fresh = new Set(matched.keys());
    // An import completed after this read began must not be erased by its snapshot.
    for (const [id, state] of importStates) if (state.ok && state.confirmedAt >= started) fresh.add(id);
    dbDone = fresh;
    let availabilityChanged = false;
    for (const id of fresh) if (unavailableImports.delete(id)) availabilityChanged = true;
    if (availabilityChanged) saveUnavailableImports();
    catalogueStatusReady = true;
    for (const item of data) {
      const row = matched.get(String(item.source_id));
      if (row && !genreCache.has(String(item.source_id))) item.genres = Array.isArray(row.genres) ? row.genres.filter(genre => typeof genre === 'string' && genre.trim()) : [];
    }
    updateGenreOptions(); rebuildDone(); render(); lastSync = new Date();
    $('#syncStatus').textContent = dbDone.size.toLocaleString('fr') + ' titres reconnus · identifiants, anciens liens et titres vérifiés · ' + lastSync.toLocaleTimeString('fr-FR');
  } catch {
    $('#syncStatus').textContent = 'Vérification momentanément indisponible. Les derniers résultats sont conservés. Clique sur « Actualiser maintenant » pour réessayer.';
    // Without a first answer the add buttons stay locked: try again soon.
    if (!catalogueStatusReady && !document.hidden) setTimeout(() => void syncDatabase(), 5000);
  } finally { syncing = false; $('#syncNow').disabled = false; }
}
window.addEventListener('focus', () => { if (!document.hidden) void syncDatabase(); });
window.addEventListener('online', () => { if (!document.hidden) void syncDatabase(); });
// END catalogue presence
