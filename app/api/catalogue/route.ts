import { NextResponse } from 'next/server';
import { buildCatalogue, readCatalogueSnapshot, writeCatalogueSnapshot } from '@/lib/catalogue-snapshot';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// The catalogue is public (anon select policy). Serving it through the CDN keeps
// every visit from downloading the full card list from Supabase, which exhausted
// the project's egress quota.
const CDN_CACHE = 'public, s-maxage=300, stale-while-revalidate=86400';
// « durable » shares one copy across Netlify edge nodes: visitors get it at once
// while a stale copy is refreshed in the background.
const NETLIFY_CACHE = 'public, durable, s-maxage=300, stale-while-revalidate=86400';
// The scheduled refresh runs every five minutes. Keep serving the last known
// good snapshot when Supabase is slow or unavailable; never block visitors on
// rebuilding a catalogue with thousands of rows.
let memory: { rows: unknown[]; expires: number } | null = null;
let pending: Promise<unknown[]> | null = null;

async function catalogue() {
  const snapshot = await readCatalogueSnapshot();
  if (snapshot) return snapshot.rows;
  const rows = await buildCatalogue();
  await writeCatalogueSnapshot(rows);
  return rows;
}

export async function GET(request: Request) {
  try {
    if (!memory || memory.expires <= Date.now()) {
      pending ??= catalogue().finally(() => { pending = null; });
      memory = { rows: await pending, expires: Date.now() + 300000 };
    }
    const url = new URL(request.url);
    const paged = url.searchParams.has('limit') || url.searchParams.has('offset');
    const limit = paged ? Math.max(1, Math.min(2000, Number(url.searchParams.get('limit')) || 1000)) : memory.rows.length;
    const offset = paged ? Math.max(0, Number(url.searchParams.get('offset')) || 0) : 0;
    const rows = memory.rows.slice(offset, offset + limit);
    const end = rows.length ? offset + rows.length - 1 : offset;
    return NextResponse.json(rows, { headers: {
      'Cache-Control': 'public, max-age=60', 'CDN-Cache-Control': CDN_CACHE, 'Netlify-CDN-Cache-Control': NETLIFY_CACHE,
      'Content-Range': `items ${offset}-${end}/${memory.rows.length}`,
    } });
  } catch {
    return NextResponse.json({ error: 'Le catalogue ne peut pas être chargé. Réessaie dans un instant.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
