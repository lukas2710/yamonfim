'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import styles from './subscription.module.css';

interface Review { id: string; user_id: string; display_name: string; rating: number; comment: string; created_at: string }

export default function MemberReviews({ userId, admin }: { userId?: string; admin: boolean }) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [name, setName] = useState('');
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [ownReview, setOwnReview] = useState(false);
  const loadReviews = useCallback(async (signal?: AbortSignal) => {
    let query = supabase.from('site_reviews').select('*', { count: 'exact' }).order('created_at', { ascending: false }).limit(12);
    if (signal) query = query.abortSignal(signal);
    const result = await query;
    if (signal?.aborted) return;
    setUnavailable(!!result.error);
    if (!result.error) { setReviews(result.data ?? []); setTotal(result.count ?? 0); }
    setLoading(false);
  }, []);
  useEffect(() => {
    if (!userId) return;
    const controller = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Load persisted member reviews from Supabase on mount.
    void loadReviews(controller.signal);
    void (async () => {
      const { data } = await supabase.from('site_reviews').select('*').eq('user_id', userId).abortSignal(controller.signal).maybeSingle();
      if (!controller.signal.aborted && data) { setOwnReview(true); setName(data.display_name); setRating(data.rating); setComment(data.comment); }
    })();
    return () => controller.abort();
  }, [userId, loadReviews]);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!userId || submitting || unavailable) return;
    setSubmitting(true); setError(''); setMessage('');
    try {
      const { error } = await supabase.from('site_reviews').upsert({ user_id: userId, display_name: name.trim(), rating, comment: comment.trim() }, { onConflict: 'user_id' });
      if (error) throw error;
      setOwnReview(true); setMessage('Merci ! Ton avis est enregistré et visible par les membres.');
      await loadReviews();
    } catch (err) { setError(err instanceof Error ? err.message : 'Ton avis n’a pas pu être enregistré. Réessaie.'); }
    finally { setSubmitting(false); }
  };
  const average = reviews.length ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : null;
  return <section className={styles.reviews} id="avis">
    <div className={styles.sectionHeading}><p className={styles.eyebrow}>LA PAROLE AUX MEMBRES</p><h2>Ils partagent leur expérience.</h2><p>Des avis publiés par les comptes du site. Ton retour compte aussi.</p></div>
    {loading && userId ? <p className={styles.reviewEmpty}>Chargement des avis…</p> : unavailable ? <div className={styles.reviewEmpty}><p>Les avis sont momentanément indisponibles.</p>{admin && <p>Active la table des avis avec le script « 20261020_subscription_experience.sql » dans Supabase.</p>}</div> : !reviews.length ? <p className={styles.reviewEmpty}>Les premiers avis se font attendre. Partage ton expérience pour aider les prochains membres à choisir.</p> : <>
      <div className={styles.reviewSummary}><strong>{average?.toLocaleString('fr-FR', { maximumFractionDigits: 1 })}<span> / 5</span></strong><span className={styles.stars} aria-hidden="true">{Array.from({ length: 5 }, (_, i) => <span key={i} className={i < Math.round(average ?? 0) ? styles.filledStar : styles.emptyStar}>★</span>)}</span><p>Moyenne des {reviews.length} avis affichés · {total} avis au total</p></div>
      <div className={styles.reviewGrid}>{reviews.map(review => <article key={review.id} className={styles.reviewCard}><div className={styles.reviewStars} aria-label={`${review.rating} sur 5`}>{Array.from({ length: 5 }, (_, i) => <span key={i} className={i < review.rating ? styles.filledStar : styles.emptyStar} aria-hidden="true">★</span>)}</div><p>« {review.comment} »</p><footer><div className={styles.reviewAvatar} aria-hidden="true">{review.display_name.slice(0, 1).toUpperCase()}</div><div><strong>{review.display_name}</strong><span>Membre Yamonfim</span></div><time dateTime={review.created_at}>{new Date(review.created_at).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'short', year: 'numeric' })}</time></footer></article>)}</div>
    </>}
    {userId && !unavailable && <form className={styles.reviewForm} onSubmit={event => void submit(event)}><div><h3>{ownReview ? 'Ton avis, tes mots.' : 'Et toi, qu’en penses-tu ?'}</h3><p>Un avis par compte, modifiable à tout moment. Ton pseudo et ton commentaire seront visibles par les membres.</p></div><div className={styles.reviewFields}><label htmlFor="review-name">Ton pseudo<input id="review-name" required minLength={2} maxLength={50} value={name} onChange={e => setName(e.target.value)} placeholder="Ton prénom ou pseudo" autoComplete="nickname" /></label><label htmlFor="review-rating">Ta note<select id="review-rating" value={rating} onChange={e => setRating(Number(e.target.value))}>{[5, 4, 3, 2, 1].map(value => <option key={value} value={value}>{value} / 5</option>)}</select></label></div><label htmlFor="review-comment">Ton expérience<textarea id="review-comment" required minLength={10} maxLength={1000} rows={3} value={comment} onChange={e => setComment(e.target.value)} placeholder="Ce que tu apprécies, ce qui pourrait être amélioré…" /></label><div className={styles.reviewFormFooter}><span>{comment.length} / 1 000 caractères</span><button className={styles.primary} disabled={submitting} type="submit">{submitting ? 'Enregistrement…' : ownReview ? 'Mettre à jour mon avis' : 'Publier mon avis'}</button></div>{message && <p className={styles.reviewSuccess} role="status">{message}</p>}{error && <p className={styles.reviewError} role="alert">{error}</p>}</form>}
  </section>;
}
