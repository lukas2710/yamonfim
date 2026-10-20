'use client';

import DiscoveryLinks from '@/components/DiscoveryLinks';
import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { fetchSubscriptionProfile } from '@/lib/subscription';
import PromoBanner from '@/components/PromoBanner';

interface MediaItem {
  id: any;
  title: string;
  type: 'movie' | 'series';
  poster: string;
  backdrop?: string;
  url: string;
  description: string;
  genres?: string[];
  seasons?: any[];
  runtime?: number;
  progress?: {
    seasonIdx: number;
    episodeIdx: number;
    seasonNumber: number;
    episodeNumber: number;
    currentTime?: number;
    duration?: number;
  };
}

const DEFAULT_GENRES = [
  'Action', 'Aventure', 'Animation', 'Comédie', 'Crime',
  'Documentaire', 'Drame', 'Famille', 'Fantastique', 'Horreur',
  'Mystère', 'Romance', 'Science-Fiction', 'Thriller',
];

const ADMIN_EMAIL = 'lukas.leclerc312@gmail.com';
const MAX_FREE_LIMIT = 5;

type IconName =
  | 'play' | 'info' | 'search' | 'close' | 'home' | 'film' | 'tv'
  | 'request' | 'history' | 'crown' | 'lock' | 'logout' | 'shield'
  | 'chevronLeft' | 'chevronRight' | 'check' | 'user' | 'flame' | 'trash' | 'alert' | 'sparkles' | 'chart';

const ICONS: Record<IconName, React.ReactNode> = {
  play: <path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5Z" fill="currentColor" stroke="none" />,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5m0-8h.01" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  close: <path d="M18 6 6 18M6 6l12 12" />,
  home: <><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9v11h14V9" /></>,
  film: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M7 4v16M17 4v16M3 9h4m10 0h4M3 15h4m10 0h4" /></>,
  tv: <><rect x="3" y="6" width="18" height="13" rx="2" /><path d="m8 2 4 4 4-4" /></>,
  request: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></>,
  history: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5M12 7v5l3 2" /></>,
  crown: <path d="m3 7 4.5 4L12 4l4.5 7L21 7l-2 12H5L3 7Z" />,
  lock: <><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>,
  logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5M21 12H9" /></>,
  shield: <path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3Z" />,
  chevronLeft: <path d="m15 18-6-6 6-6" />,
  chevronRight: <path d="m9 18 6-6-6-6" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  flame: <path d="M12 22c4 0 7-2.8 7-7 0-3.5-2.5-6-4-8-.5 2-1.5 3-3 3 0-3-1-6-4-8 0 4-5 6.5-5 13 0 4.2 3 7 9 7Z" />,
  trash: <><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /></>,
  alert: <><circle cx="12" cy="12" r="9" /><path d="M12 8v4m0 4h.01" /></>,
  sparkles: <path d="m12 3 1.912 5.813a2 2 0 0 0 1.275 1.275L21 12l-5.813 1.912a2 2 0 0 0-1.275 1.275L12 21l-1.912-5.813a2 2 0 0 0-1.275-1.275L3 12l5.813-1.912a2 2 0 0 0 1.275-1.275L12 3Z" />,
  chart: <><path d="M3 3v18h18" /><path d="m7 14 4-4 4 4 5-6" /></>,
};

function Icon({ name, className = 'w-4 h-4' }: { name: IconName; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}

const activateProps = (onActivate: () => void) => ({
  role: 'button' as const,
  tabIndex: 0,
  onClick: onActivate,
  onKeyDown: (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onActivate();
    }
  },
});

function PosterCard({
  item, locked, onOpen, className = '',
}: { item: MediaItem; locked: boolean; onOpen: () => void; className?: string }) {
  return (
    <div
      {...activateProps(onOpen)}
      aria-label={item.title}
      className={`yf-poster-card group relative aspect-[2/3] shrink-0 cursor-pointer overflow-hidden rounded-xl bg-zinc-900 ring-1 ring-white/5 transition duration-300 hover:-translate-y-1 hover:ring-white/25 hover:shadow-2xl hover:shadow-black/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600 active:scale-[0.97] ${className}`}
    >
      {item.poster ? (
        <img
          src={item.poster}
          alt={item.title}
          loading="lazy"
          className={`h-full w-full object-cover transition duration-500 group-hover:scale-105 ${locked ? 'blur-[2px] opacity-40' : ''}`}
        />
      ) : (
        <div className="flex h-full items-center justify-center p-3 text-center text-xs text-zinc-500">
          {item.title || 'Aucune image'}
        </div>
      )}

      {!locked && (
        <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/90 via-black/20 to-transparent p-3 opacity-100 transition duration-300 group-hover:opacity-100">
          <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-white text-black shadow-lg">
            <Icon name="play" className="h-4 w-4 translate-x-[1px]" />
          </div>
          <p className="line-clamp-2 text-xs font-semibold leading-snug text-white">{item.title}</p>
          <p className="mt-0.5 text-[10px] uppercase tracking-wider text-zinc-400">
            {item.type === 'movie' ? 'Film' : 'Série'}
          </p>
        </div>
      )}

      {locked && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/30">
            <Icon name="lock" />
          </span>
          <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-400 ring-1 ring-amber-500/30">
            VIP requis
          </span>
        </div>
      )}
    </div>
  );
}

function Row({
  title, subtitle, icon, children,
}: { title: string; subtitle?: string; icon?: React.ReactNode; children: React.ReactNode }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const scroll = (dir: 1 | -1) => {
    const el = scrollerRef.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: 'smooth' });
  };

  return (
    <section className="group/row relative">
      <div className="mb-3 flex items-end justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight text-white sm:text-xl">
            {icon}
            {title}
          </h2>
          {subtitle && <p className="mt-0.5 text-xs text-zinc-400 sm:text-sm">{subtitle}</p>}
        </div>
        <div className="hidden gap-2 opacity-0 transition group-hover/row:opacity-100 sm:flex">
          <button onClick={() => scroll(-1)} aria-label="Défiler à gauche"
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-300 transition hover:bg-white/10 hover:text-white">
            <Icon name="chevronLeft" />
          </button>
          <button onClick={() => scroll(1)} aria-label="Défiler à droite"
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-300 transition hover:bg-white/10 hover:text-white">
            <Icon name="chevronRight" />
          </button>
        </div>
      </div>
      <div
        ref={scrollerRef}
        className="-mx-4 flex snap-x gap-3 overflow-x-auto scroll-px-4 px-4 pb-4 pt-2 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] sm:-mx-10 sm:gap-4 sm:scroll-px-10 sm:px-10 [&::-webkit-scrollbar]:hidden [&>*]:snap-start"
      >
        {children}
      </div>
    </section>
  );
}

export default function Home() {
  const router = useRouter();
  const [mediaList, setMediaList] = useState<MediaItem[]>([]);
  const [continueWatchingList, setContinueWatchingList] = useState<MediaItem[]>([]);
  const [becauseYouWatched, setBecauseYouWatched] = useState<{ parentTitle: string; list: MediaItem[] } | null>(null);
  const [recommendedForYou, setRecommendedForYou] = useState<MediaItem[]>([]);
  const [customBanners, setCustomBanners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<'all' | 'movie' | 'series'>('all');
  const [selectedGenre, setSelectedGenre] = useState<string>('all');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [activeProfile, setActiveProfile] = useState<any>(null);

  const [isVip, setIsVip] = useState(false);
  const [watchCount, setWatchCount] = useState(0);
  const [showVipModal, setShowVipModal] = useState(false);

  const [scrolled, setScrolled] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function checkUserAndFetch() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.push('/login');
          return;
        }

        const user = session.user;
        setUserEmail(user.email || null);
        setCurrentUserId(user.id);

        const profileStored = localStorage.getItem('active_profile');
        if (!profileStored) {
          router.push('/profiles');
          return;
        }

        let currentProfile: any = null;
        try {
          currentProfile = JSON.parse(profileStored);
        } catch (e) {
          router.push('/profiles');
          return;
        }

        setActiveProfile(currentProfile);

        const { data: profile } = await fetchSubscriptionProfile(user.id);

        const userIsVip = user.email === ADMIN_EMAIL || (profile ? !!profile.is_vip : false);
        const userWatchCount = profile ? profile.watch_count || 0 : 0;

        setIsVip(userIsVip);
        setWatchCount(userWatchCount);

        let watchedQuery = supabase
          .from('user_watched')
          .select('*')
          .eq('user_id', user.id);

        if (currentProfile?.id) {
          watchedQuery = watchedQuery.eq('profile_id', currentProfile.id);
        }

        const [mediaRes, watchedRes, bannerRes] = await Promise.all([
          supabase.from('media').select('*').order('created_at', { ascending: false }),
          watchedQuery.order('watched_at', { ascending: false }),
          supabase.from('banners').select('*').eq('active', true).order('created_at', { ascending: false }),
        ]);

        const { data: mediaData, error: mediaError } = mediaRes;
        const { data: watchedData } = watchedRes;
        const { data: bannerData } = bannerRes;

        if (bannerData) setCustomBanners(bannerData);

        if (!mediaError && mediaData) {
          setMediaList(mediaData);

          if (watchedData && watchedData.length > 0) {
            const continueListMap = new Map<string, MediaItem>();

            for (const watchedItem of watchedData) {
              const mediaId = String(watchedItem.media_id);
              if (continueListMap.has(mediaId)) continue;

              let foundMedia: MediaItem | undefined = undefined;
              for (const m of mediaData) {
                if (String(m.id) === mediaId) {
                  foundMedia = m;
                  break;
                }
              }

              if (foundMedia) {
                let seasonIdx = 0;
                let episodeIdx = 0;
                let seasonNumber = 1;
                let episodeNumber = 1;

                if (watchedItem.ep_key && watchedItem.ep_key !== 'movie_main') {
                  const match = /^s(\d+)_e(\d+)$/.exec(watchedItem.ep_key);
                  if (match) {
                    seasonIdx = Number(match[1]);
                    episodeIdx = Number(match[2]);
                    seasonNumber = seasonIdx + 1;
                    episodeNumber = episodeIdx + 1;
                  }
                }

                continueListMap.set(mediaId, {
                  ...foundMedia,
                  progress: {
                    seasonIdx,
                    episodeIdx,
                    seasonNumber,
                    episodeNumber,
                  },
                });
              }
            }

            setContinueWatchingList(Array.from(continueListMap.values()));
          }
        }
      } catch (err) {
        console.error("Erreur lors du chargement de l'accueil:", err);
      } finally {
        setLoading(false);
      }
    }

    checkUserAndFetch();
  }, [router]);

  const handleMediaClick = (item: MediaItem) => {
    if (item.id === undefined || item.id === null) return;
    if (item.type === 'series' && item.progress) {
      router.push(`/watch/${item.id}?s=${item.progress.seasonIdx}&e=${item.progress.episodeIdx}`);
    } else {
      router.push(`/watch/${item.id}`);
    }
  };

  const handleRemoveFromContinue = async (e: React.MouseEvent, mediaId: any) => {
    e.stopPropagation();
    if (!currentUserId || !activeProfile) return;

    try {
      let deleteQuery = supabase
        .from('user_watched')
        .delete()
        .eq('user_id', currentUserId)
        .eq('media_id', String(mediaId));

      if (activeProfile?.id) {
        deleteQuery = deleteQuery.eq('profile_id', activeProfile.id);
      }

      const { error } = await deleteQuery;

      if (!error) {
        const updatedList: MediaItem[] = [];
        for (const item of continueWatchingList) {
          if (String(item.id) !== String(mediaId)) {
            updatedList.push(item);
          }
        }
        setContinueWatchingList(updatedList);
      }
    } catch (err) {
      console.error("Erreur lors de la suppression de l'historique :", err);
    }
  };

  const handleLogout = async () => {
    localStorage.removeItem('active_profile');
    await supabase.auth.signOut();
    router.push('/login');
  };

  const selectType = (type: 'all' | 'movie' | 'series') => {
    setSelectedType(type);
    setSelectedGenre('all');
    setSearchQuery('');
    setSearchOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [menuOpen]);

  const dbGenres: string[] = [];
  for (const item of mediaList) {
    if (selectedType === 'all' || item.type === selectedType) {
      if (item.genres) {
        for (const g of item.genres) {
          dbGenres.push(g);
        }
      }
    }
  }

  const availableGenres = Array.from(new Set(dbGenres.length > 0 ? dbGenres : DEFAULT_GENRES)).sort();
  const carouselItems = mediaList.slice(0, 5);

  useEffect(() => {
    if (carouselItems.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % carouselItems.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [carouselItems.length, currentIndex]);

  const featured: MediaItem = carouselItems[currentIndex] || {
    id: null,
    title: 'Bienvenue sur YAMONFIM',
    type: 'movie',
    poster: '',
    backdrop: '',
    description: 'Ajoute tes premiers films ou séries depuis ton espace admin.',
    url: '#',
  };

  const query = searchQuery.trim().toLowerCase();
  const filteredMedia: MediaItem[] = [];
  for (const item of mediaList) {
    const matchesType = selectedType === 'all' || item.type === selectedType;
    const matchesGenre = selectedGenre === 'all' || (item.genres && item.genres.includes(selectedGenre));
    const matchesSearch =
      !query ||
      (item.title || '').toLowerCase().includes(query) ||
      (item.description || '').toLowerCase().includes(query);
    if (matchesType && matchesGenre && matchesSearch) {
      filteredMedia.push(item);
    }
  }

  const recentMovies: MediaItem[] = [];
  const recentSeries: MediaItem[] = [];
  for (const item of filteredMedia) {
    if (item.type === 'movie') recentMovies.push(item);
    if (item.type === 'series') recentSeries.push(item);
  }

  const hasText = (v?: string) => !!v && v.trim() !== '';
  const getHeroImage = (m: MediaItem) => (hasText(m.backdrop) ? m.backdrop! : m.poster);
  const getMobileHeroImage = (m: MediaItem) => (hasText(m.poster) ? m.poster : m.backdrop || '');

  const userLimitReached = !isVip && watchCount >= MAX_FREE_LIMIT;
  const isAdmin = userEmail === ADMIN_EMAIL;
  const isFiltered = !!searchQuery || selectedGenre !== 'all' || selectedType !== 'all';
  const showHero = !searchQuery && selectedType === 'all';

  if (loading) {
    return (
      <main className="yf-page yf-home min-h-screen bg-[#0a0a0b] text-white">
        <div className="h-16 border-b border-white/5" />
        <div className="h-[72svh] w-full animate-pulse bg-gradient-to-b from-zinc-900 to-[#0a0a0b] sm:h-[55vh]" />
        <div className="space-y-10 px-4 sm:px-10 -mt-10">
          {[0, 1].map(r => (
            <div key={r} className="space-y-3">
              <div className="h-5 w-40 animate-pulse rounded bg-zinc-800" />
              <div className="flex gap-4 overflow-hidden">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="aspect-[2/3] w-[130px] shrink-0 animate-pulse rounded-xl bg-zinc-900 sm:w-[170px]" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>
    );
  }

  const navItems: { key: 'all' | 'movie' | 'series'; label: string }[] = [
    { key: 'all', label: 'Accueil' },
    { key: 'movie', label: 'Films' },
    { key: 'series', label: 'Séries' },
  ];

  return (
    <main className="yf-page yf-home min-h-screen max-w-[100vw] overflow-x-hidden bg-[#0a0a0b] pb-28 font-sans text-white antialiased selection:bg-red-600 selection:text-white sm:pb-16">

      {showVipModal && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
          onClick={() => setShowVipModal(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="relative w-full max-w-md overflow-hidden rounded-3xl border border-amber-500/20 bg-[#111113] shadow-[0_0_80px_-20px_rgba(245,158,11,0.35)]"
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-amber-500/15 to-transparent" />
            <button
              onClick={() => setShowVipModal(false)}
              aria-label="Fermer"
              className="absolute right-4 top-4 z-10 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-white/5 text-zinc-400 transition hover:bg-white/10 hover:text-white"
            >
              <Icon name="close" />
            </button>

            <div className="relative p-8 text-center">
              <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-zinc-950 shadow-lg shadow-amber-500/30">
                <Icon name="crown" className="h-7 w-7" />
              </div>
              <h3 className="mb-2 text-xl font-bold tracking-tight">Passez à l'expérience VIP</h3>
              <p className="mb-5 text-sm leading-relaxed text-zinc-400">
                {userLimitReached ? (
                  <>Vous avez atteint votre quota gratuit de <span className="font-semibold text-white">{MAX_FREE_LIMIT} visions</span>.</>
                ) : (
                  <>Il vous reste <span className="font-semibold text-white">{Math.max(0, MAX_FREE_LIMIT - watchCount)} vision{MAX_FREE_LIMIT - watchCount > 1 ? 's' : ''}</span> gratuite{MAX_FREE_LIMIT - watchCount > 1 ? 's' : ''}.</>
                )}{' '}
                Débloquez un accès illimité.
              </p>

              <div className="mb-6">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-600 transition-all"
                    style={{ width: `${Math.min(100, (watchCount / MAX_FREE_LIMIT) * 100)}%` }}
                  />
                </div>
                <p className="mt-1.5 text-right text-[11px] text-zinc-500">
                  {Math.min(watchCount, MAX_FREE_LIMIT)}/{MAX_FREE_LIMIT} visions utilisées
                </p>
              </div>

              <ul className="mb-7 space-y-2.5 text-left">
                {['Visionnage illimité', 'Tous les films et séries', 'Accès immédiat après paiement'].map((f: string) => (
                  <li key={f} className="flex items-center gap-3 text-sm text-zinc-300">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-400">
                      <Icon name="check" className="h-3 w-3" />
                    </span>
                    {f}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => router.push('/abonnement')}
                className="w-full cursor-pointer rounded-full bg-gradient-to-r from-amber-400 to-amber-500 py-3.5 text-sm font-bold text-zinc-950 shadow-lg shadow-amber-500/20 transition hover:from-amber-300 hover:to-amber-400 focus:outline-none focus-visible:ring-4 focus-visible:ring-amber-400/50"
              >
                Voir l'offre VIP
              </button>
              <button
                onClick={() => setShowVipModal(false)}
                className="mt-3 w-full cursor-pointer py-2 text-sm text-zinc-400 transition hover:text-white"
              >
                Plus tard
              </button>
            </div>
          </div>
        </div>
      )}

      <header
        className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${
          scrolled || !showHero
            ? 'border-b border-white/5 bg-[#0a0a0b]/90 backdrop-blur-xl'
            : 'bg-gradient-to-b from-black/80 to-transparent'
        }`}
      >
        <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-10">
          <div className="flex min-w-0 items-center gap-8">
            <button
              onClick={() => selectType('all')}
              className="shrink-0 cursor-pointer select-none text-lg font-black tracking-[0.2em] text-red-600 sm:text-xl"
            >
              YAMON<span className="text-white">FIM</span>
            </button>

            <nav className="hidden items-center gap-1 lg:flex">
              {navItems.map(n => {
                const active = selectedType === n.key && !(n.key === 'all' && searchQuery);
                return (
                  <button
                    key={n.key}
                    onClick={() => selectType(n.key)}
                    className={`relative cursor-pointer rounded-full px-4 py-2 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600 ${
                      active ? 'text-white' : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    {n.label}
                    {active && <span className="absolute inset-x-4 -bottom-0.5 h-0.5 rounded-full bg-red-600" />}
                  </button>
                );
              })}
              <button
                onClick={() => router.push('/requests')}
                className="cursor-pointer rounded-full px-4 py-2 text-sm font-medium text-zinc-400 transition hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
              >
                Demandes
              </button>
            </nav>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div
              className={`flex items-center overflow-hidden rounded-full border transition-all duration-300 ${searchOpen || searchQuery ? 'yf-mobile-search' : ''} ${
                searchOpen || searchQuery
                  ? 'w-40 border-white/15 bg-black/60 sm:w-64'
                  : 'w-9 border-transparent bg-transparent'
              }`}
            >
              <button
                onClick={() => setSearchOpen(true)}
                aria-label="Rechercher"
                className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center text-zinc-300 hover:text-white"
              >
                <Icon name="search" className="h-[18px] w-[18px]" />
              </button>
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Titres, descriptions…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onBlur={() => !searchQuery && setSearchOpen(false)}
                className="min-w-0 flex-1 bg-transparent pr-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none"
              />
              {searchQuery && (
                <button
                  onClick={() => { setSearchQuery(''); setSearchOpen(false); }}
                  aria-label="Effacer la recherche"
                  className="mr-2 flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-full text-zinc-400 hover:bg-white/10 hover:text-white"
                >
                  <Icon name="close" className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {isVip ? (
              <button
                onClick={() => router.push('/abonnement')}
                className="hidden cursor-pointer items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-400/20 to-amber-600/20 px-3 py-1.5 text-xs font-bold text-amber-300 ring-1 ring-amber-500/30 transition hover:from-amber-400/30 hover:to-amber-600/30 sm:flex"
              >
                <Icon name="crown" className="h-3.5 w-3.5" /> VIP
              </button>
            ) : (
              <button
                onClick={() => router.push('/abonnement')}
                className="flex cursor-pointer items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-400 ring-1 ring-amber-500/30 transition hover:bg-amber-500/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              >
                <Icon name="crown" className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">VIP</span>
                <span className="tabular-nums">{watchCount}/{MAX_FREE_LIMIT}</span>
              </button>
            )}

            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen(o => !o)}
                aria-label="Menu du compte"
                aria-expanded={menuOpen}
                aria-controls="account-menu"
                className={`flex max-w-[180px] cursor-pointer items-center gap-2 rounded-full border px-2 py-1.5 text-white transition focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 ${menuOpen ? 'border-red-400/60 bg-red-500/15' : 'border-white/15 bg-white/5 hover:border-red-400/40 hover:bg-white/10'}`}
              >
                {activeProfile?.avatar_url?.startsWith('http') ? (
                  <img src={activeProfile.avatar_url} alt="" className="h-7 w-7 shrink-0 rounded-full object-cover" />
                ) : (
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-600 text-xs font-bold uppercase">
                    {activeProfile?.name?.[0] || userEmail?.[0] || <Icon name="user" />}
                  </span>
                )}
                <span className="hidden min-w-0 truncate text-xs font-semibold sm:block">{activeProfile?.name || 'Mon compte'}</span>
                <Icon name="chevronRight" className={`h-3.5 w-3.5 shrink-0 text-zinc-400 transition-transform ${menuOpen ? '-rotate-90' : 'rotate-90'}`} />
              </button>

              {menuOpen && (
                <div id="account-menu" className="absolute right-0 mt-2 w-64 overflow-hidden rounded-2xl border border-white/10 bg-[#141416]/95 shadow-2xl backdrop-blur-xl">
                  <div className="border-b border-white/5 px-4 py-3">
                    <p className="text-[11px] uppercase tracking-wider text-zinc-500">Connecté</p>
                    <p className="truncate text-sm font-medium text-white">{userEmail}</p>
                  </div>
                  <div className="p-1.5">
                    <button
                      onClick={() => router.push('/profiles')}
                      className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-zinc-300 transition hover:bg-white/5 hover:text-white"
                    >
                      <Icon name="user" /> Changer de profil
                    </button>
                    <button
                      onClick={() => router.push('/abonnement')}
                      className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-amber-300 transition hover:bg-amber-500/10"
                    >
                      <Icon name="crown" /> {isVip ? 'Mon abonnement VIP' : 'Passer au VIP'}
                    </button>
                    <button
                      onClick={() => router.push('/history')}
                      className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-zinc-300 transition hover:bg-white/5 hover:text-white"
                    >
                      <Icon name="history" /> Historique
                    </button>
                    <button
                      onClick={() => router.push('/requests')}
                      className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-zinc-300 transition hover:bg-white/5 hover:text-white"
                    >
                      <Icon name="request" /> Demandes
                    </button>
                    <button
                      onClick={() => router.push('/report')}
                      className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-zinc-300 transition hover:bg-white/5 hover:text-white"
                    >
                      <Icon name="alert" /> Signaler un problème / Idée
                    </button>
                    {isAdmin && (
                      <div className="mt-2 border-t border-white/10 pt-2">
                        <p className="px-3 pb-2 pt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-red-400">Administration</p>
                        {([
                          { href: '/admin', label: 'Gestion du catalogue', icon: 'shield' },
                          { href: '/admin/banners', label: 'Bannières', icon: 'sparkles' },
                          { href: '/admin-vip', label: 'Administration VIP', icon: 'crown' },
                          { href: '/admin/stats', label: 'Statistiques', icon: 'chart' },
                        ] as { href: string; label: string; icon: IconName }[]).map(link => (
                          <a key={link.href} href={link.href} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-zinc-300 transition hover:bg-red-500/10 hover:text-white focus-visible:outline-2 focus-visible:outline-red-400">
                            <Icon name={link.icon} />{link.label}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="border-t border-white/5 p-1.5">
                    <button
                      onClick={handleLogout}
                      className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-red-400 transition hover:bg-red-500/10"
                    >
                      <Icon name="logout" /> Déconnexion
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {showHero ? (
        <section className="yf-catalogue-hero relative isolate min-h-[760px] overflow-hidden bg-[#0a0a0b] sm:min-h-[830px]">
          {(carouselItems.length > 0 ? carouselItems : [featured]).map((item, index) => {
            const active = carouselItems.length === 0 || index === currentIndex;
            const desktopImage = getHeroImage(item);
            const mobileImage = getMobileHeroImage(item);
            return (
              <picture key={`${item.id ?? 'default'}-${index}`} className={`absolute inset-0 -z-20 transition-opacity duration-1000 motion-reduce:transition-none ${active ? 'opacity-100' : 'opacity-0'}`}>
                {mobileImage && <source media="(max-width: 639px)" srcSet={mobileImage} />}
                {(desktopImage || mobileImage) && <img src={desktopImage || mobileImage} alt="" loading={index === 0 ? 'eager' : 'lazy'} className="h-full w-full object-cover object-[center_20%] sm:object-center" />}
              </picture>
            );
          })}
          <div className="pointer-events-none absolute inset-0 -z-10 bg-black/20" />
          <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-r from-[#0a0a0b]/95 via-[#0a0a0b]/50 to-transparent" />
          <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-t from-[#0a0a0b] via-[#0a0a0b]/20 to-black/30" />
          <div className="mx-auto flex min-h-[760px] max-w-[1600px] flex-col justify-end px-5 pb-12 pt-32 sm:min-h-[830px] sm:px-10 lg:px-16">
            <div className="max-w-3xl">
              <div className="mb-6 flex flex-wrap items-center gap-3">
                <span className="flex items-center gap-2 rounded-full border border-red-400/25 bg-red-500/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-red-200 backdrop-blur-md"><Icon name="sparkles" className="h-3.5 w-3.5" />Sous les projecteurs</span>
                <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-300">La sélection Yamonfim</span>
              </div>
              <h1 className="max-w-3xl break-words text-5xl font-black leading-[0.98] tracking-[-0.04em] text-white drop-shadow-xl sm:text-7xl lg:text-8xl">{featured.title}</h1>
              <div className="mt-6 flex flex-wrap items-center gap-3 text-xs text-zinc-300">
                <span className="font-semibold text-white">{featured.type === 'movie' ? 'Film' : 'Série'}</span>
                {(featured.genres ?? []).slice(0, 3).map(genre => <span key={genre} className="rounded-md border border-white/15 bg-black/15 px-2.5 py-1 backdrop-blur-sm">{genre}</span>)}
                {!!featured.runtime && <span>{featured.runtime} min</span>}
              </div>
              {featured.description && <p className="mt-5 line-clamp-3 max-w-xl text-sm leading-7 text-zinc-300 sm:text-base sm:leading-8">{featured.description}</p>}
              {featured.id !== null && featured.id !== undefined && (
                <div className="mt-8 flex flex-wrap gap-3">
                  <button type="button" onClick={() => handleMediaClick(featured)} className="yf-primary inline-flex cursor-pointer items-center gap-3 rounded-xl bg-red-600 px-7 py-4 text-sm font-bold text-white shadow-lg shadow-red-950/40 transition hover:bg-red-500 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-red-400"><Icon name={userLimitReached ? 'lock' : 'play'} className="h-5 w-5" />{userLimitReached ? 'Découvrir le VIP' : 'Regarder maintenant'}</button>
                  <button type="button" onClick={() => document.getElementById('catalogue-accueil')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })} className="inline-flex cursor-pointer items-center gap-3 rounded-xl border border-white/20 bg-white/5 px-6 py-4 text-sm font-semibold text-white backdrop-blur-md transition hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">Explorer le catalogue<Icon name="chevronRight" className="h-4 w-4" /></button>
                </div>
              )}
            </div>
            {carouselItems.length > 1 && (
              <div className="mt-14 border-t border-white/10 pt-5">
                <div className="mb-4 flex items-center justify-between"><p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-400">À découvrir ce soir</p><span className="text-xs tabular-nums text-zinc-400"><span className="text-white">{String(currentIndex + 1).padStart(2, '0')}</span>{' / '}{String(carouselItems.length).padStart(2, '0')}</span></div>
                <div className="flex gap-3 overflow-x-auto pb-3 [scrollbar-width:thin]">
                  {carouselItems.map((item, index) => {
                    const active = index === currentIndex;
                    const image = getHeroImage(item);
                    return (
                      <button type="button" key={`${item.id}-${index}`} onClick={() => setCurrentIndex(index)} aria-label={`Afficher ${item.title}`} aria-pressed={active} className={`flex w-56 shrink-0 cursor-pointer items-center gap-3 rounded-xl border p-2 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400 ${active ? 'border-red-400/60 bg-red-500/10' : 'border-white/10 bg-white/[0.03] hover:border-white/30 hover:bg-white/[0.07]'}`}>
                        <div className="h-14 w-20 shrink-0 overflow-hidden rounded-lg bg-zinc-800">{image && <img src={image} alt="" loading="lazy" className="h-full w-full object-cover" />}</div>
                        <div className="min-w-0"><p className="truncate text-xs font-semibold text-white">{item.title}</p><p className="mt-1.5 text-[10px] text-zinc-400">{active ? 'À la une' : item.type === 'movie' ? 'Film' : 'Série'}</p></div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </section>
      ) : (
        <div className="h-16" />
      )}

      {showHero && selectedGenre === 'all' && <DiscoveryLinks />}

      {selectedType !== 'all' && (
        <div className="px-4 pt-8 sm:px-10">
          <h1 className="mb-4 text-3xl font-black tracking-tight sm:text-4xl">
            {selectedType === 'movie' ? 'Films' : 'Séries'}
          </h1>
          <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-2 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] sm:-mx-10 sm:px-10 [&::-webkit-scrollbar]:hidden">
            {['all', ...availableGenres].map((genre: string) => {
              const active = selectedGenre === genre;
              return (
                <button
                  key={genre}
                  onClick={() => setSelectedGenre(genre)}
                  className={`shrink-0 cursor-pointer rounded-full px-4 py-2 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600 ${
                    active
                      ? 'bg-white text-black'
                      : 'bg-white/5 text-zinc-400 ring-1 ring-white/10 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {genre === 'all' ? 'Tous les genres' : genre}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div id="catalogue-accueil" className={`relative z-10 scroll-mt-24 space-y-10 px-4 sm:px-10 ${showHero ? 'mt-2 sm:mt-4' : 'mt-6'}`}>
        
        {continueWatchingList.length > 0 && !searchQuery && (
          <Row title="Reprendre la lecture" icon={<Icon name="play" className="h-4 w-4 text-red-600" />}>
            {continueWatchingList.map((item: MediaItem) => (
              <div
                key={item.id}
                {...activateProps(() => handleMediaClick(item))}
                aria-label={`Reprendre ${item.title}`}
                className="group relative aspect-video w-[240px] shrink-0 cursor-pointer overflow-hidden rounded-xl bg-zinc-900 ring-1 ring-white/5 transition duration-300 hover:-translate-y-1 hover:ring-white/20 hover:shadow-2xl hover:shadow-black/60 focus:outline-none focus-visible:-translate-y-1 focus-visible:ring-2 focus-visible:ring-red-600 active:scale-[0.97] sm:w-[300px]"
              >
                {(item.backdrop || item.poster) && (
                  <img
                    src={item.backdrop || item.poster}
                    alt={item.title}
                    loading="lazy"
                    className={`absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105 ${
                      item.backdrop ? 'object-center' : 'object-[center_20%]'
                    }`}
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />

                <button
                  onClick={(e) => handleRemoveFromContinue(e, item.id)}
                  aria-label="Supprimer de l'historique"
                  className="absolute right-2 top-2 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-zinc-300 opacity-0 backdrop-blur-md transition hover:bg-red-600 hover:text-white group-hover:opacity-100"
                >
                  <Icon name="trash" className="h-4 w-4" />
                </button>

                <div className="absolute inset-0 flex items-center justify-center opacity-0 transition duration-300 group-hover:opacity-100">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 text-black shadow-xl">
                    {userLimitReached ? <Icon name="lock" className="h-5 w-5" /> : <Icon name="play" className="h-5 w-5 translate-x-[1px]" />}
                  </span>
                </div>

                <div className="absolute inset-x-0 bottom-0 p-3.5">
                  <span className="mb-0.5 block text-[10px] font-bold uppercase tracking-wider text-red-500">
                    {item.type === 'series' && item.progress
                      ? `Saison ${item.progress.seasonNumber} · Épisode ${item.progress.episodeNumber}`
                      : 'Film'}
                  </span>
                  <h3 className="truncate text-sm font-bold text-white">{item.title}</h3>
                </div>
              </div>
            ))}
          </Row>
        )}

        {isFiltered ? (
          <section>
            <div className="mb-5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2 className="text-lg font-bold tracking-tight sm:text-xl">
                {searchQuery
                  ? <>Résultats pour « <span className="text-red-500">{searchQuery}</span> »</>
                  : selectedGenre !== 'all' ? selectedGenre : 'Tout le catalogue'}
              </h2>
              <span className="text-sm text-zinc-500">
                {filteredMedia.length} titre{filteredMedia.length > 1 ? 's' : ''}
              </span>
            </div>

            {filteredMedia.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-white/10 py-16 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 text-zinc-500">
                  <Icon name="search" className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-semibold text-white">Aucun contenu trouvé</p>
                  <p className="mt-1 text-sm text-zinc-500">Essayez un autre titre ou faites une demande.</p>
                </div>
                <button
                  onClick={() => router.push('/requests')}
                  className="mt-2 cursor-pointer rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/15"
                >
                  Faire une demande
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4 md:grid-cols-5 lg:grid-cols-6 2xl:grid-cols-8">
                {filteredMedia.map((item: MediaItem) => (
                  <PosterCard
                    key={item.id}
                    item={item}
                    locked={userLimitReached}
                    onOpen={() => handleMediaClick(item)}
                  />
                ))}
              </div>
            )}
          </section>
        ) : (
          <>
            <PromoBanner isVip={isVip} isAdmin={isAdmin} />

            {becauseYouWatched && becauseYouWatched.list.length > 0 && (
              <Row
                title={`Parce que vous avez regardé « ${becauseYouWatched.parentTitle} »`}
                icon={<Icon name="sparkles" className="h-5 w-5 text-amber-400" />}
              >
                {becauseYouWatched.list.map((item: MediaItem) => (
                  <PosterCard
                    key={item.id}
                    item={item}
                    locked={userLimitReached}
                    onOpen={() => handleMediaClick(item)}
                    className="w-[130px] sm:w-[170px]"
                  />
                ))}
              </Row>
            )}

            {recommendedForYou.length > 0 && (
              <Row title="Recommandé pour vous" icon={<Icon name="sparkles" className="h-5 w-5 text-red-500" />}>
                {recommendedForYou.map((item: MediaItem) => (
                  <PosterCard
                    key={item.id}
                    item={item}
                    locked={userLimitReached}
                    onOpen={() => handleMediaClick(item)}
                    className="w-[130px] sm:w-[170px]"
                  />
                ))}
              </Row>
            )}

            {recommendedForYou.length > 3 && (
              <Row title="Tendances actuelles" icon={<Icon name="flame" className="h-5 w-5 text-red-500" />}>
                {recommendedForYou.slice().reverse().map((item: MediaItem) => (
                  <PosterCard
                    key={'trend-' + item.id}
                    item={item}
                    locked={userLimitReached}
                    onOpen={() => handleMediaClick(item)}
                    className="w-[130px] sm:w-[170px]"
                  />
                ))}
              </Row>
            )}

            {availableGenres.map((genre: string) => {
              const genreItems = mediaList.filter(m => m.genres && m.genres.includes(genre));
              if (genreItems.length === 0) return null;
              return (
                <Row key={genre} title={`Populaires en ${genre}`} icon={<Icon name="film" className="h-5 w-5 text-zinc-400" />}>
                  {genreItems.map((item: MediaItem) => (
                    <PosterCard
                      key={genre + '-' + item.id}
                      item={item}
                      locked={userLimitReached}
                      onOpen={() => handleMediaClick(item)}
                      className="w-[130px] sm:w-[170px]"
                    />
                  ))}
                </Row>
              );
            })}

            {customBanners.map((banner: any) => {
              const bannerMedia: MediaItem[] = [];
              if (banner.media_ids && Array.isArray(banner.media_ids)) {
                for (const m of mediaList) {
                  let found = false;
                  for (const id of banner.media_ids) {
                    if (String(id) === String(m.id)) {
                      found = true;
                      break;
                    }
                  }
                  if (found) bannerMedia.push(m);
                }
              }
              if (bannerMedia.length === 0) return null;

              return (
                <div
                  key={banner.id}
                  className="relative -mx-4 overflow-hidden px-4 py-6 sm:mx-0 sm:rounded-3xl sm:px-8 sm:py-8 sm:ring-1 sm:ring-white/10"
                >
                  <div className="absolute inset-0">
                    {banner.backdrop && (
                      <img
                        src={banner.backdrop}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover object-center opacity-40 sm:opacity-30"
                      />
                    )}
                    <div className="absolute inset-0 bg-[#0a0a0b]/55 sm:hidden" />
                    <div className="absolute inset-0 hidden bg-gradient-to-r from-[#0a0a0b] via-[#0a0a0b]/85 to-[#0a0a0b]/40 sm:block" />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0b]/80 to-transparent" />
                  </div>
                  <div className="relative">
                    <Row
                      title={banner.title}
                      subtitle={banner.subtitle}
                      icon={<Icon name="flame" className="h-5 w-5 text-red-500" />}
                    >
                      {bannerMedia.map((item: MediaItem) => (
                        <PosterCard
                          key={item.id}
                          item={item}
                          locked={userLimitReached}
                          onOpen={() => handleMediaClick(item)}
                          className="w-[130px] sm:w-[170px]"
                        />
                      ))}
                    </Row>
                  </div>
                </div>
              );
            })}

            <Row title="Films récents" icon={<Icon name="film" className="h-5 w-5 text-zinc-500" />}>
              {recentMovies.length === 0 ? (
                <p className="py-6 text-sm text-zinc-500">Aucun film pour le moment.</p>
              ) : (
                recentMovies.map((item: MediaItem) => (
                  <PosterCard
                    key={item.id}
                    item={item}
                    locked={userLimitReached}
                    onOpen={() => handleMediaClick(item)}
                    className="w-[130px] sm:w-[170px]"
                  />
                ))
              )}
            </Row>

            <Row title="Séries récentes" icon={<Icon name="tv" className="h-5 w-5 text-zinc-500" />}>
              {recentSeries.length === 0 ? (
                <p className="py-6 text-sm text-zinc-500">Aucune série pour le moment.</p>
              ) : (
                recentSeries.map((item: MediaItem) => (
                  <PosterCard
                    key={item.id}
                    item={item}
                    locked={userLimitReached}
                    onOpen={() => handleMediaClick(item)}
                    className="w-[130px] sm:w-[170px]"
                  />
                ))
              )}
            </Row>
          </>
        )}
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-white/5 bg-[#0a0a0b]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
        <div className="flex items-stretch justify-around px-2">
          {([
            { label: 'Accueil', icon: 'home', active: selectedType === 'all' && !searchQuery, onClick: () => selectType('all') },
            { label: 'Films', icon: 'film', active: selectedType === 'movie', onClick: () => selectType('movie') },
            { label: 'Séries', icon: 'tv', active: selectedType === 'series', onClick: () => selectType('series') },
            { label: 'Demandes', icon: 'request', active: false, onClick: () => router.push('/requests') },
            { label: 'Signal', icon: 'alert', active: false, onClick: () => router.push('/report') },
          ] as { label: string; icon: IconName; active: boolean; onClick: () => void }[]).map(tab => (
            <button
              key={tab.label}
              onClick={tab.onClick}
              className={`relative flex flex-1 cursor-pointer flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition ${
                tab.active ? 'text-white' : 'text-zinc-500'
              }`}
            >
              {tab.active && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-red-600" />}
              <Icon name={tab.icon} className={`h-5 w-5 ${tab.active ? 'text-red-500' : ''}`} />
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      <style jsx global>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </main>
  );
}
