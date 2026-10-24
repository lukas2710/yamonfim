'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import styles from './ReviewPrompt.module.css';

const SNOOZE_KEY = 'yf-review-prompt-until';
const SNOOZE_DAYS = 14;
const DELAY_MS = 20_000;

function snoozed() {
  try { return Number(localStorage.getItem(SNOOZE_KEY) ?? 0) > Date.now(); } catch { return false; }
}
function snooze() {
  try { localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_DAYS * 86400_000)); } catch { /* Private mode: the prompt may return next visit. */ }
}

// Invites members who already used the site to rate it, once per 14 days, until they post a review.
export default function ReviewPrompt({ eligible }: { eligible: boolean }) {
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [hover, setHover] = useState(0);
  useEffect(() => {
    if (!eligible || snoozed()) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session || cancelled) return;
        const { data, error } = await supabase.from('site_reviews').select('id').eq('user_id', session.user.id).maybeSingle();
        if (!cancelled && !error && !data) setVisible(true);
      } catch { /* Reviews are optional: never interrupt browsing. */ }
    }, DELAY_MS);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [eligible]);
  if (!visible) return null;
  const close = () => { snooze(); setVisible(false); };
  const rate = (note: number) => { snooze(); router.push(`/abonnement?note=${note}#donner-mon-avis`); };
  return <aside className={styles.card} role="dialog" aria-labelledby="review-prompt-title">
    <button className={styles.close} onClick={close} aria-label="Fermer">×</button>
    <p className={styles.kicker}>30 SECONDES CHRONO</p>
    <h2 id="review-prompt-title" className={styles.title}>Tu aimes YAMONFIM ?</h2>
    <p className={styles.text}>Ton avis aide les autres à nous découvrir. Note ton expérience :</p>
    <div className={styles.stars} onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map(n => <button key={n} className={n <= hover ? styles.on : ''} onMouseEnter={() => setHover(n)} onFocus={() => setHover(n)} onClick={() => rate(n)} aria-label={`${n} sur 5`}>★</button>)}
    </div>
    <button className={styles.later} onClick={close}>Plus tard</button>
  </aside>;
}
