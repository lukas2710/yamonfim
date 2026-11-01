import { NextResponse } from 'next/server';
import { buildCatalogueNews, readCatalogueNews, writeCatalogueNews } from '@/lib/catalogue-news';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// Public TMDB metadata only. A scheduled function refreshes it every six hours;
// past twelve hours, or before its first run, it is rebuilt here.
const MAX_AGE = 12 * 3600000;
export async function GET(request: Request) {
  // TEMPORARY diagnostic: step timings of a rebuild, cut before the 30 s limit.
  if (new URL(request.url).searchParams.has('diagnostic')) {
    const start = Date.now(), steps: string[] = [];
    const step = (name: string) => { steps.push(`${((Date.now() - start) / 1000).toFixed(1)} s ${name}`); };
    step(process.env.TMDB_API_KEY ? 'clé TMDB présente' : 'clé TMDB absente');
    const probe = await fetch('https://api.themoviedb.org/3/configuration?api_key=' + encodeURIComponent(process.env.TMDB_API_KEY || ''), { signal: AbortSignal.timeout(8000) }).then(r => String(r.status), e => String(e?.name));
    step(`TMDB répond ${probe}`);
    await Promise.race([buildCatalogueNews(process.env.TMDB_API_KEY || '', step).then(() => step('terminé'), e => step('erreur ' + String(e?.message || e))), new Promise(resolve => setTimeout(resolve, 24000))]);
    return NextResponse.json(steps, { headers: { 'Cache-Control': 'no-store' } });
  }
  const stored = await readCatalogueNews();
  let news = stored && Date.now() - stored.at < MAX_AGE ? stored : null;
  if (!news && process.env.TMDB_API_KEY) {
    try { news = await buildCatalogueNews(process.env.TMDB_API_KEY); await writeCatalogueNews(news); } catch { news = stored; }
  }
  if (!news) return NextResponse.json({ error: 'Les nouveautés sont momentanément indisponibles.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  return NextResponse.json(news, { headers: { 'Cache-Control': 'public, max-age=300', 'Netlify-CDN-Cache-Control': 'public, s-maxage=600' } });
}
