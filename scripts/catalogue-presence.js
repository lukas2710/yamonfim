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
    if (row.type !== catalogueType) continue;
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
async function syncDatabase() {
  if (syncing) return;
  syncing = true;
  const started = Date.now();
  $('#syncNow').disabled = true;
  $('#syncStatus').textContent = 'Vérification des titres déjà présents sur ton site…';
  let offset = 0, total = Infinity;
  const catalogueRows = [];
  try {
    while (offset < total) {
      const endpoint = new URL(databaseUrl + '/rest/v1/media');
      endpoint.search = new URLSearchParams({ select: 'id,title,type,tmdb_id,url,embedUrl,genres', type: 'eq.' + catalogueType, order: 'id.asc', limit: '500', offset: String(offset) });
      const response = await fetch(endpoint, { headers: { apikey: publicKey, Prefer: 'count=exact' }, cache: 'no-store', signal: AbortSignal.timeout(20000) });
      if (!response.ok) throw Error('HTTP ' + response.status);
      const range = response.headers.get('content-range');
      if (range && /^\d+$/.test(range.split('/')[1])) total = Number(range.split('/')[1]);
      const rows = await response.json();
      if (!Array.isArray(rows)) throw Error('Réponse invalide');
      catalogueRows.push(...rows); offset += rows.length;
      if (!rows.length) { if (total !== Infinity && offset < total) throw Error('Liste incomplète'); break; }
      if (total === Infinity && rows.length < 500) break;
      if (offset > 1000000) throw Error('Pagination invalide');
    }
    const matched = reconcileCatalogueRows(catalogueRows);
    const fresh = new Set(matched.keys());
    // An import completed after this read began must not be erased by its snapshot.
    for (const [id, state] of importStates) if (state.ok && state.confirmedAt >= started) fresh.add(id);
    dbDone = fresh; catalogueStatusReady = true;
    for (const item of data) {
      const row = matched.get(String(item.source_id));
      if (row && !genreCache.has(String(item.source_id))) item.genres = Array.isArray(row.genres) ? row.genres.filter(genre => typeof genre === 'string' && genre.trim()) : [];
    }
    updateGenreOptions(); rebuildDone(); render(); lastSync = new Date();
    $('#syncStatus').textContent = dbDone.size.toLocaleString('fr') + ' titres reconnus · identifiants, anciens liens et titres vérifiés · ' + lastSync.toLocaleTimeString('fr-FR');
  } catch {
    $('#syncStatus').textContent = 'Vérification momentanément indisponible. Les derniers résultats sont conservés. Clique sur « Actualiser maintenant » pour réessayer.';
  } finally { syncing = false; $('#syncNow').disabled = false; }
}
window.addEventListener('focus', () => { if (!document.hidden) void syncDatabase(); });
window.addEventListener('online', () => { if (!document.hidden) void syncDatabase(); });
// END catalogue presence
