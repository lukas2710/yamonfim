import { buildCatalogue, writeCatalogueSnapshot } from '../../lib/catalogue-snapshot';

// Keeps the public catalogue ready in Netlify Blobs. The API and TV app serve
// this last good snapshot between refreshes, so a ten-minute cadence avoids
// repeatedly reading all 26k cards from Supabase.
export default async function refreshCatalogue() {
  const rows = await buildCatalogue();
  const saved = await writeCatalogueSnapshot(rows);
  console.log(`Catalogue: ${rows.length} titres${saved ? ' enregistrés' : ', enregistrement impossible'}`);
}

export const config = { schedule: '*/10 * * * *' };
