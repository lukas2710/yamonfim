'use client';

import { useState } from 'react';
import { getPersistentSession } from '@/lib/auth-session';

// Downloads the members + Stripe buyers CSV built by /api/admin/export.
export default function ContactExport() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const run = async () => {
    setBusy(true); setMessage('');
    try {
      const { data: { session } } = await getPersistentSession();
      const response = await fetch('/api/admin/export', { headers: { Authorization: `Bearer ${session?.access_token ?? ''}` } });
      if (!response.ok) throw new Error(await response.text());
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = response.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1] ?? 'yamonfim-contacts.csv';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      const note = response.headers.get('X-Export-Note');
      setMessage(note ? decodeURIComponent(note) : 'Fichier téléchargé.');
    } catch (error) {
      setMessage(error instanceof Error && error.message ? `Export impossible : ${error.message}` : 'Export impossible. Réessaie.');
    } finally { setBusy(false); }
  };
  return <section className="rounded-2xl border border-white/10 bg-[#121214] p-5 text-white">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="min-w-0"><h2 className="text-base font-bold">Liste des contacts (CSV)</h2><p className="mt-1 max-w-2xl text-xs leading-5 text-zinc-400">Tous les membres et les clients Stripe, avec la colonne « Contactable pour une offre » : n’écris qu’à ceux marqués Oui, et mets leur lien de désinscription dans chaque email.</p></div>
      <button type="button" onClick={() => void run()} disabled={busy} className="rounded-xl bg-red-600 px-5 py-3 text-sm font-bold hover:bg-red-500 disabled:opacity-50">{busy ? 'Préparation…' : 'Télécharger la liste'}</button>
    </div>
    {message && <p role="status" className="mt-3 text-xs text-zinc-300">{message}</p>}
  </section>;
}
