import { buildHomeRankings, readHomeRankings, writeHomeRankings } from '@/lib/home-rankings-server';
import type { HomeRankings } from '@/lib/home-rankings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
let memory: HomeRankings | null = null;
let pending: Promise<HomeRankings> | null = null;
export async function GET() {
  if (!memory || Date.now() - memory.at > 6 * 3600000) {
    const stored = await readHomeRankings();
    if (stored) memory = stored;
    if ((!memory || Date.now() - memory.at > 6 * 3600000) && process.env.TMDB_API_KEY) {
      pending ??= buildHomeRankings(process.env.TMDB_API_KEY).then(async result => { await writeHomeRankings(result); return result; }).finally(() => { pending = null; });
      try { memory = await pending; } catch { /* Keep the last good snapshot. */ }
    }
  }
  if (!memory) return Response.json({ error: 'Classements en préparation' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  return Response.json(memory, { headers: { 'Cache-Control': 'public, max-age=300', 'Netlify-CDN-Cache-Control': 'public, durable, s-maxage=3600, stale-while-revalidate=86400' } });
}
