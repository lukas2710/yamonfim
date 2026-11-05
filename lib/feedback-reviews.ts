export type CollectedFeedback = { id: string; user_id: string; rating: number; message: string; created_at: string };
export type PublishedFeedback = { id: string; user_id: string; display_name: string; rating: number; comment: string; created_at: string };
export type VipReview = { id: string; display_name: string; rating: number; comment: string; created_at: string };
export type VipReviews = { reviews: VipReview[]; total: number; average: number; distribution: number[] };
const ANONYMOUS = 'Membre anonyme';
// The form offers « Publier mon avis » from this length on.
const PUBLISHABLE_LENGTH = 10;
const clean = (value: string) => value.replace(/\s+/g, ' ').trim();
const validRating = (value: number) => Number.isInteger(value) && value >= 1 && value <= 5;
/**
 * One review per member, newest first, low ratings included. A published review
 * keeps its name. Otherwise the review appears without a name, and a comment long
 * enough to have been offered publication stays private: only its stars appear.
 * The owner's own voice is neither a member's review nor a member's rating.
 */
export function collectVipReviews(feedback: CollectedFeedback[], publications: PublishedFeedback[], ownerId?: string): VipReviews {
  const latest = new Map<string, CollectedFeedback>();
  for (const row of [...feedback].sort((a, b) => b.created_at.localeCompare(a.created_at))) if (!latest.has(row.user_id) && validRating(row.rating)) latest.set(row.user_id, row);
  const members = new Map<string, VipReview>();
  for (const [user, row] of latest) {
    const comment = clean(row.message || '');
    members.set(user, { id: row.id, display_name: ANONYMOUS, rating: row.rating, comment: comment.length < PUBLISHABLE_LENGTH ? comment : '', created_at: row.created_at });
  }
  for (const row of publications) {
    const comment = clean(row.comment || '');
    if (comment && validRating(row.rating)) members.set(row.user_id, { id: row.id, display_name: clean(row.display_name || '') || ANONYMOUS, rating: row.rating, comment, created_at: row.created_at });
  }
  if (ownerId) members.delete(ownerId);
  const distribution = [0, 0, 0, 0, 0];
  let sum = 0;
  for (const [user, review] of members) {
    const rating = latest.get(user)?.rating ?? review.rating;
    distribution[rating - 1]++; sum += rating;
  }
  const reviews = [...members.values()].sort((a, b) => b.created_at.localeCompare(a.created_at));
  return { reviews, total: reviews.length, average: reviews.length ? sum / reviews.length : 0, distribution };
}
