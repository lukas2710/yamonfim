'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import styles from './ReviewPrompt.module.css';
const INTERVAL = 300_000;
// Avis envoyé : on ne redemande pas avant trois mois.
const AFTER_REVIEW = 90 * 24 * 3600_000;
const KEY = 'yf-feedback-due';
const MOODS = ['', 'Aïe… dis-nous ce qui ne va pas 😕', 'Peut mieux faire 😐', 'Pas mal 🙂', 'Très bien ! 😃', 'Génial ! 🤩'];
const DISCOVERY = { tiktok: 'TikTok', instagram: 'Instagram', youtube: 'YouTube', ami: 'Un proche', recherche: 'Google', autre: 'Autre' };
const CONFETTI = ['#fbbf24', '#fde68a', '#f87171', '#60a5fa', '#34d399', '#fff', '#fbbf24', '#a78bfa', '#f472b6', '#fde68a', '#60a5fa', '#34d399'];

export default function ReviewPrompt(_props: { eligible?: boolean } = {}) {
  void _props;
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [discovery, setDiscovery] = useState('');
  const [message, setMessage] = useState('');
  const [publish, setPublish] = useState(true);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [thanks, setThanks] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    let cancelled = false, checking = false, nextCheck = 0;
    const check = async () => {
      if (pathname !== '/') { setVisible(false); return; }
      if (document.hidden || visible || checking) return;
      checking = true;
      try {
        const due = Number(localStorage.getItem(KEY));
        if (!due) { localStorage.setItem(KEY, String(Date.now() + INTERVAL)); return; }
        if (Date.now() < due || Date.now() < nextCheck) return;
        nextCheck = Date.now() + 60000;
        const { data: { user } } = await supabase.auth.getUser();
        const active = JSON.parse(localStorage.getItem('active_profile') || '{}');
        if (!user || !active.id) return;
        const { data: profile } = await supabase.from('user_profiles').select('profile_mode').eq('id', active.id).eq('user_id', user.id).single();
        if (!cancelled && profile?.profile_mode === 'standard') { setName(n => n || String(active.name || '').slice(0, 50)); setVisible(true); }
      } catch { /* Optional questionnaire; retry on next tick. */ }
      finally { checking = false; }
    };
    // Start the deadline on any page, including the player; display only at home.
    try { if (!Number(localStorage.getItem(KEY))) localStorage.setItem(KEY, String(Date.now() + INTERVAL)); } catch {}
    void check();
    const timer = pathname === '/' ? setInterval(check, 1000) : undefined;
    return () => { cancelled = true; clearInterval(timer); };
  }, [pathname, visible]);
  useEffect(() => {
    if (!visible || pathname !== '/') return;
    const previous = document.activeElement as HTMLElement | null;
    form.current?.querySelector<HTMLElement>('button[data-star]')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) close();
      if (e.key !== 'Tab') return;
      const nodes = form.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input,textarea');
      if (!nodes?.length) return;
      const first = nodes[0], last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); previous?.focus(); };
  }, [visible, pathname, busy]);
  function close(after = INTERVAL) {
    try { localStorage.setItem(KEY, String(Date.now() + after)); } catch {}
    setVisible(false); setError(''); setThanks(false); setRating(0); setDiscovery(''); setMessage('');
  }
  const comment = message.trim();
  // Les avis publiés sur la page VIP suivent les règles de la table site_reviews.
  const publishing = publish && comment.length >= 10;
  const nameOk = name.trim().length >= 2;
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy || !rating || !discovery) return;
    if (publishing && !nameOk) { setError('Indique ton prénom ou un pseudo pour publier ton avis.'); return; }
    setBusy(true); setError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error();
      const { error } = await supabase.from('site_feedback').insert({ user_id: user.id, rating, discovery, message: comment });
      if (error) throw error;
      if (publishing) {
        const { error: reviewError } = await supabase.from('site_reviews').upsert({ user_id: user.id, display_name: name.trim().slice(0, 50), rating, comment: comment.slice(0, 1000) }, { onConflict: 'user_id' });
        if (reviewError) throw reviewError;
      }
      setThanks(true);
      window.setTimeout(() => close(AFTER_REVIEW), 2600);
    } catch { setError('Ton avis n’a pas été enregistré. Réessaie.'); }
    finally { setBusy(false); }
  }
  if (!visible || pathname !== '/') return null;
  const shown = hover || rating;
  return <div className={styles.backdrop}>
    <form ref={form} onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="feedback-title" className={styles.card}>
      <button type="button" disabled={busy} onClick={() => close()} className={styles.close} aria-label="Fermer">×</button>
      {thanks ? <div className={styles.thanks} role="status">
        {CONFETTI.map((color, i) => <span key={i} className={styles.confetti} style={{ background: color, ['--x' as string]: `${Math.round(Math.cos(i / CONFETTI.length * 6.283) * 150)}px`, ['--y' as string]: `${Math.round(Math.sin(i / CONFETTI.length * 6.283) * 110 - 40)}px`, ['--r' as string]: `${i * 67}deg` }} />)}
        <div className={styles.thanksIcon} aria-hidden="true">💛</div>
        <h2 id="feedback-title" className={styles.title}>Merci, c’est enregistré !</h2>
        <p className={styles.text}>{publishing ? 'Ton avis apparaît maintenant sur la page VIP. Il aidera les prochains membres à se décider.' : 'Ton retour nous aide à améliorer YAMONFILM.'}</p>
      </div> : <>
        <div className={styles.badge} aria-hidden="true">⭐</div>
        <p className={styles.kicker}>TON AVIS COMPTE</p>
        <h2 id="feedback-title" className={styles.title}>Tu aimes YAMONFILM ?</h2>
        <p className={styles.text}>Ça prend 20 secondes et ça nous aide énormément.</p>
        <div className={styles.stars} role="radiogroup" aria-label="Ta note" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map(n => <button key={n} type="button" data-star role="radio" aria-checked={rating === n} aria-label={`${n} sur 5`} onMouseEnter={() => setHover(n)} onClick={() => setRating(n)} className={`${styles.star} ${n <= shown ? styles.on : ''} ${n === rating ? styles.picked : ''}`}>★</button>)}
        </div>
        <p className={styles.mood} aria-live="polite">{MOODS[shown] || 'Touche une étoile'}</p>
        {rating > 0 && <>
          <div className={styles.section}>
            <span className={styles.label}>Comment nous as-tu connus ?</span>
            <div className={styles.chips}>{Object.entries(DISCOVERY).map(([key, text]) => <button key={key} type="button" aria-pressed={discovery === key} onClick={() => setDiscovery(key)} className={`${styles.chip} ${discovery === key ? styles.chipOn : ''}`}>{text}</button>)}</div>
          </div>
          <div className={styles.section} style={{ animationDelay: '.08s' }}>
            <label className={styles.label} htmlFor="feedback-message">{rating >= 4 ? 'Qu’est-ce que tu préfères ?' : 'Qu’est-ce qu’on peut améliorer ?'} <span style={{ color: '#64748b', fontWeight: 500 }}>(facultatif)</span></label>
            <textarea id="feedback-message" rows={3} maxLength={1000} value={message} onChange={e => setMessage(e.target.value)} className={styles.field} placeholder={rating >= 4 ? 'Le catalogue, la qualité, l’appli TV…' : 'Dis-nous tout, on lit chaque message.'} />
            {comment.length > 0 && comment.length < 10 && <p className={styles.count}>Encore {10 - comment.length} caractère{10 - comment.length > 1 ? 's' : ''} pour pouvoir le publier</p>}
            {comment.length >= 10 && <>
              <label className={styles.publish}><input type="checkbox" checked={publish} onChange={e => setPublish(e.target.checked)} /><span><b>Publier mon avis sur la page VIP</b><br />Avec ton prénom ou pseudo, pour aider les autres à se décider.</span></label>
              {publish && <input aria-label="Ton prénom ou pseudo" required minLength={2} maxLength={50} value={name} onChange={e => setName(e.target.value)} className={styles.field} style={{ marginTop: 8 }} placeholder="Ton prénom ou pseudo" autoComplete="nickname" />}
            </>}
          </div>
        </>}
        {error && <p role="alert" className={styles.error}>{error}</p>}
        <button className={styles.send} disabled={busy || !rating || !discovery}>{busy ? 'Envoi…' : !rating ? 'Choisis une note' : !discovery ? 'Dis-nous comment tu nous as connus' : 'Envoyer mon avis'}</button>
        <button type="button" disabled={busy} onClick={() => close()} className={styles.later}>Plus tard</button>
        <p className={styles.privacy}>{publishing ? 'Ton pseudo, ta note et ton commentaire seront visibles par les membres.' : 'Tes réponses sont visibles uniquement par l’équipe YAMONFILM.'}</p>
      </>}
    </form>
  </div>;
}
