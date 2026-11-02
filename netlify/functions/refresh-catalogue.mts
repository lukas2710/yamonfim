import { refreshCatalogueSnapshot } from '../../lib/catalogue-snapshot';

// Keeps the public catalogue ready in Netlify Blobs. The API and TV app serve
// this last good snapshot between refreshes, so an hourly cadence avoids
// repeatedly reading all 26k cards from Supabase.
export default async function refreshCatalogue() {
  const result = await refreshCatalogueSnapshot();
  const action = result.full ? 'reconstruit' : `${result.updated} titre(s) récent(s) synchronisé(s)`;
  console.log(`Catalogue: ${result.count} titres, ${action}${result.saved ? ' enregistrés' : ', enregistrement impossible'}`);
}

export const config = { schedule: '0 * * * *' };
