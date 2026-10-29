import * as cheerio from 'cheerio';
import { fetchPublicRemote, readRemoteText } from './public-remote';
import { resolveMoviezStream } from './moviez-stream';
import { primaryEmbed, isSupportedEmbed, uniqueEmbeds, type CatalogueSource } from './catalogue-source';
import { hlsAudioTracks } from './remote-stream';
import { hlsQuality, compareQuality, type StreamQuality } from './stream-quality';

export async function movixEmbeds(source: CatalogueSource, signal: AbortSignal, onEmbeds?: (embeds: string[]) => void): Promise<string[]> {
  const { id, type, season, episode } = source;
  const paths = type === 'movie'
    ? ['links', 'tmdb', 'fstream', 'wiflix', 'j1f', 'swiftflow', 'cpasmal'].map(provider => `${provider}/movie/${id}`)
    : [`links/tv/${id}`, `tmdb/tv/${id}`, `fstream/tv/${id}/season/${season}`, `wiflix/tv/${id}/${season}`, `j1f/tv/${id}/season/${season}`, `swiftflow/tv/${id}/season/${season}`, `cpasmal/tv/${id}/${season}/${episode}`];
  const results = await Promise.allSettled(paths.map(async path => {
    const url = new URL(`https://api.movix.dog/api/${path}`);
    if (source.type === 'tv') { url.searchParams.set('season', String(source.season)); url.searchParams.set('episode', String(source.episode)); }
    const { response } = await fetchPublicRemote(url.href, AbortSignal.any([signal, AbortSignal.timeout(10000)]));
    if (!response.ok) { await response.body?.cancel(); return []; }
    const embeds = movixResponseEmbeds(JSON.parse(await readRemoteText(response, 1_000_000)), type === 'tv' ? episode : undefined);
    onEmbeds?.(embeds);
    return embeds;
  }));
  return [...new Set(results.flatMap(result => result.status === 'fulfilled' ? result.value : []))]
    .sort((a, b) => Number(isSupportedEmbed(b)) - Number(isSupportedEmbed(a)));
}

export function movixResponseEmbeds(body: Record<string, unknown>, episode?: number): string[] {
  const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const data = record(Array.isArray(body?.data) ? body.data[0] : body?.data);
  const current = record(body.current_episode);
  const selectedEpisode = episode !== undefined ? record(record(body.episodes)[String(episode)]) : {};
  const groups = [data.links, current.player_links, body.player_links, body.links,
    episode === undefined ? body.players : selectedEpisode.languages || selectedEpisode];
  const values: unknown[] = [];
  const visit = (value: unknown, depth = 0) => {
    if (depth > 4 || values.length > 100) return;
    if (typeof value === 'string') { if (value.startsWith('https://')) values.push(value); return; }
    if (Array.isArray(value)) { value.slice(0, 40).forEach(item => visit(item, depth + 1)); return; }
    const object = record(value);
    const url = object.decoded_url || object.clone_url || object.url || object.link;
    if (url) values.push(url);
    else Object.values(object).forEach(item => visit(item, depth + 1));
  };
  groups.forEach(group => visit(group));
  return uniqueEmbeds(values).filter(isSupportedEmbed);
}

export async function discoverCatalogueSource(source: CatalogueSource, signal: AbortSignal): Promise<CatalogueSource> {
  // Collect both providers even when Moviez works, so failover does not need a
  // catalogue lookup while the viewer is already watching.
  const secondary = await movixEmbeds(source, signal);
  return { ...source, embeds: uniqueEmbeds([primaryEmbed(source), ...(source.embeds || []).filter(isSupportedEmbed), ...secondary]) };
}

// Read only media and iframe URLs actually published in the embed. No script
// execution, private API, authentication bypass or third-party VIP resolver.
export function publishedEmbedLinks(html: string, base: string) {
  const $ = cheerio.load(html);
  const values: string[] = [];
  $('video[src],source[src],iframe[src]').each((_, element) => { const src = $(element).attr('src'); if (src) values.push(src); });
  for (const match of html.matchAll(/(?:https?:\/\/|https?:\\\/\\\/)[^\s"'<>`]+?\.m3u8(?:\?[^\s"'<>`\\]*)?/gi)) values.push(match[0].replace(/\\\//g, '/').replace(/&amp;/g, '&'));
  return [...new Set(values.flatMap(value => { try { const url = new URL(value, base); return url.protocol === 'https:' ? [url.href] : []; } catch { return []; } }))].slice(0, 12);
}

export async function resolveEmbed(embed: string, signal: AbortSignal, seen = new Set<string>(), depth = 0): Promise<{ url: string; audioTracks: ReturnType<typeof hlsAudioTracks>; quality?: StreamQuality }> {
  if (depth > 3 || seen.size >= 12 || seen.has(embed)) throw new Error('Embed non pris en charge');
  seen.add(embed);
  if (isSupportedEmbed(embed)) {
    const code = new URL(embed).pathname.split('/')[2];
    const { response } = await fetchPublicRemote(`https://embedorigin.cc/app/v1/play/${code}?embed=1`, signal);
    if (!response.ok) { await response.body?.cancel(); throw new Error('EmbedOrigin indisponible'); }
    const data = JSON.parse(await readRemoteText(response, 1_000_000));
    if (typeof data.hls !== 'string' || !data.hls.startsWith('https://')) throw new Error('Aucun flux HLS EmbedOrigin disponible');
    return resolveEmbed(data.hls, signal, seen, depth + 1);
  }
  if (new URL(embed).hostname === 'api.moviez.ac') return resolveMoviezStream(embed, signal);
  const { response, url } = await fetchPublicRemote(embed, signal, { 'User-Agent': 'Mozilla/5.0' });
  if (!response.ok) { await response.body?.cancel(); throw new Error('Embed indisponible'); }
  const text = await readRemoteText(response, 3_000_000);
  if (text.trimStart().startsWith('#EXTM3U')) {
    const audioTracks = hlsAudioTracks(text);
    if (/^#EXTINF:/m.test(text)) return { url: url.href, audioTracks };
    const variant = text.split(/\r?\n/).map(line => line.trim()).find(line => line && !line.startsWith('#'));
    if (!variant) throw new Error('Flux vide');
    await resolveEmbed(new URL(variant, url).href, signal, seen, depth + 1);
    return { url: url.href, audioTracks, quality: hlsQuality(text) };
  }
  for (const candidate of publishedEmbedLinks(text, url.href)) {
    try { return await resolveEmbed(candidate, signal, seen, depth + 1); } catch { if (signal.aborted) throw new Error('Délai dépassé'); }
  }
  throw new Error('Aucun flux HLS public dans cet embed');
}

export async function resolveBestCatalogueStream(source: CatalogueSource, excluded: string[], signal: AbortSignal, dependencies = { primary: resolveMoviezStream, embeds: movixEmbeds, resolve: resolveEmbed }) {
  const primary = primaryEmbed(source);
  if (signal.aborted) throw signal.reason || new Error('Lecture annulée');
  if (!excluded.includes(primary)) {
    try {
      const stream = await dependencies.primary(primary, AbortSignal.any([signal, AbortSignal.timeout(12000)]));
      return { ...stream, embed: primary, provider: 'Moviez', alternatives: withExtras([{ embed: primary, provider: 'Moviez', quality: stream.quality }], source) };
    } catch {
      if (signal.aborted) throw signal.reason || new Error('Lecture annulée');
      excluded = [...excluded, primary];
    }
  }
  type Result = { url: string; audioTracks: ReturnType<typeof hlsAudioTracks>; quality?: StreamQuality; embed: string; provider: string; index: number };
  const controller = new AbortController();
  const workSignal = AbortSignal.any([signal, controller.signal]);
  return new Promise<Result & { alternatives: { embed: string; provider: string; quality?: StreamQuality }[] }>((resolve, reject) => {
    const queue: string[] = [], known = new Set<string>(), results: Result[] = [], attempted: string[] = [];
    let active = 0, discovered = !!source.embeds?.length, finished = false;
    let comparison: ReturnType<typeof setTimeout> | undefined;
    const finish = () => {
      if (finished) return;
      finished = true;
      if (comparison) clearTimeout(comparison);
      signal.removeEventListener('abort', abort);
      controller.abort();
      results.sort((a, b) => compareQuality(b.quality, a.quality) || a.index - b.index);
      if (signal.aborted) { reject(signal.reason || new Error('Lecture annulée')); return; }
      if (!results.length) { reject(new CatalogueStreamError(attempted, !discovered || queue.length > 0)); return; }
      resolve({ ...results[0], alternatives: withExtras(results.map(result => ({ embed: result.embed, provider: result.provider, quality: result.quality })), source) });
    };
    const abort = () => finish();
    const add = (embeds: string[]) => {
      for (const embed of uniqueEmbeds(embeds)) if (isSupportedEmbed(embed) && !known.has(embed) && !excluded.includes(embed)) { known.add(embed); queue.push(embed); }
    };
    const pump = () => {
      if (finished) return;
      while (active < 4 && queue.length) {
        const embed = queue.shift()!, index = attempted.length;
        attempted.push(embed); active++;
        const attemptSignal = AbortSignal.any([workSignal, AbortSignal.timeout(embed === primary ? 18000 : 8000)]);
        // Start Moviez immediately: secondary discovery must never gate it.
        void Promise.resolve().then(() => embed === primary ? dependencies.primary(embed, attemptSignal) : dependencies.resolve(embed, attemptSignal)).then(stream => {
          if (finished) return;
          results.push({ ...stream, embed, provider: embed === primary ? 'Moviez' : source.extras?.includes(embed) ? EXTRA_PROVIDER : 'Movix', index });
          // Compare already responding providers briefly, never wait for a stalled one.
          if (!comparison) comparison = setTimeout(finish, 350);
        }).catch(() => { /* A failed provider must not cancel another valid source. */ }).finally(() => {
          active--;
          if (!finished) pump();
        });
      }
      if (discovered && !active && !queue.length) finish();
    };
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) { finish(); return; }
    add([primary, ...(source.extras || []), ...(source.embeds || [])]);
    pump();
    if (!discovered) void Promise.resolve().then(() => dependencies.embeds(source, workSignal, embeds => {
      if (!finished) { add(embeds); pump(); }
    })).then(embeds => {
      if (!finished) add(embeds);
    }).catch(() => { /* Moviez can still work when discovery fails. */ }).finally(() => {
      discovered = true;
      if (!finished) pump();
    });
  });
}

export const EXTRA_PROVIDER = 'Lien ajouté';
// Hand-added links stay selectable even when they were not tried or answered later.
function withExtras(alternatives: { embed: string; provider: string; quality?: StreamQuality }[], source: CatalogueSource) {
  return [...alternatives, ...(source.extras || []).filter(embed => !alternatives.some(option => option.embed === embed)).map(embed => ({ embed, provider: EXTRA_PROVIDER }))];
}

export class CatalogueStreamError extends Error {
  attempted: string[];
  hasMore: boolean;
  constructor(attempted: string[], hasMore: boolean) {
    super('Aucun flux compatible disponible sur Moviez ou Movix');
    this.attempted = attempted; this.hasMore = hasMore;
  }
}

export async function resolveCatalogueStream(source: CatalogueSource, excluded: string[], signal: AbortSignal, dependencies = { primary: resolveMoviezStream, embeds: movixEmbeds, resolve: resolveEmbed }) {
  const primary = primaryEmbed(source);
  const attempted: string[] = [];
  if (!excluded.includes(primary)) {
    attempted.push(primary);
    try { return { ...await dependencies.primary(primary, AbortSignal.any([signal, AbortSignal.timeout(18000)])), embed: primary, provider: 'Moviez' }; } catch { if (signal.aborted) throw new CatalogueStreamError(attempted, true); }
  }
  const embeds = source.embeds?.length ? source.embeds : await dependencies.embeds(source, signal);
  const candidates = uniqueEmbeds(embeds).filter(embed => embed !== primary && !excluded.includes(embed));
  for (const [index, embed] of candidates.entries()) {
    if (signal.aborted) throw new CatalogueStreamError(attempted, true);
    attempted.push(embed);
    try { return { ...await dependencies.resolve(embed, AbortSignal.any([signal, AbortSignal.timeout(8000)])), embed, provider: 'Movix' }; } catch { if (signal.aborted) throw new CatalogueStreamError(attempted, index < candidates.length - 1); }
  }
  throw new CatalogueStreamError(attempted, false);
}
