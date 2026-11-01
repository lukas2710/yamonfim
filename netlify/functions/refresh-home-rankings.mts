import { buildHomeRankings, writeHomeRankings } from '../../lib/home-rankings-server';
export default async function refreshHomeRankings() {
  if (!process.env.TMDB_API_KEY) return;
  await writeHomeRankings(await buildHomeRankings(process.env.TMDB_API_KEY));
}
export const config = { schedule: '15 */6 * * *' };
