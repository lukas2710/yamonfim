export type CollectedFeedback = { id: string; user_id: string; rating: number; message: string; created_at: string };
export type PublishedFeedback = { user_id: string; display_name: string; rating: number; comment: string };
export type VipReview = { id: string; display_name: string; rating: number; comment: string; created_at: string };
export type VipReviews = { reviews: VipReview[]; total: number; average: number };
const clean = (value: string) => value.replace(/\s+/g, ' ').trim();
/** Collected comments with a matching, current publication choice. */
export function collectVipReviews(feedback: CollectedFeedback[], publications: PublishedFeedback[]): VipReviews {
  const consent = new Map(publications.map(row => [row.user_id, row]));
  const selected = new Map<string, VipReview>();
  for (const row of [...feedback].sort((a, b) => b.created_at.localeCompare(a.created_at))) {
    if (selected.has(row.user_id)) continue;
    const publication = consent.get(row.user_id), comment = clean(row.message || '');
    if (!comment || !publication || clean(publication.comment || '') !== comment || publication.rating !== row.rating || !Number.isInteger(row.rating) || row.rating < 1 || row.rating > 5) continue;
    selected.set(row.user_id, { id: row.id, display_name: clean(publication.display_name || '') || 'Membre Yamonfim', rating: row.rating, comment, created_at: row.created_at });
  }
  const reviews = [...selected.values()];
  return { reviews, total: reviews.length, average: reviews.length ? reviews.reduce((sum, row) => sum + row.rating, 0) / reviews.length : 0 };
}
