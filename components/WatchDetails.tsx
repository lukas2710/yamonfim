interface Props {
  title: string; description: string; poster: string; backdrop?: string; series: boolean; runtime?: number;
  seasonCount: number; seen: number; total: number; watched: boolean; playLabel: string; episodeLabel: string;
  disabled: boolean; showRestart: boolean; onPlay: () => void; onRestart: () => void; onToggleWatched: () => void;
}
export default function WatchDetails(props: Props) {
  const { title, description, poster, backdrop, series, runtime, seasonCount, seen, total, watched, playLabel, episodeLabel, disabled, showRestart, onPlay, onRestart, onToggleWatched } = props;
  return <section className="watch-detail-hero" aria-label="Présentation du contenu">
    {backdrop && <img className="watch-detail-backdrop" src={backdrop} alt="" />}
    <div className="watch-detail-grid">
      <div className="watch-detail-poster">{poster ? <img src={poster} alt={`Affiche de ${title}`} /> : <div className="watch-poster-placeholder"><span>YAMONFIM</span><strong>{title}</strong></div>}<span className="watch-detail-format">{series ? 'LA SÉRIE' : 'LE FILM'}</span></div>
      <div className="watch-detail-copy">
        <span className="watch-kicker">{series ? 'UNE HISTOIRE À SUIVRE' : 'UNE SÉANCE À VIVRE'}</span>
        <div className="watch-detail-tags"><span>{series ? 'Série' : 'Film'}</span>{series && <span>{seasonCount} saison{seasonCount > 1 ? 's' : ''}</span>}{!series && !!runtime && <span>{runtime} min</span>}{watched && <span className="watch-tag-seen">✓ {series ? 'Série vue' : 'Déjà vu'}</span>}</div>
        <h1>{title}</h1>
        {description && <div className="watch-detail-synopsis"><p>{description.length > 320 ? description.slice(0, 320) + '…' : description}</p>{description.length > 320 && <details><summary>Lire le synopsis complet</summary><p>{description}</p></details>}</div>}
        <div className="watch-detail-actions"><button className="watch-main-button yf-play" onClick={onPlay} disabled={disabled}><span aria-hidden="true">▶</span>{disabled ? 'Préparation…' : playLabel}</button>{showRestart && <button className="watch-secondary-button" onClick={onRestart}>↺ Depuis le début</button>}{!series && <button className="watch-secondary-button" onClick={onToggleWatched}>{watched ? '✓ Déjà vu' : 'Marquer comme vu'}</button>}</div>
        <div className="watch-detail-continuity"><div><span className="watch-continuity-icon" aria-hidden="true">{series ? '▤' : '▶'}</span></div><div><span className="watch-kicker">TON ESPACE DE LECTURE</span><strong>{series ? episodeLabel : 'Ta séance, à ton rythme.'}</strong><p>{series ? 'Choisis un épisode. Retrouve la suite dans ton historique.' : 'Ton historique reste associé à ton profil.'}</p></div></div>
        {series && <div className="watch-detail-progress"><div><span>Ta progression</span><strong>{seen} / {total} épisodes vus</strong></div><div className="watch-detail-progress-track"><span style={{ width: `${total ? seen / total * 100 : 0}%` }} /></div></div>}
      </div>
    </div>
    <div className="watch-detail-bottom"><span>YAMON<span>FILM</span></span><p>Le cinéma, à ta façon.</p><a href="#watch-episodes">{series ? 'Explorer les épisodes ↓' : 'Les commentaires ↓'}</a></div>
  </section>;
}
