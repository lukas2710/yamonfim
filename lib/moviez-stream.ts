import { fetchPublicRemote, readRemoteText } from './public-remote';
import { moviezPlayerUrl, moviezToken, playlistDuration, assertStreamDuration } from './moviez-player';
import { hlsAudioTracks } from './remote-stream';
import { hlsQuality, compareQuality } from './stream-quality';

export async function resolveMoviezStream(source: string, signal: AbortSignal) {
  const player = moviezPlayerUrl(source);
  const { response } = await fetchPublicRemote(player, signal);
  if (!response.ok) { await response.body?.cancel(); throw new Error('Lecteur indisponible'); }
  const html = await readRemoteText(response, 2_000_000);
  const token = moviezToken(html);
  const configMatch = html.match(/window\.P2\s*=\s*(\{[^;]+\})\s*;/);
  const sourceLanguage = configMatch ? JSON.parse(configMatch[1]).lang : '';
  const result = await fetch('https://api.moviez.ac/api/v2/stream', {
    method: 'POST', redirect: 'error', cache: 'no-store', signal,
    headers: { 'Content-Type': 'application/json', Referer: player }, body: JSON.stringify({ t: token }),
  });
  if (!result.ok) { await result.body?.cancel(); throw new Error('Flux indisponible'); }
  const data = JSON.parse(await readRemoteText(result, 1_000_000));
  if (typeof data.hls !== 'string') throw new Error('Flux manquant');
  // Validate the media playlist, not just a master that could point at an advert.
  let target = data.hls;
  let audioTracks: ReturnType<typeof hlsAudioTracks> = [];
  let quality = hlsQuality('');
  for (let depth = 0; depth < 4; depth++) {
    const { response: manifest, url } = await fetchPublicRemote(target, signal, { 'User-Agent': 'Mozilla/5.0' });
    if (!manifest.ok) { await manifest.body?.cancel(); throw new Error('Playlist indisponible'); }
    const text = await readRemoteText(manifest, 5_000_000);
    if (!text.trimStart().startsWith('#EXTM3U')) throw new Error('Playlist invalide');
    if (!audioTracks.length) audioTracks = hlsAudioTracks(text);
    const candidateQuality = hlsQuality(text);
    if (compareQuality(candidateQuality, quality) > 0) quality = candidateQuality;
    const duration = playlistDuration(text);
    if (duration > 0) {
      assertStreamDuration(duration, Number(data.duration));
      // Muxed single-language streams have no EXT-X-MEDIA audio renditions.
      // Label VF only when the provider explicitly identifies this version as VF.
      if (!audioTracks.length && sourceLanguage === 'vf') audioTracks = [{ id: 0, name: 'Français (VF)', lang: 'fr' }];
      return { url: data.hls as string, audioTracks, quality };
    }
    const variant = text.split(/\r?\n/).map(line => line.trim()).find(line => line && !line.startsWith('#'));
    if (!variant) throw new Error('Playlist vide');
    target = new URL(variant, url).href;
  }
  throw new Error('Playlist non prise en charge');
}
