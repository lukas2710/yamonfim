import { buildCatalogueNews, writeCatalogueNews } from '../../lib/catalogue-news';

// Recomputes the administrator's daily news from TMDB every six hours.
export default async function refreshCatalogueNews() {
  const key = process.env.TMDB_API_KEY;
  if (!key) return console.log('Nouveautés : TMDB_API_KEY manquante');
  const news = await buildCatalogueNews(key);
  const saved = await writeCatalogueNews(news);
  console.log(`Nouveautés : ${news.series.length} séries, ${news.movies.length} films${saved ? ' enregistrés' : ', enregistrement impossible'}`);
}

export const config = { schedule: '0 */6 * * *' };
