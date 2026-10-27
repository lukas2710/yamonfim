'use client';

import { clearClientResources } from '@/lib/resource-cache';

import SectionNavigation from '@/components/SectionNavigation';
import PageHero from '@/components/PageHero';
import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { PromoCard, PROMO_THEMES, type Promotion } from '@/components/PromoBanner';

const ADMIN_EMAIL = 'lukas.leclerc312@gmail.com';

type Draft = Omit<Promotion, 'id' | 'created_at'>;

const EMPTY: Draft = {
  title: '',
  subtitle: '',
  badge: '',
  image_url: '',
  button_label: 'En profiter',
  link_url: '/abonnement',
  theme: 'red',
  audience: 'all',
  starts_at: null,
  ends_at: null,
  active: true,
  priority: 0,
};

const AUDIENCES: { key: Draft['audience']; label: string; hint: string }[] = [
  { key: 'all', label: 'Tout le monde', hint: 'Gratuits et VIP' },
  { key: 'free', label: 'Non-VIP', hint: 'Idéal pour vendre le VIP' },
  { key: 'vip', label: 'VIP', hint: 'Avantages membres' },
];

const LINK_PRESETS = [
  { label: 'Abonnement', value: '/abonnement' },
  { label: 'Demandes', value: '/requests' },
  { label: 'Accueil', value: '/' },
];

// ISO <-> champ "datetime-local"
const toLocalInput = (iso?: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null);

const statusOf = (p: Promotion) => {
  const now = Date.now();
  if (!p.active) return { label: 'Désactivée', className: 'bg-white/5 text-zinc-400 ring-white/10' };
  if (p.starts_at && new Date(p.starts_at).getTime() > now) return { label: 'Programmée', className: 'bg-sky-500/10 text-sky-300 ring-sky-500/30' };
  if (p.ends_at && new Date(p.ends_at).getTime() <= now) return { label: 'Terminée', className: 'bg-white/5 text-zinc-500 ring-white/10' };
  return { label: 'En ligne', className: 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/30' };
};

const inputClass =
  'w-full rounded-xl border border-white/10 bg-black/30 px-3.5 py-2.5 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-red-600/70 focus:ring-4 focus:ring-red-600/15';

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline justify-between gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
        {label}
        {hint && <span className="font-normal normal-case tracking-normal text-zinc-600">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

export default function AdminPromotionsPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [promos, setPromos] = useState<Promotion[]>([]);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || session.user.email !== ADMIN_EMAIL) {
        router.push('/');
        return;
      }
      setChecking(false);
      fetchPromos();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(''), 4000);
    return () => clearTimeout(t);
  }, [message]);

  const fetchPromos = async () => {
    clearClientResources();
    const { data, error } = await supabase
      .from('promotions')
      .select('*')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) {
      setErrorMsg(
        error.message.includes('does not exist') || error.code === '42P01'
          ? 'La table "promotions" n\'existe pas encore : lance le script supabase-promotions.sql dans Supabase.'
          : `Erreur : ${error.message}`
      );
      return;
    }
    setPromos((data as Promotion[]) || []);
  };

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft(d => ({ ...d, [key]: value }));

  const resetForm = () => {
    setDraft(EMPTY);
    setEditingId(null);
  };

  const edit = (p: Promotion) => {
    const { id, created_at, ...rest } = p;
    setDraft({ ...EMPTY, ...rest });
    setEditingId(id);
    setErrorMsg('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (!draft.title.trim()) {
      setErrorMsg('Ajoute au moins un titre.');
      return;
    }
    if (draft.starts_at && draft.ends_at && new Date(draft.ends_at) <= new Date(draft.starts_at)) {
      setErrorMsg('La date de fin doit être après la date de début.');
      return;
    }

    setSaving(true);
    setErrorMsg('');
    const payload = {
      ...draft,
      title: draft.title.trim(),
      subtitle: draft.subtitle?.trim() || null,
      badge: draft.badge?.trim() || null,
      image_url: draft.image_url?.trim() || null,
      button_label: draft.button_label?.trim() || null,
      link_url: draft.link_url?.trim() || null,
      priority: Number(draft.priority) || 0,
    };

    const { error } = editingId
      ? await supabase.from('promotions').update(payload).eq('id', editingId)
      : await supabase.from('promotions').insert([payload]);

    setSaving(false);
    if (error) {
      setErrorMsg(`Erreur : ${error.message}`);
      return;
    }
    setMessage(editingId ? 'Promotion mise à jour.' : 'Promotion publiée.');
    resetForm();
    fetchPromos();
  };

  const toggleActive = async (p: Promotion) => {
    setPromos(list => list.map(x => (x.id === p.id ? { ...x, active: !x.active } : x)));
    clearClientResources();
    const { error } = await supabase.from('promotions').update({ active: !p.active }).eq('id', p.id);
    if (error) {
      setErrorMsg(`Erreur : ${error.message}`);
      fetchPromos();
    }
  };

  const remove = async (id: string) => {
    setConfirmDeleteId(null);
    clearClientResources();
    const { error } = await supabase.from('promotions').delete().eq('id', id);
    if (error) setErrorMsg(`Erreur : ${error.message}`);
    else {
      setMessage('Promotion supprimée.');
      if (editingId === id) resetForm();
      fetchPromos();
    }
  };

  const duplicate = (p: Promotion) => {
    const { id, created_at, ...rest } = p;
    setDraft({ ...EMPTY, ...rest, title: `${p.title} (copie)`, active: false });
    setEditingId(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const onlineCount = useMemo(() => promos.filter(p => statusOf(p).label === 'En ligne').length, [promos]);

  if (checking) {
    return (
      <main className="yf-page yf-promotions flex min-h-screen items-center justify-center bg-[#0a0a0b] text-white">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-red-600" />
      </main>
    );
  }

  const previewPromo: Promotion = { ...draft, id: 'preview', title: draft.title || 'Titre de la promotion' };

  return (
    <main className="yf-page yf-promotions min-h-screen bg-[#0a0a0b] pb-24 font-sans text-white antialiased selection:bg-red-600 selection:text-white">
      {/* Header */}
      <header className="yf-topbar sticky top-0 z-40 border-b border-white/5 bg-[#0a0a0b]/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-8">
          <div className="flex items-center gap-3">
            <span className="select-none text-lg font-black tracking-[0.2em] text-red-600">YAMON<span className="text-white">FILM</span></span>
            <span className="rounded-full bg-red-600/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-red-300 ring-1 ring-red-500/30">Promotions</span>
          </div>
          <div className="flex items-center gap-2">
            <a href="/admin" className="rounded-full bg-white/5 px-4 py-2 text-sm font-medium text-zinc-200 ring-1 ring-white/10 transition hover:bg-white/10">Admin</a>
            <a href="/" className="hidden rounded-full bg-white/5 px-4 py-2 text-sm font-medium text-zinc-200 ring-1 ring-white/10 transition hover:bg-white/10 sm:inline-flex">Voir le site</a>
          </div>
        </div>
      </header>
      <SectionNavigation admin />

      {/* Notifications */}
      <div className="pointer-events-none fixed inset-x-0 top-20 z-50 flex flex-col items-center gap-2 px-4">
        {message && (
          <div className="pointer-events-auto rounded-2xl bg-[#111113]/95 px-4 py-3 text-sm text-emerald-100 shadow-2xl ring-1 ring-emerald-500/30 backdrop-blur-xl">✓ {message}</div>
        )}
        {errorMsg && (
          <div className="pointer-events-auto flex max-w-md items-start gap-3 rounded-2xl bg-[#111113]/95 px-4 py-3 text-sm text-red-200 shadow-2xl ring-1 ring-red-500/40 backdrop-blur-xl">
            <span className="flex-1">{errorMsg}</span>
            <button onClick={() => setErrorMsg('')} className="text-zinc-500 hover:text-white">✕</button>
          </div>
        )}
      </div>

      <div className="mx-auto max-w-7xl px-4 pt-8 sm:px-8">
        <PageHero eyebrow="SOUS LES PROJECTEURS" title="Les bonnes offres" accent="méritent la lumière." description="Compose les promotions de l’accueil, choisis leur audience et garde le contrôle de leur calendrier de diffusion." cardLabel="LES PROMOTIONS" cardTitle="Une offre qui se remarque." cardDetail={`${onlineCount} EN LIGNE · ${promos.length} AU TOTAL`} variant="signal" />

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
          {/* ================= Formulaire ================= */}
          <form onSubmit={save} className="yf-surface space-y-6 rounded-3xl bg-white/[0.03] p-5 ring-1 ring-white/10 sm:p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">{editingId ? 'Modifier la promotion' : 'Nouvelle promotion'}</h2>
              {editingId && (
                <button type="button" onClick={resetForm} className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/15">Annuler</button>
              )}
            </div>

            <div className="space-y-4">
              <Field label="Titre">
                <input value={draft.title} onChange={e => set('title', e.target.value)} placeholder="Ex : -30 % sur l'abonnement 1 an" className={inputClass} maxLength={80} />
              </Field>
              <Field label="Texte" hint="optionnel">
                <textarea rows={2} value={draft.subtitle || ''} onChange={e => set('subtitle', e.target.value)} placeholder="Ex : Profite du VIP toute l'année pour seulement 50 €." className={`${inputClass} resize-none`} maxLength={180} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Badge" hint="optionnel">
                  <input value={draft.badge || ''} onChange={e => set('badge', e.target.value)} placeholder="Offre limitée" className={inputClass} maxLength={24} />
                </Field>
                <Field label="Texte du bouton">
                  <input value={draft.button_label || ''} onChange={e => set('button_label', e.target.value)} placeholder="En profiter" className={inputClass} maxLength={30} />
                </Field>
              </div>

              <Field label="Lien du bouton" hint="page du site ou lien externe">
                <input value={draft.link_url || ''} onChange={e => set('link_url', e.target.value)} placeholder="/abonnement" className={inputClass} />
              </Field>
              <div className="-mt-2 flex flex-wrap gap-2">
                {LINK_PRESETS.map(l => (
                  <button key={l.value} type="button" onClick={() => set('link_url', l.value)}
                    className={`rounded-full px-3 py-1 text-xs font-medium ring-1 transition ${draft.link_url === l.value ? 'bg-white text-black ring-white' : 'bg-white/5 text-zinc-400 ring-white/10 hover:text-white'}`}>
                    {l.label}
                  </button>
                ))}
              </div>

              <Field label="Image de fond" hint="lien d'une image paysage (optionnel)">
                <input value={draft.image_url || ''} onChange={e => set('image_url', e.target.value)} placeholder="https://…" className={inputClass} />
              </Field>
            </div>

            {/* Couleur */}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">Couleur</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(PROMO_THEMES).map(([key, t]) => (
                  <button key={key} type="button" onClick={() => set('theme', key)}
                    className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition ${draft.theme === key ? 'bg-white/10 ring-white/40' : 'bg-white/[0.03] ring-white/10 hover:bg-white/[0.06]'}`}>
                    <span className={`h-3 w-3 rounded-full ${t.dot}`} /> {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Public */}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">Qui la voit ?</p>
              <div className="grid grid-cols-3 gap-2">
                {AUDIENCES.map(a => (
                  <button key={a.key} type="button" onClick={() => set('audience', a.key)}
                    className={`rounded-2xl px-3 py-2.5 text-left ring-1 transition ${draft.audience === a.key ? 'bg-white text-black ring-white' : 'bg-white/[0.03] ring-white/10 hover:bg-white/[0.06]'}`}>
                    <span className="block text-sm font-semibold">{a.label}</span>
                    <span className={`block text-[11px] ${draft.audience === a.key ? 'text-zinc-600' : 'text-zinc-500'}`}>{a.hint}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Dates */}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Début" hint="vide = maintenant">
                <input type="datetime-local" value={toLocalInput(draft.starts_at)} onChange={e => set('starts_at', fromLocalInput(e.target.value))} className={`${inputClass} [color-scheme:dark]`} />
              </Field>
              <Field label="Fin" hint="vide = sans fin">
                <input type="datetime-local" value={toLocalInput(draft.ends_at)} onChange={e => set('ends_at', fromLocalInput(e.target.value))} className={`${inputClass} [color-scheme:dark]`} />
              </Field>
            </div>
            {draft.ends_at && <p className="-mt-3 text-xs text-zinc-500">Un compte à rebours s'affichera sur la bannière.</p>}

            <div className="flex flex-wrap items-center justify-between gap-4">
              <label className="inline-flex cursor-pointer items-center gap-3">
                <span className={`relative h-6 w-11 rounded-full transition ${draft.active ? 'bg-emerald-500' : 'bg-zinc-700'}`}>
                  <span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-all ${draft.active ? 'left-6' : 'left-1'}`} />
                </span>
                <input type="checkbox" className="sr-only" checked={draft.active} onChange={e => set('active', e.target.checked)} />
                <span className="text-sm font-medium">{draft.active ? 'Active' : 'Désactivée'}</span>
              </label>
              <label className="flex items-center gap-2 text-sm text-zinc-400">
                Priorité
                <input type="number" value={draft.priority} onChange={e => set('priority', Number(e.target.value))} className="w-20 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-red-600/70" />
              </label>
            </div>

            <button type="submit" disabled={saving}
              className="yf-primary flex w-full items-center justify-center gap-2 rounded-full bg-red-600 py-3.5 text-sm font-bold shadow-lg shadow-red-600/25 transition hover:bg-red-500 disabled:opacity-60">
              {saving ? 'Enregistrement…' : editingId ? 'Mettre à jour' : 'Publier la promotion'}
            </button>
          </form>

          {/* ================= Aperçu + liste ================= */}
          <div className="space-y-8 lg:sticky lg:top-24">
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">Aperçu sur l'accueil</p>
              <PromoCard promo={previewPromo} onClick={() => {}} />
            </div>

            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">Toutes les promotions</p>
              {promos.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-white/10 py-10 text-center text-sm text-zinc-500">Aucune promotion pour le moment.</p>
              ) : (
                <ul className="space-y-2">
                  {promos.map(p => {
                    const st = statusOf(p);
                    const theme = PROMO_THEMES[p.theme] || PROMO_THEMES.red;
                    return (
                      <li key={p.id} className={`flex items-center gap-3 rounded-2xl p-3 ring-1 transition ${editingId === p.id ? 'bg-red-600/10 ring-red-500/40' : 'bg-white/[0.03] ring-white/10'}`}>
                        <span className={`h-10 w-1.5 shrink-0 rounded-full ${theme.dot}`} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{p.title}</p>
                          <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
                            <span className={`rounded-full px-2 py-0.5 font-semibold ring-1 ${st.className}`}>{st.label}</span>
                            <span>{AUDIENCES.find(a => a.key === p.audience)?.label}</span>
                            {p.ends_at && <span>jusqu'au {new Date(p.ends_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>}
                          </p>
                        </div>

                        {confirmDeleteId === p.id ? (
                          <div className="flex shrink-0 items-center gap-1">
                            <button onClick={() => remove(p.id)} className="yf-primary rounded-full bg-red-600 px-3 py-1.5 text-xs font-bold hover:bg-red-500">Supprimer</button>
                            <button onClick={() => setConfirmDeleteId(null)} className="px-2 text-xs text-zinc-400 hover:text-white">Non</button>
                          </div>
                        ) : (
                          <div className="flex shrink-0 items-center gap-1">
                            <button onClick={() => toggleActive(p)} title={p.active ? 'Désactiver' : 'Activer'}
                              className={`relative h-5 w-9 rounded-full transition ${p.active ? 'bg-emerald-500' : 'bg-zinc-700'}`}>
                              <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${p.active ? 'left-[18px]' : 'left-0.5'}`} />
                            </button>
                            <button onClick={() => edit(p)} className="rounded-full px-2.5 py-1.5 text-xs font-medium text-zinc-300 hover:bg-white/10 hover:text-white">Modifier</button>
                            <button onClick={() => duplicate(p)} className="hidden rounded-full px-2.5 py-1.5 text-xs font-medium text-zinc-300 hover:bg-white/10 hover:text-white sm:inline">Dupliquer</button>
                            <button onClick={() => setConfirmDeleteId(p.id)} aria-label="Supprimer" className="rounded-full px-2 py-1.5 text-xs text-zinc-500 hover:bg-red-600/15 hover:text-red-400">✕</button>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
