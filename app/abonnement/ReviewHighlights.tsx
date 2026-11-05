'use client';

import { useVipReviews } from '@/lib/use-vip-reviews';
import styles from './highlights.module.css';


const AVATAR_COLORS = ['#f59e0b', '#ef4444', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899', '#14b8a6'];
const Stars = ({ value }: { value: number }) => <span className={styles.stars} aria-label={`${value} sur 5`}>{Array.from({ length: 5 }, (_, i) => <span key={i} className={i < value ? styles.on : styles.off} aria-hidden="true">★</span>)}</span>;

/** Avis des membres avec commentaire, juste avant les offres : la preuve sociale au moment de choisir. */
export default function ReviewHighlights({ userId }: { userId?: string }) {
  const { reviews, average, total } = useVipReviews(userId);

  if (!total || !reviews.length) return null;
  // Liste doublée : le défilement boucle sans saut.
  const loop = reviews.length >= 3 ? [...reviews, ...reviews] : reviews;
  return (
    <section className={styles.section} aria-labelledby="highlights-title">
      <div className={styles.head}>
        <div className={styles.score}>
          <strong>{average.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</strong>
          <div><Stars value={Math.round(average)} /><span>{total} avis de membres</span></div>
        </div>
        <h2 id="highlights-title">Ce qu’en pensent les membres</h2>
        <a href="#avis" className={styles.all}>Lire tous les avis ↓</a>
      </div>
      <div className={`${styles.viewport} ${reviews.length >= 3 ? styles.moving : ''}`}>
        <div className={styles.track} style={{ ['--duration' as string]: `${reviews.length * 7}s` }}>
          {loop.map((review, i) => (
            <article key={`${review.id}-${i}`} className={styles.card} aria-hidden={i >= reviews.length ? true : undefined}>
              <Stars value={review.rating} />
              <p>« {review.comment.length > 220 ? review.comment.slice(0, 217).trimEnd() + '…' : review.comment} »</p>
              <footer>
                <span className={styles.avatar} style={{ background: AVATAR_COLORS[review.display_name.charCodeAt(0) % AVATAR_COLORS.length] }} aria-hidden="true">{review.display_name.slice(0, 1).toUpperCase()}</span>
                <span><strong>{review.display_name}</strong><small>Membre Yamonfilm</small></span>
              </footer>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
