'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { getPersistentSession } from '@/lib/auth-session';
import { CATALOGUE_ADMIN, importCatalogueItem, parseImportRequest } from '@/lib/catalogue-import';

export default function CatalogueImportPage() {
  const [allowed, setAllowed] = useState(false);
  const [status, setStatus] = useState('Autorise ton catalogue local pour ajouter ses films et séries avec ta connexion administrateur.');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);
  const allowedRef = useRef(false);
  const busy = useRef(false);
  const results = useRef(new Map<string, object>());
  const channel = useRef('');
  const embedded = useRef(false);
  const peer = () => embedded.current ? window.parent : window.opener;
  function reply(message: object) {
    // Local file pages have an opaque origin. Only status/IDs are returned;
    // credentials and session tokens always remain on the site origin.
    peer()?.postMessage({ ...message, channel: channel.current }, embedded.current ? window.location.origin : '*');
  }
  useEffect(() => {
    channel.current = new URLSearchParams(window.location.hash.slice(1)).get('channel') || '';
    try { embedded.current = window.parent !== window && window.parent.location.origin === window.location.origin; } catch { embedded.current = false; }
    const resume = async () => {
      if (!embedded.current) return;
      try {
        const { data: { session } } = await getPersistentSession();
        allowedRef.current = session?.user.email === CATALOGUE_ADMIN;
        setAllowed(allowedRef.current);
        reply({ action: allowedRef.current ? 'catalogue:ready' : 'catalogue:auth-required' });
      } catch { reply({ action: 'catalogue:auth-required' }); }
    };
    void resume();
    const receive = async (event: MessageEvent) => {
      if (!peer() || event.source !== peer() || event.origin !== (embedded.current ? window.location.origin : 'null') || !channel.current || event.data?.channel !== channel.current) return;
      if (event.data?.action === 'catalogue:hello') {
        if (allowedRef.current) reply({ action: 'catalogue:ready' });
        else void resume();
        return;
      }
      if (!allowedRef.current || event.data?.action !== 'catalogue:add') return;
      const item = parseImportRequest(event.data);
      if (!item) return;
      const cached = results.current.get(item.job);
      if (cached) { reply(cached); return; }
      if (busy.current) { reply({ action: 'catalogue:result', ...item, ok: false, error: 'Un ajout est déjà en cours. Attends sa fin puis réessaie.' }); return; }
      busy.current = true;
      setError('');
      const report = (message: string) => { setStatus(message); reply({ action: 'catalogue:progress', ...item, message }); };
      try {
        const outcome = await importCatalogueItem(item, report);
        const result = { action: 'catalogue:result', ...item, ok: true, already: outcome.already };
        results.current.set(item.job, result);
        if (results.current.size > 100) results.current.delete(results.current.keys().next().value!);
        reply(result);
        setStatus(outcome.already ? 'Ce titre est déjà présent sur ton site. Aucun doublon ajouté.' : 'Ajout terminé ! Tu peux choisir un autre titre dans ton catalogue.');
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : 'Ajout impossible. Réessaie.';
        setError(message);
        reply({ action: 'catalogue:result', ...item, ok: false, error: message });
      } finally { busy.current = false; }
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, []);
  async function authorize() {
    setChecking(true); setError('');
    try {
      if (!window.opener || !/^[a-zA-Z0-9-]{8,100}$/.test(channel.current)) throw new Error('Ouvre cette fenêtre depuis le bouton « Ajouter au site » de ton catalogue local.');
      const { data: { session } } = await getPersistentSession();
      if (session?.user.email !== CATALOGUE_ADMIN) throw new Error('Connecte-toi au site avec ton compte administrateur, puis clique à nouveau sur Autoriser.');
      allowedRef.current = true; setAllowed(true);
      setStatus('Catalogue autorisé. Garde cette fenêtre ouverte pendant les ajouts.');
      reply({ action: 'catalogue:ready' });
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Connexion indisponible.'); }
    finally { setChecking(false); }
  }
  return <main className="min-h-screen bg-[#0b0c10] p-8 text-white"><div className="mx-auto max-w-xl space-y-6"><p className="text-sm font-bold tracking-widest text-red-400">YAMONFIM · AJOUT DIRECT</p><h1 className="text-3xl font-bold">Du catalogue à ton site.</h1><p role="status" className="leading-7 text-zinc-300">{status}</p>{error && <p role="alert" className="rounded-xl bg-red-500/15 p-4 text-red-200">{error}</p>}{!allowed && <button disabled={checking} onClick={() => void authorize()} className="rounded-xl bg-red-600 px-5 py-3 font-semibold disabled:opacity-50">{checking ? 'Vérification…' : 'Autoriser ce catalogue local'}</button>}<p className="text-sm leading-6 text-zinc-500">Les liens sont vérifiés avant enregistrement. Pour les séries, la recherche de tous les épisodes peut prendre plusieurs minutes. Ne ferme pas cette fenêtre pendant l’ajout.</p><Link href="/login" target="_blank" className="inline-block text-sm underline">Ouvrir la connexion administrateur ↗</Link></div></main>;
}
