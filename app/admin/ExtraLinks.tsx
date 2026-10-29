'use client';
import { useState } from 'react';
import { extraLinks, withExtraLink, withoutExtraLink, isSupportedEmbed, MAX_EXTRA_LINKS, type CatalogueSource } from '@/lib/catalogue-source';

// Hand-added EmbedOrigin links, stored as `extra` parameters of the player URL.
// The player tries them right after Moviez and always lists them as sources.
export default function ExtraLinks({ value, fallback, verify, onChange, disabled, compact }: {
  value: string;
  fallback?: CatalogueSource;
  verify: (link: string) => Promise<boolean>;
  onChange: (stored: string) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  const [draft, setDraft] = useState('');
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');
  const links = extraLinks(value);

  const add = async () => {
    const link = draft.trim().match(/<iframe[^>]*\ssrc=["']([^"']+)["']/i)?.[1] ?? draft.trim();
    setError('');
    if (!isSupportedEmbed(link)) { setError('Lien attendu : https://embedorigin.cc/e/xxxxxxxxxxxx'); return; }
    if (links.includes(link)) { setError('Ce lien est déjà ajouté.'); return; }
    if (links.length >= MAX_EXTRA_LINKS) { setError(`${MAX_EXTRA_LINKS} liens supplémentaires maximum.`); return; }
    const next = withExtraLink(value, link, fallback);
    if (!next) { setError('Ajoute d’abord le lien principal (ou choisis le titre TMDB).'); return; }
    setChecking(true);
    try {
      if (!await verify(link)) { setError('Aucun flux vidéo trouvé dans ce lien.'); return; }
      onChange(next); setDraft('');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Vérification impossible.'); }
    finally { setChecking(false); }
  };

  return (
    <div className={compact ? 'space-y-1.5' : 'mt-3 space-y-2 rounded-xl border border-white/10 bg-black/20 p-3'}>
      {!compact && <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Sources supplémentaires <span className="font-normal normal-case tracking-normal text-zinc-600">· proposées dans le lecteur</span></p>}
      {links.map((link, index) => (
        <div key={link} className="flex items-center gap-2 rounded-lg bg-white/[0.04] px-2.5 py-1.5">
          <span className="shrink-0 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300">Source +{index + 1}</span>
          <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-zinc-300" title={link}>{link}</span>
          <button type="button" disabled={disabled} onClick={() => onChange(withoutExtraLink(value, link))} className="shrink-0 text-xs font-semibold text-red-300 hover:text-red-200 disabled:opacity-40" aria-label={`Retirer ${link}`}>Retirer</button>
        </div>
      ))}
      <div className="flex gap-2">
        <input
          type="text"
          value={draft}
          onChange={event => { setDraft(event.target.value); setError(''); }}
          onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); void add(); } }}
          placeholder="+ Autre lien (https://embedorigin.cc/e/…)"
          aria-label="Ajouter une source supplémentaire"
          className="w-full flex-1 rounded-lg border border-white/10 bg-black/30 px-2.5 py-1.5 font-mono text-[11px] text-white outline-none focus:border-red-600/70"
        />
        <button type="button" disabled={disabled || checking || !draft.trim()} onClick={() => void add()} className="shrink-0 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/15 disabled:opacity-40">
          {checking ? 'Vérification…' : 'Ajouter'}
        </button>
      </div>
      {error && <p className="text-[11px] text-red-300">{error}</p>}
    </div>
  );
}
