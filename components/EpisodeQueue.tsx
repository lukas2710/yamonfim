'use client';
import { useState } from 'react';

interface Season { seasonNumber: number; episodes: { number: number; title: string; runtime?: number; still_path?: string }[] }
interface Props {
  seasons: Season[]; active: { s: number; e: number }; watched: Record<string, boolean>;
  poster: string; disabled: boolean; onSelect: (season: number, episode: number) => void;
  seasonLabel?: string;
}
export default function EpisodeQueue({ seasons, active, watched, poster, disabled, onSelect, seasonLabel = 'Saison' }: Props) {
  const [browseSeason, setBrowseSeason] = useState(active.s);
  const season = seasons[browseSeason] || seasons[active.s];
  if (!season) return null;
  return <aside className="watch-queue" aria-label="Liste des épisodes">
    <div className="watch-queue-heading"><span className="watch-kicker">CONTINUE TON HISTOIRE</span><h3>Les épisodes <span>{season.episodes.length}</span></h3>
      {seasons.length > 1 && <div className="watch-queue-seasons" role="group" aria-label={`${seasonLabel} des épisodes du lecteur`}>{seasons.map((item, index) => <button type="button" key={index} aria-pressed={browseSeason === index} onClick={() => setBrowseSeason(index)} className="watch-queue-season-chip">{seasonLabel} {item.seasonNumber}</button>)}</div>}
    </div>
    <ol className="watch-queue-list">{season.episodes.map((episode, index) => {
      const selected = browseSeason === active.s && index === active.e;
      const seen = !!watched[`s${browseSeason}_e${index}`];
      const image = episode.still_path || poster;
      return <li key={index}><button type="button" disabled={disabled || selected} aria-current={selected ? 'true' : undefined} onClick={() => onSelect(browseSeason, index)} className="watch-queue-episode">
        <div className="watch-queue-image">{image ? <img src={image} alt="" loading="lazy" /> : <span aria-hidden="true">▶</span>}<span className="watch-queue-number">{episode.number || index + 1}</span></div>
        <div className="watch-queue-copy"><span className="watch-queue-label">{selected ? 'EN COURS' : `ÉPISODE ${episode.number || index + 1}`}</span><strong>{episode.title || `Épisode ${index + 1}`}</strong><span className="watch-queue-meta">{episode.runtime ? `${episode.runtime} min` : 'Série'}{seen && <span>✓ Déjà vu</span>}</span></div>
        <span className="watch-queue-play" aria-hidden="true">{selected ? '▥' : '▶'}</span>
      </button></li>;
    })}</ol>
    <p className="watch-queue-note">Choisis la suite quand tu le souhaites. Ton épisode est enregistré dans ton historique.</p>
  </aside>;
}
