-- Avoid repeatedly sorting the complete media catalogue for recent-first pages.
CREATE INDEX IF NOT EXISTS media_created_at_id_idx
  ON public.media (created_at DESC, id DESC);
