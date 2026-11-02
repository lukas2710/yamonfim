import { createClient } from '@supabase/supabase-js';
import { getStore } from '@netlify/blobs';
import { CATALOGUE_CARD_COLUMNS, fetchCatalogueCards } from './catalogue';
import { supabaseUrl, supabaseAnonKey } from './supabase';

// Reading 20 000+ titles from Supabase takes the server about 17 seconds, so a
// scheduled function prepares the public card list in Netlify Blobs instead.
const STORE = 'catalogue', KEY = 'cards', SYNC_KEY = 'cards-sync';
const FULL_REFRESH_INTERVAL = 24 * 60 * 60 * 1000;
const RECENT_LOOKBACK = 24 * 60 * 60 * 1000;
const RECENT_PAGE_SIZE = 500;
// Cards show two or three lines; full descriptions were half of the payload.
const DESCRIPTION_LENGTH = 220;
export function shortenDescription(text: unknown) {
  if (typeof text !== 'string' || text.length <= DESCRIPTION_LENGTH) return text;
  const space = text.lastIndexOf(' ', DESCRIPTION_LENGTH - 1);
  return text.slice(0, space > 150 ? space : DESCRIPTION_LENGTH - 1) + '…';
}

const client = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false } });
export async function buildCatalogue() {
  const rows = await fetchCatalogueCards<{ id: string; description?: unknown }>(client);
  return rows.map(row => ({ ...row, description: shortenDescription(row.description) }));
}

export async function readCatalogueSnapshot(): Promise<{ rows: unknown[]; at: number; syncAt: number; fullAt: number } | null> {
  try {
    const store = getStore(STORE);
    const [snapshot, sync] = await Promise.all([
      store.get(KEY, { type: 'json' }) as Promise<{ rows?: unknown; at?: unknown; fullAt?: unknown } | null>,
      store.get(SYNC_KEY, { type: 'json' }) as Promise<{ at?: unknown } | null>,
    ]);
    if (!Array.isArray(snapshot?.rows) || typeof snapshot.at !== 'number') return null;
    return {
      rows: snapshot.rows,
      at: snapshot.at,
      syncAt: typeof sync?.at === 'number' ? sync.at : snapshot.at,
      fullAt: typeof snapshot.fullAt === 'number' ? snapshot.fullAt : snapshot.at,
    };
  } catch { return null; } // No Blobs outside Netlify (local development).
}
export async function writeCatalogueSnapshot(rows: unknown[], fullAt = Date.now()) {
  try {
    const store = getStore(STORE);
    const at = Date.now();
    await Promise.all([store.setJSON(KEY, { rows, at, fullAt }), store.setJSON(SYNC_KEY, { at })]);
    return true;
  } catch { return false; }
}

type CatalogueCard = { id: string | number; created_at: string; description?: unknown; [key: string]: unknown };

/** Keep the shared catalogue snapshot fresh with a small recent-items query.
 * A complete rebuild runs once per day to reconcile older edits. All existing
 * snapshot rows remain intact; the incremental path only adds or updates IDs.
 */
export async function refreshCatalogueSnapshot() {
  const snapshot = await readCatalogueSnapshot();
  const startedAt = Date.now();
  if (!snapshot || startedAt - snapshot.fullAt >= FULL_REFRESH_INTERVAL) {
    const rows = await buildCatalogue();
    const saved = await writeCatalogueSnapshot(rows, Date.now());
    return { count: rows.length, saved, full: true, updated: rows.length };
  }

  const since = new Date(Math.max(0, snapshot.syncAt - RECENT_LOOKBACK)).toISOString();
  const recent: CatalogueCard[] = [];
  for (let offset = 0; ; offset += RECENT_PAGE_SIZE) {
    const { data, error } = await client.from('media').select(CATALOGUE_CARD_COLUMNS)
      .gte('created_at', since)
      .order('created_at', { ascending: false }).order('id', { ascending: false })
      .range(offset, offset + RECENT_PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const page = (data || []) as unknown as CatalogueCard[];
    recent.push(...page);
    if (page.length < RECENT_PAGE_SIZE) break;
  }

  const normalized = recent.map(row => ({ ...row, description: shortenDescription(row.description) }));
  const oldById = new Map(snapshot.rows
    .filter((row): row is CatalogueCard => !!row && typeof row === 'object' && 'id' in row)
    .map(row => [String(row.id), row]));
  const updated = normalized.filter(row => JSON.stringify(oldById.get(String(row.id))) !== JSON.stringify(row));
  if (!updated.length) {
    try { await getStore(STORE).setJSON(SYNC_KEY, { at: startedAt }); }
    catch { return { count: snapshot.rows.length, saved: false, full: false, updated: 0 }; }
    return { count: snapshot.rows.length, saved: true, full: false, updated: 0 };
  }

  const recentIds = new Set(normalized.map(row => String(row.id)));
  const retained = snapshot.rows.filter(row => !row || typeof row !== 'object' || !('id' in row) || !recentIds.has(String((row as CatalogueCard).id)));
  const rows: unknown[] = [...normalized, ...retained];
  const saved = await writeCatalogueSnapshot(rows, snapshot.fullAt);
  return { count: rows.length, saved, full: false, updated: updated.length };
}
