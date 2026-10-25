import * as cheerio from 'cheerio';

export function sourceUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return '';
  const raw = value.includes('<') ? cheerio.load(value)('iframe').first().attr('src') : value.trim();
  try {
    const url = new URL(raw);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : '';
  } catch { return ''; }
}

export function catalogueEntries(media) {
  const entries = [];
  for (const item of media) {
    const base = { media_id: String(item.id), poster: item.poster || '', media_type: item.type };
    if (item.type === 'movie') {
      entries.push({ ...base, entry_key: `${item.id}:movie`, title: item.title,
        season_number: null, episode_number: null, source_url: sourceUrl(item.embedUrl) || sourceUrl(item.url) });
    } else if (item.type === 'series') {
      for (const [si, season] of (Array.isArray(item.seasons) ? item.seasons : []).entries()) {
        for (const [ei, ep] of (Array.isArray(season.episodes) ? season.episodes : []).entries()) {
          const s = Number(season.seasonNumber ?? si + 1), e = Number(ep.number ?? ei + 1);
          if (!Number.isSafeInteger(s) || s < 0 || !Number.isSafeInteger(e) || e < 0) throw new Error(`Numéro de saison/épisode invalide : ${item.id}`);
          entries.push({ ...base, entry_key: `${item.id}:s${s}:e${e}`, season_number: s, episode_number: e,
            title: `${item.title} - S${String(s).padStart(2, '0')}E${String(e).padStart(2, '0')}${ep.title ? ` - ${ep.title}` : ''}`,
            source_url: sourceUrl(ep.embedUrl) });
        }
      }
    }
  }
  if (new Set(entries.map(e => e.entry_key)).size !== entries.length) throw new Error('Épisodes en double : synchronisation arrêtée');
  return entries;
}

// Only parse data: never execute a provider's JavaScript.
export function moviezConfig(html) {
  const match = html.match(/window\.P2\s*=\s*(\{[^;]+\})\s*;/);
  if (!match) throw new Error('Format du lecteur Moviez non reconnu');
  const config = JSON.parse(match[1]);
  if (typeof config.t !== 'string' || !config.t) throw new Error('Jeton du lecteur absent');
  return config;
}

export function m3u(entries, now = Date.now()) {
  const clean = value => String(value || '').replace(/[\r\n\x00-\x1f"]/g, ' ').trim();
  const lines = ['#EXTM3U'];
  for (const row of entries) {
    const url = sourceUrl(row.stream_url);
    if (row.status !== 'ready' || !url || (row.expires_at && !(Date.parse(row.expires_at) > now + 60000))) continue;
    lines.push(`#EXTINF:-1 tvg-id="${clean(row.entry_key)}" tvg-logo="${clean(row.poster)}" group-title="${row.media_type === 'series' ? 'Séries' : 'Films'}",${clean(row.title)}`, url);
  }
  return lines.join('\n') + '\n';
}
