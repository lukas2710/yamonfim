import { buildCatalogue, writeCatalogueSnapshot } from '../../lib/catalogue-snapshot';

// Keeps the public catalogue ready in Netlify Blobs, so /api/catalogue never
// waits for Supabase on a cold cache.
export default async function refreshCatalogue() {
  const rows = await buildCatalogue();
  const saved = await writeCatalogueSnapshot(rows);
  console.log(`Catalogue: ${rows.length} titres${saved ? ' enregistrés' : ', enregistrement impossible'}`);
}

export const config = { schedule: '*/5 * * * *' };
