export function moviezPlayerUrl(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Lecteur invalide');
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.hostname !== 'api.moviez.ac' || url.port || url.username || url.password ||
      !/^\/(?:\d+|serie\/\d+\/\d+\/\d+)\/?$/.test(url.pathname)) throw new Error('Lecteur non pris en charge');
  // Only keep the language setting; player UI parameters are irrelevant here.
  const lang = url.searchParams.get('lang');
  url.search = ''; url.hash = '';
  if (lang && ['vf', 'vo', 'vostfr'].includes(lang)) url.searchParams.set('lang', lang);
  return url.href;
}

export function moviezToken(html: string): string {
  const match = html.match(/window\.P2\s*=\s*(\{[^;]+\})\s*;/);
  if (!match) throw new Error('Le format du lecteur a changé');
  const config = JSON.parse(match[1]);
  if (typeof config.t !== 'string' || !config.t) throw new Error('Jeton du lecteur manquant');
  return config.t;
}

export function playlistDuration(text: string): number {
  return [...text.matchAll(/^#EXTINF:([\d.]+)/gm)].reduce((sum, match) => sum + Number(match[1]), 0);
}

export function assertStreamDuration(actual: number, expected: number) {
  if (!Number.isFinite(expected) || expected <= 0 || !Number.isFinite(actual) || actual < expected * 0.85 || actual > expected * 1.15) {
    throw new Error('Le flux reçu ne correspond pas à la durée du contenu');
  }
}
