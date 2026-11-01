import { NextResponse } from 'next/server';
import { buildCatalogueNews, readCatalogueNews, writeCatalogueNews, type CatalogueNews } from '@/lib/catalogue-news';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// Public TMDB metadata only. A scheduled function refreshes it every six hours;
// past twelve hours, or before its first run, it is rebuilt here.
const MAX_AGE = 12 * 3600000;
// Every step is bounded so the answer always comes before Netlify's 30 s limit.
const within = <T,>(task: Promise<T>, ms: number) => Promise.race([task, new Promise<null>(resolve => setTimeout(() => resolve(null), ms))]);
let memory: CatalogueNews | null = null;
let pending: Promise<CatalogueNews | null> | null = null;

export async function GET() {
  if (!memory || Date.now() - memory.at >= MAX_AGE) {
    const stored = await within(readCatalogueNews(), 3000);
    if (stored && Date.now() - stored.at < MAX_AGE) memory = stored;
    else if (process.env.TMDB_API_KEY) {
      pending ??= within(buildCatalogueNews(process.env.TMDB_API_KEY), 22000).catch(() => null).finally(() => { pending = null; });
      const built = await pending;
      if (built) { memory = built; await within(writeCatalogueNews(built), 3000); }
      else memory ??= stored;
    } else memory ??= stored;
  }
  if (!memory) return NextResponse.json({ error: 'Les nouveautés sont en préparation. Réessaie dans une minute.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  return NextResponse.json(memory, { headers: { 'Cache-Control': 'public, max-age=300', 'Netlify-CDN-Cache-Control': 'public, s-maxage=600' } });
}
