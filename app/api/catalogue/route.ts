import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseUrl, supabaseAnonKey } from '@/lib/supabase';
import { fetchCatalogueCards } from '@/lib/catalogue';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// The catalogue is public (anon select policy). Serving it through the CDN keeps
// every visit from downloading the full card list from Supabase, which exhausted
// the project's egress quota.
const CDN_CACHE = 'public, s-maxage=300, stale-while-revalidate=3600';
const client = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false } });
let memory: { rows: unknown[]; expires: number } | null = null;
let pending: Promise<unknown[]> | null = null;

export async function GET() {
  try {
    if (!memory || memory.expires <= Date.now()) {
      pending ??= fetchCatalogueCards(client).finally(() => { pending = null; });
      memory = { rows: await pending, expires: Date.now() + 300000 };
    }
    return NextResponse.json(memory.rows, { headers: { 'Cache-Control': 'public, max-age=60', 'CDN-Cache-Control': CDN_CACHE, 'Netlify-CDN-Cache-Control': CDN_CACHE } });
  } catch {
    return NextResponse.json({ error: 'Le catalogue ne peut pas être chargé. Réessaie dans un instant.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
