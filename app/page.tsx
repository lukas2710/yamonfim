'use client';

import { getPersistentSession } from '@/lib/auth-session';

import React, { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { prepareWatchMedia } from '@/lib/client-media';
import { readClientResource } from '@/lib/resource-cache';
import { supabase } from '@/lib/supabase';
import { fetchSubscriptionProfile } from '@/lib/subscription';
import { fetchCatalogueCards } from '@/lib/client-catalogue';
import { createSearchMatcher } from '@/lib/search';
import { isMostlyWatched } from '@/lib/watch-progress';
import QuotaUnlockModal, { LockedPosterOverlay, QuotaBanner, LockIcon } from '@/components/QuotaUnlockModal';
import PromoBanner from '@/components/PromoBanner';
import HomeCollections from '@/components/HomeCollections';
import TvAppAnnouncement from '@/components/TvAppAnnouncement';
import DailyAdditions from '@/components/DailyAdditions';
import ReviewPrompt from '@/components/ReviewPrompt';
import { MarketingConsentBanner } from '@/components/MarketingConsent';
import { parseBannerEntry, findSeason, type SeasonSummary } from '@/lib/banner-items';
import { parseHeroSetting, pickHeroItems, HERO_SIZE } from '@/lib/home-hero';

interface MediaItem {
  id: any;
  title: string;
  type: 'movie' | 'series';
  poster: string;
  backdrop?: string;
  url?: string;
  description: string;
  genres?: string[];
  seasons?: any[];
  runtime?: number;
  heroSeason?: number;
  heroStart?: number;
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

function cardImage(source: string | null | undefined, width = 'w342') {
  return (source || '').replace(/^(https:\/\/image\.tmdb\.org\/t\/p\/)(?:original|w\d+)\//, `$1${width}/`);
}

function PosterCard({
  item, locked, onOpen, onPrepare, className = '', badge,
}: { item: MediaItem; locked: boolean; onOpen: () => void; onPrepare?: () => void; className?: string; badge?: string }) {
  return (
    <div
      {...activateProps(onOpen)}
      onPointerEnter={onPrepare}
      onFocus={onPrepare}
      aria-label={item.title}
      className={`yf-poster-card group relative aspect-[2/3] shrink-0 cursor-pointer overflow-hidden rounded-xl bg-zinc-900 ring-1 ring-white/5 transition duration-300 hover:-translate-y-1 hover:ring-white/25 hover:shadow-2xl hover:shadow-black/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600 active:scale-[0.97] ${className}`}
    >
      {item.poster ? (
        <img
          src={cardImage(item.poster)}
          alt={item.title}
          loading="lazy"
          decoding="async"
          className={`h-full w-full object-cover transition duration-500 group-hover:scale-105 ${locked ? 'brightness-[.8] saturate-[.85]' : ''}`}
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

      {badge && <span className="absolute left-1.5 top-1.5 z-[3] max-w-[calc(100%-0.75rem)] truncate whitespace-nowrap rounded-md bg-red-600 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-white shadow-lg shadow-black/40 sm:left-2 sm:top-2 sm:px-2 sm:py-1 sm:text-[10px]">{badge}</span>}
      {locked && <LockedPosterOverlay />}
    </div>
  );
}

function Row({
  title, subtitle, icon, children, onSeeAll,
}: { title: string; subtitle?: string; icon?: React.ReactNode; children: React.ReactNode; onSeeAll?: () => void }) {
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
        <div className="flex items-center gap-2">
          {onSeeAll && <button onClick={onSeeAll} className="min-h-10 px-2 text-xs font-semibold text-zinc-300 hover:text-white">Tout voir</button>}
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
  const [hero, setHero] = useState<{ ids: string[]; seasonsById: Record<string, SeasonSummary[]> }>({ ids: [], seasonsById: {} });
  const [loading, setLoading] = useState(true);
  const [catalogueLoading, setCatalogueLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [resultLimit, setResultLimit] = useState(60);
  const [selectedType, setSelectedType] = useState<'all' | 'movie' | 'series'>('all');
  const [selectedGenre, setSelectedGenre] = useState<string>('all');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [activeProfile, setActiveProfile] = useState<any>(null);

  const [isVip, setIsVip] = useState(false);
  const [watchCount, setWatchCount] = useState(0);
  const [showVipModal, setShowVipModal] = useState(false);
  const [quotaPreview, setQuotaPreview] = useState(false);

  const [scrolled, setScrolled] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function checkUserAndFetch() {
      try {
        const { data: { session } } = await getPersistentSession();
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

        let firstPageReady = false, accessReady = false;
        const reveal = () => { if (firstPageReady && accessReady) setLoading(false); };
        const accessTask = fetchSubscriptionProfile(user.id).then(({ data: profile }) => {
          setIsVip(user.email === ADMIN_EMAIL || profile?.is_vip === true);
          setWatchCount(profile?.watch_count || 0);
          accessReady = true; reveal();
        });
        const catalogueTask = fetchCatalogueCards<MediaItem>(supabase, rows => {
          setMediaList(rows); firstPageReady = true; reveal();
        }).finally(() => setCatalogueLoading(false));
        let watchedQuery = supabase.from('user_watched').select('media_id,ep_key,watched_at').eq('user_id', user.id);
        if (currentProfile?.id) watchedQuery = watchedQuery.eq('profile_id', currentProfile.id);
        const watchedTask = watchedQuery.order('watched_at', { ascending: false });
        let progressQuery = supabase.from('watch_history').select('media_id,type,current_time,duration').eq('user_id', user.id);
        if (currentProfile?.id) progressQuery = progressQuery.eq('profile_id', currentProfile.id);
        const progressTask = progressQuery.then(result => result, () => ({ data: null }));
        const bannerTask = readClientResource('home:banners', async () => {
          const { data, error } = await supabase.from('banners').select('*').eq('active', true).order('created_at', { ascending: false });
          if (error) throw error;
          const banners: Record<string, unknown>[] = data || [];
          // Promoted seasons need the series' season posters, not part of the catalogue cards.
          const seriesIds = [...new Set(banners.flatMap(b => Array.isArray(b.media_ids) ? b.media_ids.map(parseBannerEntry).filter(e => e.season !== null).map(e => e.mediaId) : []))];
          if (!seriesIds.length) return banners;
          const { data: seasonRows } = await supabase.from('media').select('id,seasons').in('id', seriesIds);
          const seasonsById = Object.fromEntries((seasonRows || []).map((row: { id: unknown; seasons: SeasonSummary[] }) => [String(row.id), row.seasons]));
          return banners.map(b => ({ ...b, seasonsById }));
        }).then(setCustomBanners).catch(() => { /* Optional banners never block the catalogue. */ });
        // Carousel titles chosen in Admin → Carrousel; without a setting, the latest additions are shown.
        const heroTask = readClientResource('home:hero', async () => {
          const { data } = await supabase.from('site_settings').select('value').eq('key', 'home_hero').maybeSingle();
          const setting = parseHeroSetting(data?.value);
          let ids: string[] = [];
          if (setting.mode === 'custom') ids = setting.media_ids;
          else if (setting.mode === 'top') {
            const { data: top } = await supabase.rpc('top_watched_media', { days: setting.days, max_items: HERO_SIZE });
            ids = ((top ?? []) as { media_id: string }[]).map(row => String(row.media_id));
          }
          // A promoted season needs the series' seasons to open on the right one.
          const seriesIds = [...new Set(ids.map(parseBannerEntry).filter(e => e.season !== null).map(e => e.mediaId))];
          if (!seriesIds.length) return { ids, seasonsById: {} };
          const { data: seasonRows } = await supabase.from('media').select('id,seasons').in('id', seriesIds);
          return { ids, seasonsById: Object.fromEntries((seasonRows || []).map((row: { id: unknown; seasons: SeasonSummary[] }) => [String(row.id), row.seasons])) };
        }).then(setHero).catch(() => { /* The latest additions remain a valid carousel. */ });
        const historyTask = Promise.all([catalogueTask, watchedTask, progressTask]).then(([mediaData, watchedRes, progressRes]) => {
          const byId = new Map(mediaData.map(item => [String(item.id), item]));
          // Un film regardé à 70 % ou plus ne reste pas dans « Reprendre ».
          const finishedMovies = new Set((progressRes.data || [])
            .filter(row => row.type === 'movie' && isMostlyWatched(Number(row.current_time), Number(row.duration)))
            .map(row => String(row.media_id)));
          const resume = new Map<string, MediaItem>();
          for (const watched of watchedRes.data || []) {
            const id = String(watched.media_id), item = byId.get(id);
            if (!item || resume.has(id) || (item.type === 'movie' && finishedMovies.has(id))) continue;
            const match = /^s(\d+)_e(\d+)$/.exec(watched.ep_key || '');
            const seasonIdx = match ? Number(match[1]) : 0, episodeIdx = match ? Number(match[2]) : 0;
            resume.set(id, { ...item, progress: { seasonIdx, episodeIdx, seasonNumber: seasonIdx + 1, episodeNumber: episodeIdx + 1 } });
          }
          setContinueWatchingList([...resume.values()]);
        });
        await Promise.all([accessTask, historyTask, bannerTask, heroTask]);
      } catch (err) {
        setLoadError("Le catalogue n’a pas pu être chargé entièrement. Actualise la page pour réessayer.");
        console.error("Erreur lors du chargement de l'accueil:", err);
      } finally {
        setLoading(false);
        setCatalogueLoading(false);
      }
    }

    checkUserAndFetch();
  }, [router]);

  const preparedRoutes = useRef(new Set<string>());
  const prepareMedia = (item: MediaItem) => {
    const path = `/watch/${item.id}`;
    if (!preparedRoutes.current.has(path)) { preparedRoutes.current.add(path); router.prefetch(path); }
    prepareWatchMedia(String(item.id));
  };
  const handleMediaClick = async (item: MediaItem, startSeason: number | null = null) => {
    if (item.id === undefined || item.id === null) return;
    prepareMedia(item);
    let vip = isVip;
    let count = watchCount;
    if (currentUserId && userEmail !== ADMIN_EMAIL) {
      try {
        const { data: profile } = await fetchSubscriptionProfile(currentUserId);
        if (profile) {
          vip = profile.is_vip === true;
          count = profile.watch_count;
          setIsVip(vip);
          setWatchCount(count);
        }
      } catch { /* Keep the last known status; playback checks the account again. */ }
    }
    if (userEmail !== ADMIN_EMAIL && !vip && count >= MAX_FREE_LIMIT) {
      setShowVipModal(true);
      return;
    }
    if (item.type === 'series' && startSeason !== null) {
      router.push(`/watch/${item.id}?s=${startSeason}&e=0`);
    } else if (item.type === 'series' && item.progress) {
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
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) { setLoadError('La déconnexion n’a pas pu être confirmée. Réessaie.'); return; }
    localStorage.removeItem('active_profile');
    router.replace('/login');
  };

  const selectType = (type: 'all' | 'movie' | 'series') => {
    setResultLimit(60);
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
  const carouselItems = useMemo(() => pickHeroItems(mediaList, hero.ids).map(({ item, season }) => {
    const found = season === null ? null : findSeason(hero.seasonsById[String(item.id)], season);
    return found ? { ...item, heroSeason: season!, heroStart: found.index } : item;
  }), [mediaList, hero]);

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

  const deferredQuery = useDeferredValue(searchQuery);
  const filteredMedia = useMemo(() => {
    const matches = createSearchMatcher(deferredQuery);
    return mediaList.filter(item => (selectedType === 'all' || item.type === selectedType)
      && (selectedGenre === 'all' || item.genres?.includes(selectedGenre))
      && matches(item.title, item.description, ...(item.genres || [])));
  }, [mediaList, selectedType, selectedGenre, deferredQuery]);

  const recentMovies: MediaItem[] = [];
  const recentSeries: MediaItem[] = [];
  for (const item of filteredMedia) {
    if (item.type === 'movie') recentMovies.push(item);
    if (item.type === 'series') recentSeries.push(item);
  }

  const hasText = (v?: string) => !!v && v.trim() !== '';
  const getHeroImage = (m: MediaItem) => cardImage(hasText(m.backdrop) ? m.backdrop! : m.poster, 'w1280');
  const getMobileHeroImage = (m: MediaItem) => cardImage(hasText(m.poster) ? m.poster : m.backdrop || '', 'w500');

  // Admin-only preview of the blocked experience: /?apercu-quota=1
  useEffect(() => {
    if (userEmail !== ADMIN_EMAIL || !new URLSearchParams(window.location.search).has('apercu-quota')) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Enable the preview once the admin session is known.
    setQuotaPreview(true); setShowVipModal(true);
  }, [userEmail]);
  const userLimitReached = (!isVip && watchCount >= MAX_FREE_LIMIT) || quotaPreview;
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

      {showVipModal && <QuotaUnlockModal onClose={() => setShowVipModal(false)} />}
      {!showVipModal && <ReviewPrompt eligible={!!userEmail && (isVip || watchCount >= 2)} />}

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
              YAMON<span className="text-white">FILM</span>
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
                onChange={e => { setResultLimit(60); setSearchQuery(e.target.value); setSelectedType('all'); setSelectedGenre('all'); }}
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
                          { href: '/admin/collections', label: 'Collections', icon: 'film' },
                          { href: '/admin-vip', label: 'Administration VIP', icon: 'crown' },
                          { href: '/admin/stats', label: 'Statistiques', icon: 'chart' },
                        ] as { href: string; label: string; icon: IconName }[]).map(link => (
                          <Link key={link.href} href={link.href} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-zinc-300 transition hover:bg-red-500/10 hover:text-white focus-visible:outline-2 focus-visible:outline-red-400">
                            <Icon name={link.icon} />{link.label}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="border-t border-white/5 p-1.5">
                    <button
                      onClick={handleLogout}
                      className="yf-danger flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-red-400 transition hover:bg-red-500/10"
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
        <section className="yf-catalogue-hero relative isolate min-h-[78svh] overflow-hidden bg-[#0a0a0b] sm:min-h-[830px]">
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
          <div className="pointer-events-none absolute inset-0 -z-10 bg-black/10 sm:bg-black/20" />
          <div className="pointer-events-none absolute inset-0 -z-10 hidden bg-gradient-to-r from-[#0a0a0b]/95 via-[#0a0a0b]/50 to-transparent sm:block" />
          <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-t from-[#0a0a0b] via-[#0a0a0b]/10 to-transparent sm:via-[#0a0a0b]/20 sm:to-black/30" />
          <div className="mx-auto flex min-h-[78svh] max-w-[1600px] flex-col justify-end px-5 pb-6 pt-24 sm:min-h-[830px] sm:px-10 sm:pb-12 sm:pt-32 lg:px-16">
            <div className="max-w-3xl">
              <div className="mb-3 flex flex-wrap items-center gap-3 sm:mb-6">
                <span className="flex items-center gap-2 rounded-full border border-red-400/25 bg-red-500/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-red-200 backdrop-blur-md"><Icon name="sparkles" className="h-3.5 w-3.5" />Sous les projecteurs</span>
                {featured.heroSeason && <span className="rounded-full bg-red-600 px-3 py-1.5 text-[11px] font-black uppercase tracking-wide text-white shadow-lg shadow-red-950/50">Saison {featured.heroSeason} · Nouveau</span>}
                <span className="hidden text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-300 sm:inline">La sélection Yamonfim</span>
              </div>
              <h1 className="max-w-3xl break-words text-[2rem] font-black leading-[1.02] tracking-[-0.03em] text-white drop-shadow-xl line-clamp-2 sm:line-clamp-none sm:text-7xl sm:leading-[0.98] sm:tracking-[-0.04em] lg:text-8xl">{featured.title}</h1>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-zinc-300 sm:mt-6 sm:gap-3">
                <span className="font-semibold text-white">{featured.type === 'movie' ? 'Film' : 'Série'}</span>
                {(featured.genres ?? []).slice(0, 3).map(genre => <span key={genre} className="rounded-md border border-white/15 bg-black/15 px-2.5 py-1 backdrop-blur-sm">{genre}</span>)}
                {!!featured.runtime && <span>{featured.runtime} min</span>}
              </div>
              {featured.description && <p className="mt-3 line-clamp-2 max-w-xl text-[13px] leading-6 text-zinc-300 sm:mt-5 sm:line-clamp-3 sm:text-base sm:leading-8">{featured.description}</p>}
              {featured.id !== null && featured.id !== undefined && (
                <div className="mt-5 flex gap-2.5 sm:mt-8 sm:flex-wrap sm:gap-3">
                  <button type="button" data-yf-play={!userLimitReached || undefined} onClick={() => handleMediaClick(featured, featured.heroStart ?? null)} className="yf-primary inline-flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-sm font-bold sm:flex-none sm:gap-3 sm:px-7 sm:py-4 text-white shadow-lg shadow-red-950/40 transition hover:bg-red-500 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-red-400"><Icon name={userLimitReached ? 'lock' : 'play'} className="h-5 w-5" />{userLimitReached ? 'Découvrir le VIP' : <><span className="sm:hidden">Regarder</span><span className="hidden sm:inline">Regarder maintenant</span></>}</button>
                  <button type="button" onClick={() => document.getElementById('catalogue-accueil')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })} className="inline-flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-sm font-semibold sm:flex-none sm:gap-3 sm:px-6 sm:py-4 text-white backdrop-blur-md transition hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"><span className="sm:hidden">Catalogue</span><span className="hidden sm:inline">Explorer le catalogue</span><Icon name="chevronRight" className="h-4 w-4" /></button>
                </div>
              )}
            </div>
            {carouselItems.length > 1 && (
              <div className="mt-5 flex justify-center gap-1.5 sm:hidden" aria-hidden="true">
                {carouselItems.map((_, index) => <span key={index} className={`h-1.5 rounded-full transition-all ${index === currentIndex ? 'w-5 bg-red-500' : 'w-1.5 bg-white/30'}`} />)}
              </div>
            )}
            {carouselItems.length > 1 && (
              <div className="mt-14 hidden border-t border-white/10 pt-5 sm:block">
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

      {loadError && <p role="alert" className="relative z-10 mx-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{loadError}</p>}
      {catalogueLoading && <p role="status" className="relative z-10 px-4 text-sm text-zinc-400 sm:px-10">Le reste du catalogue se charge… Les résultats se complètent automatiquement.</p>}
      <div id="catalogue-accueil" className={`relative z-10 scroll-mt-24 space-y-10 px-4 sm:px-10 ${showHero ? 'mt-2 sm:mt-4' : 'mt-6'}`}>
        {userLimitReached && <QuotaBanner />}
        {userEmail && !searchQuery && <MarketingConsentBanner />}
        
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
                    {userLimitReached ? <LockIcon className="h-6 w-6 text-amber-500" /> : <Icon name="play" className="h-5 w-5 translate-x-[1px]" />}
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

        {showHero && selectedGenre === 'all' && (
          <div className="-mx-4 sm:-mx-10">
            <HomeCollections catalogue={mediaList} onOpen={item => void handleMediaClick(item)} admin={isAdmin} />
          </div>
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
                  <p className="font-semibold text-white">{catalogueLoading ? 'Recherche dans le reste du catalogue…' : 'Aucun contenu trouvé'}</p>
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
                {filteredMedia.slice(0, resultLimit).map((item: MediaItem) => (
                  <PosterCard
                    key={item.id}
                    item={item}
                    locked={userLimitReached}
                    onOpen={() => handleMediaClick(item)}
                    onPrepare={() => prepareMedia(item)}
                  />
                ))}
              </div>
            )}
            {filteredMedia.length > resultLimit && <button onClick={() => setResultLimit(count => count + 60)} className="mx-auto mt-6 block min-h-11 rounded-full border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold hover:bg-white/10">Afficher plus de résultats ({Math.min(resultLimit, filteredMedia.length)} / {filteredMedia.length})</button>}
          </section>
        ) : (
          <>
            <PromoBanner isVip={isVip} isAdmin={isAdmin} />
            <TvAppAnnouncement />
            <DailyAdditions />

            {customBanners.map((banner: any) => {
              // Admin order is kept; a season entry shows the season poster and opens on it.
              const bannerMedia = (Array.isArray(banner.media_ids) ? banner.media_ids : []).flatMap((value: unknown) => {
                const { mediaId, season } = parseBannerEntry(value);
                const item = mediaList.find(m => String(m.id) === mediaId);
                if (!item) return [];
                const found = season === null ? null : findSeason(banner.seasonsById?.[mediaId], season);
                if (season !== null && found) return [{ key: `${mediaId}:s${season}`, item: { ...item, poster: found.season.poster_path || item.poster }, badge: `Saison ${season} · Nouveau`, start: found.index }];
                return [{ key: mediaId, item, badge: undefined, start: null }];
              }) as { key: string; item: MediaItem; badge?: string; start: number | null }[];
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
                      {bannerMedia.map(({ key, item, badge, start }, rank) => {
                        const card = (
                          <PosterCard
                            key={key}
                            item={item}
                            badge={badge}
                            locked={userLimitReached}
                            onOpen={() => handleMediaClick(item, start)}
                            onPrepare={() => prepareMedia(item)}
                            className="w-[130px] sm:w-[170px]"
                          />
                        );
                        if (!banner.ranked) return card;
                        // Numbered top: a rank as tall as the poster, sitting on its left and slightly under it.
                        const twoDigits = rank + 1 >= 10;
                        return (
                          <div key={key} className={`relative flex shrink-0 items-end ${twoDigits ? 'pl-[118px] sm:pl-[160px]' : 'pl-[78px] sm:pl-[104px]'}`}>
                            <span aria-hidden="true" className="pointer-events-none absolute bottom-0 left-0 z-0 select-none text-[175px] font-black leading-[0.74] tracking-[-0.09em] text-[#0a0a0b] [-webkit-text-stroke:3px_rgba(255,255,255,0.8)] sm:text-[232px] sm:[-webkit-text-stroke:4px_rgba(255,255,255,0.8)]">{rank + 1}</span>
                            <div className="relative z-10">{card}</div>
                          </div>
                        );
                      })}
                    </Row>
                  </div>
                </div>
              );
            })}

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
                    onPrepare={() => prepareMedia(item)}
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
                    onPrepare={() => prepareMedia(item)}
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
                    onPrepare={() => prepareMedia(item)}
                    className="w-[130px] sm:w-[170px]"
                  />
                ))}
              </Row>
            )}

            {availableGenres.map((genre: string) => {
              const genreItems = mediaList.filter(m => m.genres && m.genres.includes(genre));
              if (genreItems.length === 0) return null;
              return (
                <Row key={genre} title={`Populaires en ${genre}`} onSeeAll={() => { setSelectedGenre(genre); setSelectedType('all'); setSearchQuery(''); }} icon={<Icon name="film" className="h-5 w-5 text-zinc-400" />}>
                  {genreItems.slice(0, 20).map((item: MediaItem) => (
                    <PosterCard
                      key={genre + '-' + item.id}
                      item={item}
                      locked={userLimitReached}
                      onOpen={() => handleMediaClick(item)}
                    onPrepare={() => prepareMedia(item)}
                      className="w-[130px] sm:w-[170px]"
                    />
                  ))}
                </Row>
              );
            })}

            <Row title="Films récents" onSeeAll={() => selectType('movie')} icon={<Icon name="film" className="h-5 w-5 text-zinc-500" />}>
              {recentMovies.length === 0 ? (
                <p className="py-6 text-sm text-zinc-500">Aucun film pour le moment.</p>
              ) : (
                recentMovies.slice(0, 20).map((item: MediaItem) => (
                  <PosterCard
                    key={item.id}
                    item={item}
                    locked={userLimitReached}
                    onOpen={() => handleMediaClick(item)}
                    onPrepare={() => prepareMedia(item)}
                    className="w-[130px] sm:w-[170px]"
                  />
                ))
              )}
            </Row>

            <Row title="Séries récentes" onSeeAll={() => selectType('series')} icon={<Icon name="tv" className="h-5 w-5 text-zinc-500" />}>
              {recentSeries.length === 0 ? (
                <p className="py-6 text-sm text-zinc-500">Aucune série pour le moment.</p>
              ) : (
                recentSeries.slice(0, 20).map((item: MediaItem) => (
                  <PosterCard
                    key={item.id}
                    item={item}
                    locked={userLimitReached}
                    onOpen={() => handleMediaClick(item)}
                    onPrepare={() => prepareMedia(item)}
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
