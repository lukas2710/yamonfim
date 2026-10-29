import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import type { LookupFunction } from 'node:net';
import { Agent as HttpAgent } from 'node:http';
import { Agent as HttpsAgent } from 'node:https';
import { Readable } from 'node:stream';
import axios from 'axios';

export function isPublicAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const [a, b] = address.split('.').map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 168 || b === 0)) ||
      (a === 100 && b >= 64 && b <= 127) || (a === 198 && (b === 18 || b === 19)));
  }
  return isIP(address) === 6 && /^[23][0-9a-f]{3}:/i.test(address) && !address.toLowerCase().startsWith('2001:db8:');
}

async function validatedRemote(value: string) {
  const url = new URL(value);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || (url.port && !['80', '443'].includes(url.port))) throw new Error('Adresse distante refusée');
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = isIP(hostname) ? [{ address: hostname, family: isIP(hostname) }] : await lookup(hostname, { all: true });
  if (!addresses.length || addresses.some(({ address }) => !isPublicAddress(address))) throw new Error('Adresse distante refusée');
  return { url, addresses };
}

export async function publicRemoteUrl(value: string): Promise<URL> { return (await validatedRemote(value)).url; }

// Reuse TLS connections between HLS segments. The pool key includes the checked
// DNS answers, so a changed/private answer can never reuse an unchecked agent.
const remoteAgents = new Map<string, { http: HttpAgent; https: HttpsAgent }>();

export async function fetchPublicRemote(value: string, signal: AbortSignal, headers: Record<string, string> = {}) {
  let target = value;
  for (let redirects = 0; redirects <= 4; redirects++) {
    const { url, addresses } = await validatedRemote(target);
    // Pin the validated DNS result for the actual connection, including redirects.
    const hostname = url.hostname.replace(/^\[|\]$/g, '');
    const pinnedLookup: LookupFunction = (_, options, callback) => {
      if (options.all) callback(null, addresses);
      else callback(null, addresses[0].address, addresses[0].family);
    };
    const poolKey = hostname + ':' + addresses.map(value => value.address).sort().join(',');
    let agents = remoteAgents.get(poolKey);
    if (!agents) {
      agents = {
        http: new HttpAgent({ lookup: pinnedLookup, keepAlive: true, maxSockets: 16, maxFreeSockets: 4, timeout: 15000 }),
        https: new HttpsAgent({ lookup: pinnedLookup, keepAlive: true, maxSockets: 16, maxFreeSockets: 4, timeout: 15000 }),
      };
      if (remoteAgents.size >= 32) remoteAgents.delete(remoteAgents.keys().next().value!);
      remoteAgents.set(poolKey, agents);
    }
    const upstream = await axios.get<Readable>(url.href, {
      responseType: 'stream', maxRedirects: 0, validateStatus: () => true,
      signal, timeout: 15000, proxy: false, headers,
      httpAgent: agents.http,
      httpsAgent: agents.https,
    });
    const responseHeaders = new Headers();
    for (const [key, value] of Object.entries(upstream.headers)) {
      if (value !== undefined && value !== null) responseHeaders.set(key, Array.isArray(value) ? value.join(', ') : String(value));
    }
    const response = new Response(Readable.toWeb(upstream.data) as ReadableStream<Uint8Array>, { status: upstream.status, headers: responseHeaders });
    if (![301, 302, 303, 307, 308].includes(response.status)) return { response, url };
    const location = response.headers.get('location');
    await response.body?.cancel();
    if (!location) throw new Error('Redirection invalide');
    target = new URL(location, url).href;
  }
  throw new Error('Trop de redirections');
}

export async function readRemoteText(response: Response, maximumBytes: number): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return '';
  const decoder = new TextDecoder();
  let text = '', size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maximumBytes) throw new Error('Réponse distante trop volumineuse');
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } finally { await reader.cancel(); reader.releaseLock(); }
}

export async function readRemoteBytes(response: Response, maximumBytes: number): Promise<Uint8Array> {
  const reader = response.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maximumBytes) throw new Error('Réponse distante trop volumineuse');
      chunks.push(value);
    }
  } finally { await reader.cancel(); reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}
