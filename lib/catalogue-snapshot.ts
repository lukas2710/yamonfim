import { createClient } from '@supabase/supabase-js';
import { getStore } from '@netlify/blobs';
import { fetchCatalogueCards } from './catalogue';
import { supabaseUrl, supabaseAnonKey } from './supabase';

// Reading 20 000+ titles from Supabase takes the server about 17 seconds, so a
// scheduled function prepares the public card list in Netlify Blobs instead.
const STORE = 'catalogue', KEY = 'cards';
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

export async function readCatalogueSnapshot(): Promise<{ rows: unknown[]; at: number } | null> {
  try {
    const snapshot = await getStore(STORE).get(KEY, { type: 'json' }) as { rows?: unknown; at?: unknown } | null;
    return Array.isArray(snapshot?.rows) && typeof snapshot.at === 'number' ? { rows: snapshot.rows, at: snapshot.at } : null;
  } catch { return null; } // No Blobs outside Netlify (local development).
}
export async function writeCatalogueSnapshot(rows: unknown[]) {
  try { await getStore(STORE).setJSON(KEY, { rows, at: Date.now() }); return true; } catch { return false; }
}
