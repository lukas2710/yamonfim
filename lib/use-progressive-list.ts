'use client';
import { useEffect, useRef, useState } from 'react';

/** Keep large catalogues searchable in full while rendering only nearby rows. */
export function useProgressiveList(total: number, query: string, batch = 80) {
  const [limit, setLimit] = useState(batch);
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Reset the render window for a new search, not the catalogue data.
    setLimit(batch);
  }, [query, batch]);
  useEffect(() => {
    if (limit >= total || !sentinel.current) return;
    if (!('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) setLimit(value => Math.min(total, value + batch)); }, { rootMargin: '300px' });
    observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [limit, total, batch]);
  return { limit: typeof window !== 'undefined' && !('IntersectionObserver' in window) ? total : limit, sentinel };
}
