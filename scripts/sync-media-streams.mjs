// Server/local use only. Never expose the service-role key in the browser.
import { createClient } from '@supabase/supabase-js';
import { mkdir, writeFile, rename } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fetchPublicRemote, readRemoteText, publicRemoteUrl } from '../lib/public-remote.ts';
import { catalogueEntries, moviezConfig, m3u } from './media-streams-lib.mjs';
import { playlistDuration, assertStreamDuration } from '../lib/moviez-player.ts';

const dbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!dbUrl || !secret) throw new Error('NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis');
const db = createClient(dbUrl, secret, { auth: { persistSession: false, autoRefreshToken: false } });
const output = resolve(process.env.M3U_OUTPUT || 'exports/catalogue.m3u');
const once = process.argv.includes('--once');
const refreshMs = Number(process.env.M3U_REFRESH_MINUTES || 30) * 60000;
if (!Number.isFinite(refreshMs) || refreshMs < 60000) throw new Error('M3U_REFRESH_MINUTES doit être au moins 1');

async function rows(table, columns = '*') {
  const all = [];
  for (let start = 0;; start += 500) {
    const { data, error } = await db.from(table).select(columns).order(table === 'media' ? 'id' : 'entry_key').range(start, start + 499);
    if (error) throw new Error(`${table} : ${error.message}`);
    all.push(...data);
    if (data.length < 500) return all;
  }
}

async function save(row) {
  const { error } = await db.from('media_streams').upsert({ ...row, updated_at: new Date().toISOString() });
  if (error) throw new Error(`Enregistrement impossible : ${error.message}`);
}

async function resolveStream(source) {
  if (!source) throw new Error('Lien source manquant');
  let stream = source, expires_at = null;
  const url = new URL(source);
  if (url.hostname === 'api.moviez.ac') {
    const { response } = await fetchPublicRemote(source, AbortSignal.timeout(15000));
    if (!response.ok) { await response.body?.cancel(); throw new Error(`Lecteur HTTP ${response.status}`); }
    const config = moviezConfig(await readRemoteText(response, 2_000_000));
    // Fixed HTTPS endpoint; no redirects for this token-bearing request.
    const result = await fetch('https://api.moviez.ac/api/v2/stream', {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15000),
      headers: { 'Content-Type': 'application/json', Referer: source }, body: JSON.stringify({ t: config.t }),
    });
    if (!result.ok) { await result.body?.cancel(); throw new Error(`Flux Moviez HTTP ${result.status}`); }
    const data = JSON.parse(await readRemoteText(result, 1_000_000));
    stream = data.hls;
    let manifestUrl = stream;
    let validated = false;
    for (let depth = 0; depth < 4; depth++) {
      const { response: manifest, url: finalManifest } = await fetchPublicRemote(manifestUrl, AbortSignal.timeout(15000), { 'User-Agent': 'Mozilla/5.0' });
      if (!manifest.ok) { await manifest.body?.cancel(); throw new Error('Playlist indisponible'); }
      const text = await readRemoteText(manifest, 5_000_000);
      if (!text.trimStart().startsWith('#EXTM3U')) throw new Error('Playlist invalide');
      const duration = playlistDuration(text);
      if (duration > 0) { assertStreamDuration(duration, Number(data.duration)); validated = true; break; }
      const variant = text.split(/\r?\n/).map(line => line.trim()).find(line => line && !line.startsWith('#'));
      if (!variant) throw new Error('Playlist vide');
      manifestUrl = new URL(variant, finalManifest).href;
    }
    if (!validated) throw new Error('Durée du contenu non vérifiable');
    if (data.expires != null) {
      const expiration = typeof data.expires === 'number' ? data.expires * 1000 : Date.parse(data.expires);
      if (!Number.isFinite(expiration) || expiration <= Date.now() + 60000) throw new Error('Expiration du flux invalide');
      expires_at = new Date(expiration).toISOString();
    }
  }
  if (!stream || typeof stream !== 'string') throw new Error('Aucun flux vidéo fourni');
  await publicRemoteUrl(stream);
  const { response, url: finalUrl } = await fetchPublicRemote(stream, AbortSignal.timeout(15000), { Range: 'bytes=0-4095' });
  if (!response.ok) { await response.body?.cancel(); throw new Error(`Flux inaccessible : HTTP ${response.status}`); }
  const type = response.headers.get('content-type') || '';
  if (/mpegurl/i.test(type) || /\.m3u8?$/i.test(finalUrl.pathname)) {
    const text = await readRemoteText(response, 5_000_000);
    if (!text.trimStart().startsWith('#EXTM3U')) throw new Error('Playlist HLS invalide');
  } else {
    await response.body?.cancel();
    if (!/^video\//i.test(type)) throw new Error('Le lien ne renvoie pas un flux vidéo direct');
  }
  return { stream_url: stream, expires_at };
}

async function sync() {
  const media = await rows('media', 'id,title,type,poster,url,embedUrl,seasons');
  const entries = catalogueEntries(media);
  const previous = new Map((await rows('media_streams')).map(r => [r.entry_key, r]));
  const currentKeys = new Set(entries.map(r => r.entry_key));
  let ready = 0, failed = 0;
  // Sequential requests avoid flooding the provider. A later pass retries failures.
  for (const entry of entries) {
    const old = previous.get(entry.entry_key);
    const reusable = old?.source_url === entry.source_url && old.status === 'ready' &&
      Date.parse(old.checked_at) > Date.now() - refreshMs &&
      (!old.expires_at || Date.parse(old.expires_at) > Date.now() + refreshMs + 60000);
    if (reusable) { await save({ ...old, ...entry }); ready++; continue; }
    // Clear an obsolete URL before fetching its replacement.
    await save({ ...entry, stream_url: null, expires_at: null, status: 'pending', error_message: null, checked_at: null });
    let result;
    try {
      result = { ...await resolveStream(entry.source_url), status: 'ready', error_message: null };
      ready++;
    } catch (error) {
      result = { stream_url: null, expires_at: null, status: 'error', error_message: String(error.message).slice(0, 500) };
      failed++;
    }
    await save({ ...entry, ...result, checked_at: new Date().toISOString() });
    if ((ready + failed) % 25 === 0) console.log(`${ready} flux récupérés, ${failed} indisponibles / ${entries.length}`);
  }
  // Remove only derived entries absent from a successfully loaded catalogue.
  for (const key of previous.keys()) {
    if (currentKeys.has(key)) continue;
    const { error } = await db.from('media_streams').delete().eq('entry_key', key);
    if (error) throw new Error(error.message);
  }
  const playlist = m3u(await rows('media_streams'));
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output + '.tmp', playlist, 'utf8');
  await rename(output + '.tmp', output);
  const exported = playlist.split('\n').filter(l => l.startsWith('#EXTINF:')).length;
  console.log(`${ready} récupérés, ${failed} indisponibles, ${exported} exportés : ${output}`);
}

do {
  try { await sync(); }
  catch (error) { console.error(error.message); if (once) { process.exitCode = 1; break; } }
  if (!once) await new Promise(done => setTimeout(done, refreshMs));
} while (!once);
