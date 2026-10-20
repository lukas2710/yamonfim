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
