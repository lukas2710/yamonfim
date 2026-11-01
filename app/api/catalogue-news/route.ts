import { NextResponse } from 'next/server';
import { buildCatalogueNews, readCatalogueNews, writeCatalogueNews } from '@/lib/catalogue-news';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// Public TMDB metadata only. A scheduled function refreshes it every six hours;
// past twelve hours, or before its first run, it is rebuilt here.
const MAX_AGE = 12 * 3600000;
export async function GET() {
  const stored = await readCatalogueNews();
  let news = stored && Date.now() - stored.at < MAX_AGE ? stored : null;
  if (!news && process.env.TMDB_API_KEY) {
    try { news = await buildCatalogueNews(process.env.TMDB_API_KEY); await writeCatalogueNews(news); } catch { news = stored; }
  }
  if (!news) return NextResponse.json({ error: 'Les nouveautés sont momentanément indisponibles.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  return NextResponse.json(news, { headers: { 'Cache-Control': 'public, max-age=300', 'Netlify-CDN-Cache-Control': 'public, s-maxage=600' } });
}
