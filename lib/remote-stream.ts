export function rewritePlaylist(text: string, base: string): string {
  const proxied = (value: string) => {
    const url = new URL(value, base);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Protocole de flux invalide');
    return `/api/proxy?url=${encodeURIComponent(url.href)}`;
  };
  return text.split(/\r?\n/).map(line => {
    if (!line.trim()) return line;
    if (line.startsWith('#')) return line.replace(/URI="([^"]+)"/g, (_, uri: string) => `URI="${proxied(uri)}"`);
    return proxied(line.trim());
  }).join('\n');
}

export function hlsAudioTracks(text: string) {
  return text.split(/\r?\n/).filter(line => line.startsWith('#EXT-X-MEDIA:') && /(?:^|,)TYPE=AUDIO(?:,|$)/.test(line.slice(13))).map((line, id) => ({
    id, name: line.match(/(?:[:,])NAME="([^"]*)"/)?.[1] || '',
    lang: line.match(/(?:[:,])LANGUAGE="([^"]*)"/)?.[1] || '',
  }));
}

// Native HLS implementations without audioTracks can select a language through
// a master containing only that audio rendition. Signed URLs stay untouched.
export function selectHlsAudio(text: string, language: string): string {
  if (!language) return text;
  const normalize = (value: string) => ({ fra: 'fr', fre: 'fr', eng: 'en' } as Record<string, string>)[value.toLowerCase()] || value.toLowerCase().split('-')[0];
  const lines = text.split(/\r?\n/);
  const group = (line: string) => line.match(/GROUP-ID="([^"]+)"/)?.[1] || '';
  const matches = (line: string) => normalize(line.match(/LANGUAGE="([^"]+)"/)?.[1] || '') === normalize(language);
  const audio = (line: string) => line.startsWith('#EXT-X-MEDIA:TYPE=AUDIO,');
  const groups = new Set(lines.filter(line => audio(line) && matches(line)).map(group));
  return lines.filter(line => !audio(line) || !groups.has(group(line)) || matches(line)).map(line => {
    if (!audio(line) || !groups.has(group(line))) return line;
    return /(?:[:,])DEFAULT=/.test(line) ? line.replace(/DEFAULT=(?:YES|NO)/, 'DEFAULT=YES') : line + ',DEFAULT=YES';
  }).join('\n');
}
