'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import styles from './ReviewPrompt.module.css';
const INTERVAL = 300_000;
const KEY = 'yf-feedback-due';
export default function ReviewPrompt(_props: { eligible?: boolean } = {}) {
  void _props;
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [rating, setRating] = useState('5');
  const [discovery, setDiscovery] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
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
        if (!cancelled) setVisible(profile?.profile_mode === 'standard');
      } catch { /* Optional questionnaire; retry on next tick. */ }
      finally { checking = false; }
    };
    // Start the deadline on any page, including the player; display only at home.
    try { if (!Number(localStorage.getItem(KEY))) localStorage.setItem(KEY, String(Date.now() + INTERVAL)); } catch {}
    void check();
    const timer = setInterval(check, 1000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [pathname, visible]);
  useEffect(() => {
    if (!visible || pathname !== '/') return;
    const previous = document.activeElement as HTMLElement | null;
    form.current?.querySelector<HTMLElement>('button,select')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) { try { localStorage.setItem(KEY, String(Date.now() + INTERVAL)); } catch {} setVisible(false); }
      if (e.key !== 'Tab') return;
      const nodes = form.current?.querySelectorAll<HTMLElement>('button:not(:disabled),select,textarea');
      if (!nodes?.length) return;
      const first = nodes[0], last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); previous?.focus(); };
  }, [visible, pathname, busy]);
  function close() { try { localStorage.setItem(KEY, String(Date.now() + INTERVAL)); } catch {} setVisible(false); setError(''); }
  async function submit(e: FormEvent) {
    e.preventDefault(); if (busy) return; setBusy(true); setError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error();
      const { error } = await supabase.from('site_feedback').insert({ user_id: user.id, rating: Number(rating), discovery, message: message.trim() });
      if (error) throw error;
      close(); setMessage(''); setDiscovery('');
    } catch { setError('Ton avis n’a pas été enregistré. Réessaie.'); }
    finally { setBusy(false); }
  }
  if (!visible || pathname !== '/') return null;
  return <div className="yf-backdrop fixed inset-0 z-[250] grid place-items-center bg-black/75 p-4"><form ref={form} onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="feedback-title" className="yf-pop relative max-h-[90dvh] w-full max-w-md space-y-4 overflow-y-auto rounded-3xl border border-white/15 bg-zinc-950 p-6">
    <button type="button" disabled={busy} onClick={close} className={styles.close} aria-label="Fermer">×</button>
    <h2 id="feedback-title" className="text-2xl font-bold">Ton avis compte</h2><p className="text-sm text-zinc-400">Comment se passe ton expérience sur YAMONFILM ?</p>
    <label className="block">Ta note<select value={rating} onChange={e => setRating(e.target.value)} className="mt-2 block w-full rounded-xl bg-zinc-800 p-3">{[5,4,3,2,1].map(n => <option key={n} value={n}>{n} / 5</option>)}</select></label>
    <label className="block">Comment as-tu entendu parler du site ?<select required value={discovery} onChange={e => setDiscovery(e.target.value)} className="mt-2 block w-full rounded-xl bg-zinc-800 p-3"><option value="">Choisir une réponse</option>{Object.entries({tiktok:'TikTok',instagram:'Instagram',youtube:'YouTube',ami:'Un proche',recherche:'Moteur de recherche',autre:'Autre'}).map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select></label>
    <label className="block">Un commentaire (facultatif)<textarea maxLength={2000} value={message} onChange={e => setMessage(e.target.value)} className="mt-2 block w-full rounded-xl bg-zinc-800 p-3" /></label>
    {error && <p role="alert" className="text-red-300">{error}</p>}<p className="text-xs text-zinc-500">Tes réponses sont visibles uniquement par l’administrateur.</p>
    <div className="flex gap-3"><button disabled={busy} className="rounded-full bg-red-600 px-5 py-3">{busy ? 'Envoi…' : 'Envoyer mon avis'}</button><button type="button" disabled={busy} onClick={close}>Plus tard</button></div>
  </form></div>;
}
