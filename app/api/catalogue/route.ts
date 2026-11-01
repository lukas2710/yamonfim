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
// The scheduled refresh runs every five minutes; past a day, rebuild here.
const SNAPSHOT_MAX_AGE = 86400000;
let memory: { rows: unknown[]; expires: number } | null = null;
let pending: Promise<unknown[]> | null = null;

async function catalogue() {
  const snapshot = await readCatalogueSnapshot();
  if (snapshot && Date.now() - snapshot.at < SNAPSHOT_MAX_AGE) return snapshot.rows;
  const rows = await buildCatalogue();
  await writeCatalogueSnapshot(rows);
  return rows;
}

export async function GET() {
  try {
    if (!memory || memory.expires <= Date.now()) {
      pending ??= catalogue().finally(() => { pending = null; });
      memory = { rows: await pending, expires: Date.now() + 300000 };
    }
    return NextResponse.json(memory.rows, { headers: { 'Cache-Control': 'public, max-age=60', 'CDN-Cache-Control': CDN_CACHE, 'Netlify-CDN-Cache-Control': NETLIFY_CACHE } });
  } catch {
    return NextResponse.json({ error: 'Le catalogue ne peut pas être chargé. Réessaie dans un instant.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
