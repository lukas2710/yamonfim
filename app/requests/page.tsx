'use client';

import SectionNavigation from '@/components/SectionNavigation';
import PageHero from '@/components/PageHero';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

interface RequestItem {
  id: string;
  user_email: string;
  title: string;
  type: 'movie' | 'series';
  tmdb_id?: string;
  poster?: string;
  note?: string;
  status: 'en_attente' | 'en_cours' | 'ajoute' | 'refuse';
  created_at: string;
}

interface MediaItem {
  id: any;
  title: string;
  type: 'movie' | 'series';
}

interface TmdbResult {
  id: number;
  title?: string;
  name?: string;
  poster_path?: string;
  media_type?: string;
  release_date?: string;
  first_air_date?: string;
}

const ADMIN_EMAIL = 'lukas.leclerc312@gmail.com';
const TMDB_KEY = 'af281c5089038e174e83c576ff765be9';

type Status = RequestItem['status'];

const STATUS: Record<Status, { label: string; short: string; className: string; dot: string }> = {
  en_attente: { label: 'En attente', short: 'En attente', className: 'bg-white/5 text-zinc-300 ring-white/10', dot: 'bg-zinc-400' },
  en_cours: { label: 'En cours de traitement', short: 'En cours', className: 'bg-amber-500/10 text-amber-300 ring-amber-500/30', dot: 'bg-amber-400' },
  ajoute: { label: 'Ajouté au catalogue', short: 'Ajouté', className: 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/30', dot: 'bg-emerald-400' },
  refuse: { label: 'Non disponible', short: 'Non dispo', className: 'bg-red-500/10 text-red-300 ring-red-500/30', dot: 'bg-red-400' },
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
  if (diff < 86400 * 30) return `il y a ${Math.floor(diff / 86400)} j`;
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
};

const yearOf = (m: TmdbResult) => (m.release_date || m.first_air_date || '').slice(0, 4);

type IconName =
  | 'back' | 'search' | 'film' | 'tv' | 'close' | 'check' | 'alert' | 'send'
  | 'trash' | 'note' | 'inbox' | 'shield' | 'clock' | 'user';

const ICONS: Record<IconName, React.ReactNode> = {
  back: <path d="M19 12H5m6-7-7 7 7 7" />,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  film: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M7 4v16M17 4v16M3 9h4m10 0h4M3 15h4m10 0h4" /></>,
  tv: <><rect x="3" y="6" width="18" height="13" rx="2" /><path d="m8 2 4 4 4-4" /></>,
  close: <path d="M18 6 6 18M6 6l12 12" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  alert: <><circle cx="12" cy="12" r="9" /><path d="M12 8v4m0 4h.01" /></>,
  send: <path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z" />,
  trash: <><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /></>,
  note: <><path d="M4 4h16v12H8l-4 4V4Z" /></>,
  inbox: <><path d="M22 12h-6l-2 3h-4l-2-3H2" /><path d="M5.5 5h13L22 12v7H2v-7l3.5-7Z" /></>,
  shield: <path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3Z" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
};

function Icon({ name, className = 'w-4 h-4' }: { name: IconName; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}

function StatusBadge({ status }: { status: Status }) {
  const s = STATUS[status] || STATUS.en_attente;
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${s.className}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export default function RequestsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [catalogMedia, setCatalogMedia] = useState<MediaItem[]>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [type, setType] = useState<'movie' | 'series'>('movie');
  const [tmdbResults, setTmdbResults] = useState<TmdbResult[]>([]);
  const [selectedMedia, setSelectedMedia] = useState<TmdbResult | null>(null);
  const [searchingTmdb, setSearchingTmdb] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const searchBoxRef = useRef<HTMLDivElement>(null);

  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const [filter, setFilter] = useState<'all' | 'mine' | Status>('all');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const fetchData = async () => {
    const [reqRes, catRes] = await Promise.all([
      supabase.from('requests').select('*').order('created_at', { ascending: false }),
      supabase.from('media').select('id, title, type')
    ]);

    if (!reqRes.error && reqRes.data) setRequests(reqRes.data);
    if (!catRes.error && catRes.data) setCatalogMedia(catRes.data);
  };

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) setCurrentUser(session.user);
      await fetchData();
      setLoading(false);
    }
    init();
  }, []);

  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setTmdbResults([]);
      setSearchingTmdb(false);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearchingTmdb(true);
      try {
        const endpoint = type === 'movie' ? 'movie' : 'tv';
        const res = await fetch(
          `https://api.themoviedb.org/3/search/${endpoint}?api_key=${TMDB_KEY}&language=fr-FR&query=${encodeURIComponent(searchQuery.trim())}`,
          { signal: controller.signal }
        );
        const data = await res.json();
        if (data && data.results) {
          setTmdbResults(data.results.slice(0, 6));
          setActiveIdx(-1);
          setDropdownOpen(true);
        }
      } catch (err: any) {
        if (err?.name !== 'AbortError') console.error('Erreur TMDb search', err);
      } finally {
        if (!controller.signal.aborted) setSearchingTmdb(false);
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [searchQuery, type]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) setDropdownOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(''), 5000);
    return () => clearTimeout(t);
  }, [msg]);

  const selectMedia = (item: TmdbResult) => {
    setSelectedMedia(item);
    setSearchQuery('');
    setTmdbResults([]);
    setDropdownOpen(false);
  };

  const onSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!dropdownOpen || tmdbResults.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx(i => (i + 1) % tmdbResults.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx(i => (i <= 0 ? tmdbResults.length - 1 : i - 1));
    } else if (e.key === 'Enter' && activeIdx >= 0) {
      e.preventDefault();
      selectMedia(tmdbResults[activeIdx]);
    } else if (e.key === 'Escape') {
      setDropdownOpen(false);
    }
  };

  // Vérifie si le média est déjà dans le catalogue (base media) ou déjà demandé
  const duplicateInfo = useMemo(() => {
    let titleToCheck = '';
    let tmdbIdToCheck = '';

    if (selectedMedia) {
      titleToCheck = selectedMedia.title || selectedMedia.name || '';
      tmdbIdToCheck = String(selectedMedia.id);
    } else if (searchQuery.trim()) {
      titleToCheck = searchQuery.trim();
    }

    if (!titleToCheck) return null;
    const q = normalize(titleToCheck);

    // 1. Vérification dans le catalogue général (table media)
    const inCatalog = catalogMedia.find(
      m => m.type === type && normalize(m.title || '') === q
    );
    if (inCatalog) {
      return { type: 'catalog', label: 'déjà présent dans le catalogue' };
    }

    // 2. Vérification dans les demandes en cours / acceptées
    const inRequests = requests.find(r => {
      if (r.type !== type || r.status === 'refuse') return false;
      if (tmdbIdToCheck && r.tmdb_id === tmdbIdToCheck) return true;
      return normalize(r.title) === q;
    });

    if (inRequests) {
      if (inRequests.status === 'ajoute') {
        return { type: 'catalog', label: 'déjà ajouté au catalogue' };
      }
      return { type: 'request', label: `déjà demandé (${STATUS[inRequests.status].label.toLowerCase()})` };
    }

    return null;
  }, [selectedMedia, searchQuery, catalogMedia, requests, type]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMedia && !searchQuery.trim()) return;
    if (duplicateInfo || submitting) return;

    setSubmitting(true);
    setMsg('');
    setErrorMsg('');

    const mediaTitle = selectedMedia ? (selectedMedia.title || selectedMedia.name) : searchQuery.trim();
    const mediaTmdbId = selectedMedia ? String(selectedMedia.id) : null;
    const mediaPoster = selectedMedia?.poster_path ? `https://image.tmdb.org/t/p/w500${selectedMedia.poster_path}` : null;

    const { error } = await supabase.from('requests').insert([
      {
        user_id: currentUser?.id || null,
        user_email: currentUser?.email || 'Visiteur',
        title: mediaTitle,
        type,
        tmdb_id: mediaTmdbId,
        poster: mediaPoster,
        note: note.trim() || null,
        status: 'en_attente',
      },
    ]);

    if (error) {
      setErrorMsg(`Erreur : ${error.message}`);
    } else {
      setMsg(`« ${mediaTitle} » a bien été demandé. Tu pourras suivre son statut ci-dessous.`);
      setSearchQuery('');
      setSelectedMedia(null);
      setNote('');
      setTmdbResults([]);
      fetchData();
    }
    setSubmitting(false);
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    const { error } = await supabase.from('requests').update({ status: newStatus }).eq('id', id);
    if (!error) fetchData();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('requests').delete().eq('id', id);
    setConfirmDeleteId(null);
    if (!error) fetchData();
  };

  const isAdmin = currentUser?.email === ADMIN_EMAIL;
  const isMine = (r: RequestItem) => !!currentUser?.email && r.user_email === currentUser.email;

  const counts = useMemo(() => {
    const c = { all: requests.length, mine: 0, en_attente: 0, en_cours: 0, ajoute: 0, refuse: 0 };
    requests.forEach(r => {
      if (isMine(r)) c.mine++;
      if (c[r.status] !== undefined) c[r.status]++;
    });
    return c;
  }, [requests, currentUser]);

  const visibleRequests = requests.filter(r =>
    filter === 'all' ? true : filter === 'mine' ? isMine(r) : r.status === filter
  );

  const filterTabs: { key: typeof filter; label: string; count: number }[] = [
    { key: 'all', label: 'Toutes', count: counts.all },
    ...(currentUser ? [{ key: 'mine' as const, label: 'Mes demandes', count: counts.mine }] : []),
    { key: 'en_attente', label: 'En attente', count: counts.en_attente },
    { key: 'en_cours', label: 'En cours', count: counts.en_cours },
    { key: 'ajoute', label: 'Ajoutées', count: counts.ajoute },
    { key: 'refuse', label: 'Non dispo', count: counts.refuse },
  ];

  const canSubmit = (!!selectedMedia || searchQuery.trim().length > 0) && !duplicateInfo && !submitting;

  if (loading) {
    return (
      <main className="yf-page yf-requests min-h-screen bg-[#0a0a0b] text-white">
        <div className="h-16 border-b border-white/5" />
        <div className="mx-auto max-w-5xl space-y-6 px-4 pt-10 sm:px-10">
          <div className="h-10 w-72 animate-pulse rounded-xl bg-zinc-800" />
          <div className="h-64 animate-pulse rounded-3xl bg-zinc-900" />
          {[0, 1, 2].map(i => <div key={i} className="h-24 animate-pulse rounded-2xl bg-zinc-900" />)}
        </div>
      </main>
    );
  }

  return (
    <main className="yf-page yf-requests relative min-h-screen overflow-x-hidden bg-[#0a0a0b] pb-24 font-sans text-white antialiased selection:bg-red-600 selection:text-white">
      <div className="pointer-events-none absolute -top-56 left-1/2 h-[560px] w-[560px] -translate-x-1/2 rounded-full bg-red-600/10 blur-[140px]" />

      <header className="yf-topbar sticky top-0 z-40 border-b border-white/5 bg-[#0a0a0b]/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-10">
          <button
            onClick={() => router.push('/')}
            className="group inline-flex cursor-pointer items-center gap-2 rounded-full border border-white/10 bg-white/5 py-2 pl-3 pr-4 text-sm font-medium text-zinc-200 transition hover:bg-white/10 hover:text-white"
          >
            <Icon name="back" className="h-4 w-4 transition group-hover:-translate-x-0.5" />
            Accueil
          </button>
          <button onClick={() => router.push('/')} className="cursor-pointer select-none text-lg font-black tracking-[0.2em] text-red-600">
            YAMON<span className="text-white">FIM</span>
          </button>
          {isAdmin ? (
            <span className="hidden items-center gap-1.5 rounded-full bg-red-600/15 px-3 py-1.5 text-xs font-bold text-red-300 ring-1 ring-red-500/30 sm:flex">
              <Icon name="shield" className="h-3.5 w-3.5" /> Mode admin
            </span>
          ) : (
            <span className="hidden w-[100px] sm:block" />
          )}
        </div>
      </header>
      <SectionNavigation />

      <div className="relative mx-auto max-w-5xl space-y-12 px-4 pt-10 sm:px-10">
        <PageHero eyebrow="TES ENVIES FONT LE PROGRAMME" title="Le prochain coup de cœur." accent="C’est toi qui proposes." description="Un film introuvable ? Une série à découvrir ? Propose ton titre et suis sa progression jusqu’à son arrivée au catalogue." cardLabel="LES DEMANDES" cardTitle="À toi de faire le programme." cardDetail="PROPOSER · SUIVRE · DÉCOUVRIR" variant="collection"><a href="#nouvelle-demande">Proposer un titre <span aria-hidden="true">↗</span></a></PageHero>

        <section id="nouvelle-demande" className="yf-surface rounded-3xl bg-white/[0.03] p-5 ring-1 ring-white/10 sm:p-8">
          {msg && (
            <div role="status" className="mb-6 flex items-start gap-3 rounded-2xl bg-emerald-500/10 px-4 py-3 ring-1 ring-emerald-500/30">
              <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
              <p className="text-sm text-emerald-200">{msg}</p>
            </div>
          )}
          {errorMsg && (
            <div role="alert" className="mb-6 flex items-start gap-3 rounded-2xl bg-red-600/10 px-4 py-3 ring-1 ring-red-500/30">
              <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
              <p className="text-sm text-red-300">{errorMsg}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">1. Type de contenu</p>
              <div className="grid grid-cols-2 gap-2 sm:inline-grid sm:w-auto">
                {([
                  { key: 'movie', label: 'Film', icon: 'film' },
                  { key: 'series', label: 'Série', icon: 'tv' },
                ] as const).map(t => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => {
                      setType(t.key);
                      setSelectedMedia(null);
                      setTmdbResults([]);
                    }}
                    className={`flex cursor-pointer items-center justify-center gap-2 rounded-2xl px-6 py-3 text-sm font-semibold transition ${
                      type === t.key
                        ? 'bg-white text-black shadow'
                        : 'bg-white/5 text-zinc-400 ring-1 ring-white/10 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <Icon name={t.icon} className="h-4 w-4" /> {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">2. Titre</p>

              {selectedMedia ? (
                <div className="flex items-center gap-4 rounded-2xl bg-red-600/10 p-3 ring-1 ring-red-500/30">
                  <div className="h-24 w-16 shrink-0 overflow-hidden rounded-xl bg-zinc-900">
                    {selectedMedia.poster_path && (
                      <img src={`https://image.tmdb.org/t/p/w185${selectedMedia.poster_path}`} alt="" className="h-full w-full object-cover" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-red-400">Sélectionné</span>
                    <h3 className="truncate text-base font-bold">{selectedMedia.title || selectedMedia.name}</h3>
                    <p className="text-xs text-zinc-400">
                      {type === 'movie' ? 'Film' : 'Série'}
                      {yearOf(selectedMedia) && ` · ${yearOf(selectedMedia)}`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedMedia(null)}
                    className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-white/10 px-3 py-2 text-xs font-medium text-zinc-200 transition hover:bg-white/15 hover:text-white"
                  >
                    <Icon name="close" className="h-3.5 w-3.5" /> Changer
                  </button>
                </div>
              ) : (
                <div className="relative" ref={searchBoxRef}>
                  <Icon name="search" className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                  <input
                    type="text"
                    required
                    role="combobox"
                    aria-expanded={dropdownOpen && tmdbResults.length > 0}
                    aria-autocomplete="list"
                    placeholder={type === 'movie' ? 'Ex : Avatar, Fast & Furious…' : 'Ex : Breaking Bad, Game of Thrones…'}
                    value={searchQuery}
                    onChange={e => {
                      setSearchQuery(e.target.value);
                      setSelectedMedia(null);
                    }}
                    onFocus={() => tmdbResults.length > 0 && setDropdownOpen(true)}
                    onKeyDown={onSearchKeyDown}
                    className="w-full rounded-2xl border border-white/10 bg-black/30 py-4 pl-11 pr-11 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-red-600/70 focus:ring-4 focus:ring-red-600/15"
                  />
                  {searchingTmdb && (
                    <span className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                  )}

                  {dropdownOpen && tmdbResults.length > 0 && (
                    <div role="listbox" className="absolute left-0 right-0 top-full z-50 mt-2 max-h-80 overflow-y-auto rounded-2xl border border-white/10 bg-[#141416]/95 p-1.5 shadow-2xl backdrop-blur-xl">
                      {tmdbResults.map((item, i) => {
                        const name = item.title || item.name || '';
                        const qName = normalize(name);
                        const inCat = catalogMedia.find(m => m.type === type && normalize(m.title || '') === qName);
                        const inReq = requests.find(r => r.type === type && r.status !== 'refuse' && (r.tmdb_id === String(item.id) || normalize(r.title) === qName));

                        return (
                          <button
                            key={item.id}
                            type="button"
                            role="option"
                            aria-selected={i === activeIdx}
                            onMouseEnter={() => setActiveIdx(i)}
                            onClick={() => selectMedia(item)}
                            className={`flex w-full cursor-pointer items-center gap-3 rounded-xl p-2 text-left transition ${
                              i === activeIdx ? 'bg-white/10' : 'hover:bg-white/5'
                            }`}
                          >
                            <div className="h-14 w-10 shrink-0 overflow-hidden rounded-lg bg-zinc-800">
                              {item.poster_path && (
                                <img src={`https://image.tmdb.org/t/p/w92${item.poster_path}`} alt="" className="h-full w-full object-cover" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-white">{name}</p>
                              <p className="text-xs text-zinc-500">{yearOf(item) || 'Année inconnue'}</p>
                            </div>
                            {inCat ? (
                              <span className="shrink-0 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300 ring-1 ring-emerald-500/30">
                                Dans le catalogue
                              </span>
                            ) : inReq ? (
                              <StatusBadge status={inReq.status} />
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {dropdownOpen && !searchingTmdb && searchQuery.trim().length >= 2 && tmdbResults.length === 0 && (
                    <div className="absolute left-0 right-0 top-full z-50 mt-2 rounded-2xl border border-white/10 bg-[#141416]/95 p-4 text-sm text-zinc-400 shadow-2xl backdrop-blur-xl">
                      Aucun résultat trouvé. Tu peux quand même envoyer ta demande avec ce titre.
                    </div>
                  )}
                </div>
              )}

              {duplicateInfo && (
                <div className="mt-3 flex items-start gap-3 rounded-2xl bg-amber-500/10 px-4 py-3 ring-1 ring-amber-500/30">
                  <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                  <p className="text-sm text-amber-100">
                    Ce titre est <span className="font-semibold">{duplicateInfo.label}</span>. Il est impossible de le demander une nouvelle fois.
                  </p>
                </div>
              )}
            </div>

            <div>
              <label htmlFor="note" className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-zinc-400">
                <span>3. Remarque <span className="normal-case tracking-normal text-zinc-600">(optionnel)</span></span>
                <span className="font-normal normal-case tracking-normal text-zinc-600">{note.length}/200</span>
              </label>
              <div className="relative">
                <Icon name="note" className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <input
                  id="note"
                  type="text"
                  maxLength={200}
                  placeholder="Ex : version VF uniquement, saison 3…"
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-black/30 py-3.5 pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-red-600/70 focus:ring-4 focus:ring-red-600/15"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={!canSubmit}
              className="yf-primary flex w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-red-600 py-4 text-sm font-bold text-white shadow-lg shadow-red-600/25 transition hover:bg-red-500 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-zinc-500 disabled:shadow-none"
            >
              {submitting ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> Envoi…
                </>
              ) : (
                <>
                  <Icon name="send" className="h-4 w-4" /> Envoyer la demande
                </>
              )}
            </button>

            {!currentUser && (
              <p className="text-center text-xs text-zinc-500">
                Tu n'es pas connecté : ta demande sera envoyée en tant que visiteur.{' '}
                <button type="button" onClick={() => router.push('/login')} className="cursor-pointer font-semibold text-white hover:text-red-500">
                  Se connecter
                </button>
              </p>
            )}
          </form>
        </section>

        <section>
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold tracking-tight sm:text-2xl">Demandes de la communauté</h2>
              <p className="mt-1 text-sm text-zinc-500">
                {counts.ajoute} ajoutée{counts.ajoute > 1 ? 's' : ''} au catalogue sur {counts.all} demande{counts.all > 1 ? 's' : ''}
              </p>
            </div>
          </div>

          <div className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
            {filterTabs.map(t => (
              <button
                key={t.key}
                onClick={() => setFilter(t.key)}
                className={`inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
                  filter === t.key
                    ? 'bg-white text-black'
                    : 'bg-white/5 text-zinc-400 ring-1 ring-white/10 hover:bg-white/10 hover:text-white'
                }`}
              >
                {t.label}
                <span className={`rounded-full px-1.5 text-[11px] tabular-nums ${filter === t.key ? 'bg-black/10' : 'bg-white/10'}`}>
                  {t.count}
                </span>
              </button>
            ))}
          </div>

          {visibleRequests.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-white/10 py-16 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 text-zinc-500">
                <Icon name="inbox" className="h-5 w-5" />
              </span>
              <p className="font-semibold">Aucune demande ici</p>
              <p className="text-sm text-zinc-500">
                {filter === 'mine' ? "Tu n'as encore rien demandé." : 'Rien à afficher pour ce filtre.'}
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {visibleRequests.map(req => {
                const mine = isMine(req);
                return (
                  <li
                    key={req.id}
                    className={`flex flex-col gap-4 rounded-2xl p-4 ring-1 transition sm:flex-row sm:items-center ${
                      mine ? 'bg-red-600/[0.04] ring-red-500/20' : 'bg-white/[0.03] ring-white/10 hover:bg-white/[0.05]'
                    }`}
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-4">
                      <div className="flex h-20 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-zinc-900 text-zinc-600">
                        {req.poster
                          ? <img src={req.poster} alt="" loading="lazy" className="h-full w-full object-cover" />
                          : <Icon name={req.type === 'movie' ? 'film' : 'tv'} className="h-5 w-5" />}
                      </div>

                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-md bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-300">
                            {req.type === 'movie' ? 'Film' : 'Série'}
                          </span>
                          {mine && (
                            <span className="rounded-md bg-red-600/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-300">
                              Ta demande
                            </span>
                          )}
                        </div>
                        <h3 className="truncate text-base font-bold">{req.title}</h3>
                        {req.note && <p className="line-clamp-2 text-sm text-zinc-400">« {req.note} »</p>}
                        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
                          <span className="inline-flex items-center gap-1">
                            <Icon name="user" className="h-3 w-3" />
                            {isAdmin || mine ? req.user_email : maskEmail(req.user_email)}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Icon name="clock" className="h-3 w-3" /> {timeAgo(req.created_at)}
                          </span>
                          {isAdmin && req.tmdb_id && <span>TMDb {req.tmdb_id}</span>}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0 sm:pl-4">
                      {isAdmin ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="flex rounded-full bg-black/30 p-1 ring-1 ring-white/10">
                            {(Object.keys(STATUS) as Status[]).map(s => (
                              <button
                                key={s}
                                onClick={() => req.status !== s && handleStatusChange(req.id, s)}
                                title={STATUS[s].label}
                                className={`cursor-pointer whitespace-nowrap rounded-full px-2.5 py-1.5 text-[11px] font-semibold transition ${
                                  req.status === s ? `ring-1 ${STATUS[s].className}` : 'text-zinc-500 hover:text-white'
                                }`}
                              >
                                {STATUS[s].short}
                              </button>
                            ))}
                          </div>

                          {confirmDeleteId === req.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleDelete(req.id)}
                                className="yf-primary cursor-pointer rounded-full bg-red-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-red-500"
                              >
                                Supprimer
                              </button>
                              <button
                                onClick={() => setConfirmDeleteId(null)}
                                className="cursor-pointer rounded-full px-3 py-1.5 text-xs text-zinc-400 transition hover:text-white"
                              >
                                Annuler
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmDeleteId(req.id)}
                              aria-label="Supprimer la demande"
                              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-red-600/10 text-red-400 ring-1 ring-red-500/30 transition hover:bg-red-600/25"
                            >
                              <Icon name="trash" className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      ) : (
                        <StatusBadge status={req.status} />
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}