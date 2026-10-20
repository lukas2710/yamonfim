'use client';

import SectionNavigation from '@/components/SectionNavigation';
import PageHero from '@/components/PageHero';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

interface ReportItem {
  id: string;
  user_email: string;
  category: 'bug_episode' | 'probleme_lecture' | 'amelioration' | 'autre';
  media_title?: string;
  season_number?: number;
  episode_number?: number;
  description: string;
  status: 'en_attente' | 'en_cours' | 'resolu';
  created_at: string;
}

const ADMIN_EMAIL = 'lukas.leclerc312@gmail.com';

const CATEGORIES = {
  bug_episode: { label: 'Bug sur un épisode / série', badge: 'bg-red-500/10 text-red-300 ring-red-500/30' },
  probleme_lecture: { label: 'Problème de lecture / Lecteur', badge: 'bg-amber-500/10 text-amber-300 ring-amber-500/30' },
  amelioration: { label: 'Proposition d’amélioration', badge: 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/30' },
  autre: { label: 'Autre remarque', badge: 'bg-white/5 text-zinc-300 ring-white/10' },
};

const STATUS = {
  en_attente: { label: 'En attente', className: 'bg-white/5 text-zinc-300 ring-white/10', dot: 'bg-zinc-400' },
  en_cours: { label: 'En cours', className: 'bg-amber-500/10 text-amber-300 ring-amber-500/30', dot: 'bg-amber-400' },
  resolu: { label: 'Résolu', className: 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/30', dot: 'bg-emerald-400' },
};

const maskEmail = (email?: string) => {
  if (!email || !email.includes('@')) return email || 'Visiteur';
  const [name, domain] = email.split('@');
  return `${name.slice(0, 2)}***@${domain}`;
};

const timeAgo = (iso: string) => {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (!Number.isFinite(diff)) return '';
  if (diff < 60) return "à l'instant";
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`;
  return `il y a ${Math.floor(diff / 86400)} j`;
};

export default function ReportPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [reports, setReports] = useState<ReportItem[]>([]);

  const [category, setCategory] = useState<ReportItem['category']>('bug_episode');
  const [mediaTitle, setMediaTitle] = useState('');
  const [seasonNumber, setSeasonNumber] = useState('');
  const [episodeNumber, setEpisodeNumber] = useState('');
  const [description, setDescription] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const fetchReports = async () => {
    const { data, error } = await supabase
      .from('reports')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) setReports(data);
  };

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) setCurrentUser(session.user);
      await fetchReports();
      setLoading(false);
    }
    init();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || submitting) return;

    setSubmitting(true);
    setMsg('');
    setErrorMsg('');

    const { error } = await supabase.from('reports').insert([
      {
        user_id: currentUser?.id || null,
        user_email: currentUser?.email || 'Visiteur',
        category,
        media_title: mediaTitle.trim() || null,
        season_number: seasonNumber ? parseInt(seasonNumber) : null,
        episode_number: episodeNumber ? parseInt(episodeNumber) : null,
        description: description.trim(),
        status: 'en_attente',
      },
    ]);

    if (error) {
      setErrorMsg(`Erreur : ${error.message}`);
    } else {
      setMsg('Ton signalement / suggestion a bien été envoyé. Merci !');
      setMediaTitle('');
      setSeasonNumber('');
      setEpisodeNumber('');
      setDescription('');
      fetchReports();
    }
    setSubmitting(false);
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    const { error } = await supabase.from('reports').update({ status: newStatus }).eq('id', id);
    if (!error) fetchReports();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('reports').delete().eq('id', id);
    setConfirmDeleteId(null);
    if (!error) fetchReports();
  };

  const isAdmin = currentUser?.email === ADMIN_EMAIL;
  const isMine = (r: ReportItem) => !!currentUser?.email && r.user_email === currentUser.email;

  if (loading) {
    return (
      <main className="yf-page yf-report min-h-screen bg-[#0a0a0b] text-white">
        <div className="h-16 border-b border-white/5" />
        <div className="mx-auto max-w-5xl space-y-6 px-4 pt-10 sm:px-10">
          <div className="h-10 w-72 animate-pulse rounded-xl bg-zinc-800" />
          <div className="h-64 animate-pulse rounded-3xl bg-zinc-900" />
        </div>
      </main>
    );
  }

  return (
    <main className="yf-page yf-report relative min-h-screen overflow-x-hidden bg-[#0a0a0b] pb-24 font-sans text-white antialiased">
      <header className="yf-topbar sticky top-0 z-40 border-b border-white/5 bg-[#0a0a0b]/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-10">
          <button
            onClick={() => router.push('/')}
            className="cursor-pointer rounded-full border border-white/10 bg-white/5 py-2 pl-3 pr-4 text-sm font-medium text-zinc-200 transition hover:bg-white/10 hover:text-white"
          >
            Accueil
          </button>
          <span className="text-lg font-black tracking-[0.2em] text-red-600">
            YAMON<span className="text-white">FIM</span>
          </span>
          {isAdmin ? (
            <span className="hidden items-center gap-1.5 rounded-full bg-red-600/15 px-3 py-1.5 text-xs font-bold text-red-300 ring-1 ring-red-500/30 sm:flex">
              Mode admin
            </span>
          ) : (
            <span className="hidden w-[100px] sm:block" />
          )}
        </div>
      </header>
      <SectionNavigation />

      <div className="relative mx-auto max-w-5xl space-y-12 px-4 pt-10 sm:px-10">
        <PageHero eyebrow="ON EST LÀ POUR TA SÉANCE" title="Un souci à l’écran ?" accent="On regarde ça ensemble." description="Un épisode qui bloque, un problème de lecture ou une bonne idée : envoie-nous les détails pour nous aider à améliorer ta prochaine séance." cardLabel="L’ASSISTANCE" cardTitle="Ta séance mérite de continuer." cardDetail="ÉCOUTER · COMPRENDRE · AMÉLIORER" variant="signal"><a href="#nouveau-signalement">Contacter l’assistance <span aria-hidden="true">↗</span></a></PageHero>

        {/* Formulaire */}
        <section id="nouveau-signalement" className="yf-surface rounded-3xl bg-white/[0.03] p-5 ring-1 ring-white/10 sm:p-8">
          {msg && (
            <div className="mb-6 rounded-2xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200 ring-1 ring-emerald-500/35">
              {msg}
            </div>
          )}
          {errorMsg && (
            <div className="mb-6 rounded-2xl bg-red-600/10 px-4 py-3 text-sm text-red-300 ring-1 ring-red-500/35">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">1. Type de signalement</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {(Object.keys(CATEGORIES) as (keyof typeof CATEGORIES)[]).map(key => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setCategory(key)}
                    className={`cursor-pointer rounded-2xl px-4 py-3 text-left text-sm font-semibold transition ${
                      category === key
                        ? 'bg-white text-black shadow'
                        : 'bg-white/5 text-zinc-400 ring-1 ring-white/10 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {CATEGORIES[key].label}
                  </button>
                ))}
              </div>
            </div>

            {(category === 'bug_episode' || category === 'probleme_lecture') && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="sm:col-span-1">
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-400">Titre du média</label>
                  <input
                    type="text"
                    placeholder="Ex: Breaking Bad"
                    value={mediaTitle}
                    onChange={e => setMediaTitle(e.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:border-red-600"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-400">Saison (optionnel)</label>
                  <input
                    type="number"
                    placeholder="Ex: 1"
                    value={seasonNumber}
                    onChange={e => setSeasonNumber(e.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:border-red-600"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-400">Épisode (optionnel)</label>
                  <input
                    type="number"
                    placeholder="Ex: 3"
                    value={episodeNumber}
                    onChange={e => setEpisodeNumber(e.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:border-red-600"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                2. Description détaillée <span className="text-red-500">*</span>
              </label>
              <textarea
                required
                rows={4}
                placeholder="Explique le problème rencontré ou ta suggestion d'amélioration..."
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-white outline-none focus:border-red-600"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="yf-primary flex w-full cursor-pointer items-center justify-center rounded-full bg-red-600 py-4 text-sm font-bold text-white shadow-lg shadow-red-600/25 transition hover:bg-red-500 disabled:opacity-50"
            >
              {submitting ? 'Envoi en cours...' : 'Envoyer le signalement'}
            </button>
          </form>
        </section>

        {/* Liste des signalements */}
        <section>
          <h2 className="mb-5 text-xl font-bold tracking-tight sm:text-2xl">Historique des signalements</h2>
          {reports.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-white/10 py-16 text-center text-sm text-zinc-500">
              Aucun signalement pour le moment.
            </div>
          ) : (
            <div className="space-y-3">
              {reports.map(report => {
                const mine = isMine(report);
                const st = STATUS[report.status] || STATUS.en_attente;
                const cat = CATEGORIES[report.category] || CATEGORIES.autre;

                return (
                  <div key={report.id} className="yf-surface flex flex-col gap-4 rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/10 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ring-1 ${cat.badge}`}>
                          {cat.label}
                        </span>
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold ring-1 ${st.className}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
                          {st.label}
                        </span>
                        {report.media_title && (
                          <span className="text-xs font-bold text-white">
                            🎬 {report.media_title} {report.season_number ? `(S${report.season_number}` : ''}{report.episode_number ? `E${report.episode_number})` : report.season_number ? ')' : ''}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-zinc-200">{report.description}</p>
                      <p className="text-xs text-zinc-500">
                        Par {isAdmin || mine ? report.user_email : maskEmail(report.user_email)} · {timeAgo(report.created_at)}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      {isAdmin && (
                        <div className="flex rounded-full bg-black/30 p-1 ring-1 ring-white/10">
                          {(Object.keys(STATUS) as (keyof typeof STATUS)[]).map(s => (
                            <button
                              key={s}
                              onClick={() => handleStatusChange(report.id, s)}
                              className={`cursor-pointer rounded-full px-2.5 py-1 text-[10px] font-semibold transition ${
                                report.status === s ? `ring-1 ${STATUS[s].className}` : 'text-zinc-500 hover:text-white'
                              }`}
                            >
                              {STATUS[s].label}
                            </button>
                          ))}
                        </div>
                      )}

                      {(isAdmin || mine) && (
                        confirmDeleteId === report.id ? (
                          <div className="flex items-center gap-1">
                            <button onClick={() => handleDelete(report.id)} className="yf-primary rounded-full bg-red-600 px-3 py-1 text-xs font-bold text-white">Confirmer</button>
                            <button onClick={() => setConfirmDeleteId(null)} className="rounded-full bg-white/10 px-3 py-1 text-xs text-zinc-300">Annuler</button>
                          </div>
                        ) : (
                          <button onClick={() => setConfirmDeleteId(report.id)} className="rounded-full bg-white/5 p-2 text-zinc-400 hover:bg-red-600 hover:text-white">
                            🗑️
                          </button>
                        )
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}