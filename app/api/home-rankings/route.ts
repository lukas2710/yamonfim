import { readHomeRankings } from '@/lib/home-rankings-server';
import type { HomeRankings } from '@/lib/home-rankings';
import bootstrap from '@/lib/home-rankings-bootstrap.json';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// A verified starting snapshot makes a first visit independent of dozens of
// provider requests. Scheduled refreshes replace it through shared Blobs.
let memory: HomeRankings = bootstrap;
let checkedAt = 0;
export async function GET() {
  if (Date.now() - checkedAt > 300000) {
    checkedAt = Date.now();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const stored = await Promise.race([readHomeRankings(), new Promise<null>(resolve => { timer = setTimeout(() => resolve(null), 1500); })]);
    clearTimeout(timer);
    if (stored && stored.at > memory.at) memory = stored;
  }
  const result = Date.now() - memory.at > 48 * 3600000 ? { ...memory, trending: { movie: [], series: [] } } : memory;
  return Response.json(result, { headers: { 'Cache-Control': 'public, max-age=300', 'Netlify-CDN-Cache-Control': 'public, durable, s-maxage=3600, stale-while-revalidate=86400' } });
}
