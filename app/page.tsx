'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

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
  progress?: {
    seasonIdx: number;
    episodeIdx: number;
    seasonNumber: number;
    episodeNumber: number;
  };
}

const DEFAULT_GENRES = [
  'Action', 'Aventure', 'Animation', 'Comédie', 'Crime', 
  'Documentaire', 'Drame', 'Famille', 'Fantastique', 'Horreur', 
  'Mystère', 'Romance', 'Science-Fiction', 'Thriller'
];

export default function Home() {
  const router = useRouter();
  const [mediaList, setMediaList] = useState<MediaItem[]>([]);
  const [continueWatchingList, setContinueWatchingList] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<'all' | 'movie' | 'series'>('all');
  const [selectedGenre, setSelectedGenre] = useState<string>('all');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const [isVip, setIsVip] = useState(false);
  const [watchCount, setWatchCount] = useState(0);
  const [showVipModal, setShowVipModal] = useState(false);

  const ADMIN_EMAIL = 'lukas.leclerc312@gmail.com';
  const MAX_FREE_LIMIT = 5;

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

        const { data: profile } = await supabase
          .from('profiles')
          .select('is_vip, watch_count')
          .eq('id', user.id)
          .single();

        const userIsVip = user.email === ADMIN_EMAIL || (profile ? profile.is_vip : false);
        const userWatchCount = profile ? profile.watch_count : 0;

        setIsVip(userIsVip);
        setWatchCount(userWatchCount);

        const { data: mediaData, error: mediaError } = await supabase
          .from('media')
          .select('*')
          .order('created_at', { ascending: false });

        const { data: historyData } = await supabase
          .from('watch_history')
          .select('*')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false });

        if (!mediaError && mediaData) {
          setMediaList(mediaData);

          if (historyData && historyData.length > 0) {
            const continueList: MediaItem[] = [];
            historyData.forEach((historyItem) => {
              const foundMedia = mediaData.find((m) => String(m.id) === String(historyItem.media_id));
              if (foundMedia) {
                continueList.push({
                  ...foundMedia,
                  progress: {
                    seasonIdx: historyItem.season_idx ?? 0,
                    episodeIdx: historyItem.episode_idx ?? 0,
                    seasonNumber: historyItem.season_number ?? 1,
                    episodeNumber: historyItem.episode_number ?? 1,
                  },
                });
              }
            });
            setContinueWatchingList(continueList);
          }
        }
      } catch (err) {
        console.error('Erreur lors du chargement de l\'accueil:', err);
      } finally {
        setLoading(false);
      }
    }

    checkUserAndFetch();
  }, [router]);

  const handleMediaClick = (item: MediaItem) => {
    if (!isVip && watchCount >= MAX_FREE_LIMIT) {
      setShowVipModal(true);
      return;
    }
    
    if (item.type === 'series' && item.progress) {
      router.push(`/watch/${item.id}?s=${item.progress.seasonIdx}&e=${item.progress.episodeIdx}`);
    } else {
      router.push(`/watch/${item.id}`);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const dbGenres = mediaList
    .filter(item => selectedType !== 'all' && item.type === selectedType)
    .flatMap((item) => item.genres || []);

  const availableGenres = Array.from(
    new Set(dbGenres.length > 0 ? dbGenres : DEFAULT_GENRES)
  ).sort();

  const topMedia = mediaList.slice(0, 5);
  const carouselItems = topMedia.length > 0 ? topMedia : mediaList.slice(0, 5);

  useEffect(() => {
    if (carouselItems.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % carouselItems.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [carouselItems.length]);

  const featured = carouselItems[currentIndex] || {
    title: "Bienvenue sur YAMONFIM",
    type: "movie",
    poster: "",
    backdrop: "",
    description: "Ajoute tes premiers films ou séries depuis ton espace admin.",
    url: "#"
  };

  const filteredMedia = mediaList.filter(item => {
    const matchesType = selectedType === 'all' || item.type === selectedType;
    const matchesGenre = selectedGenre === 'all' || (item.genres && item.genres.includes(selectedGenre));
    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.description?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesGenre && matchesSearch;
  });

  const recentMovies = filteredMedia.filter(item => item.type === 'movie');
  const recentSeries = filteredMedia.filter(item => item.type === 'series');

  const heroImage = (featured.backdrop && featured.backdrop.trim() !== '') ? featured.backdrop : featured.poster;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#141414] text-white flex items-center justify-center text-sm">
        Chargement...
      </div>
    );
  }

  const userLimitReached = !isVip && watchCount >= MAX_FREE_LIMIT;

  return (
    <main className="min-h-screen bg-[#141414] text-white pb-24 sm:pb-12 font-sans selection:bg-red-600 selection:text-white max-w-[100vw] overflow-x-hidden">
      
      {showVipModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl max-w-md w-full p-6 sm:p-8 text-center shadow-2xl relative animate-in fade-in zoom-in duration-200">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto mb-4 text-2xl shadow-lg shadow-amber-500/10">
              🔒
            </div>

            <span className="text-[10px] uppercase font-bold tracking-widest text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
              Accès Limité
            </span>

            <h3 className="text-xl font-black text-white mt-3 mb-2">
              Passez à l'expérience VIP
            </h3>

            <p className="text-xs text-slate-300 leading-relaxed mb-6">
              Vous avez atteint votre quota gratuit de <strong className="text-white">{MAX_FREE_LIMIT} visions</strong> ce mois-ci. Débloquez un accès illimité, sans publicité et en haute définition.
            </p>

            <button
              onClick={() => window.location.href = 'https://buy.stripe.com/eVq6oGeqBbBvbYrbWOf3a0m'}
              className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-extrabold py-3.5 px-4 rounded-xl text-xs transition shadow-xl shadow-amber-500/20 cursor-pointer mb-3"
            >
              Devenir Membre VIP 👑
            </button>

            <button
              onClick={() => setShowVipModal(false)}
              className="text-xs text-slate-400 hover:text-white transition cursor-pointer py-1"
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* Header PC */}
      <header className="flex items-center justify-between px-4 sm:px-10 py-3 bg-[#141414]/95 backdrop-blur-md sticky top-0 z-50 border-b border-zinc-800/80">
        <div className="flex items-center gap-6">
          <span className="font-black text-lg tracking-wider text-red-600 shrink-0">
            YAMON<span className="text-white">FIM</span>
          </span>

          <nav className="hidden sm:flex items-center gap-1 bg-zinc-900/80 border border-zinc-800/80 p-1 rounded-xl">
            <button
              onClick={() => { setSelectedType('all'); setSelectedGenre('all'); setSearchQuery(''); }}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${selectedType === 'all' ? 'bg-red-600 text-white' : 'text-zinc-400 hover:text-white'}`}
            >
              Accueil
            </button>
            <button
              onClick={() => { setSelectedType('movie'); setSelectedGenre('all'); setSearchQuery(''); }}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${selectedType === 'movie' ? 'bg-red-600 text-white' : 'text-zinc-400 hover:text-white'}`}
            >
              Films
            </button>
            <button
              onClick={() => { setSelectedType('series'); setSelectedGenre('all'); setSearchQuery(''); }}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${selectedType === 'series' ? 'bg-red-600 text-white' : 'text-zinc-400 hover:text-white'}`}
            >
              Séries
            </button>
            <button
              onClick={() => router.push('/requests')}
              className="px-3 py-1 rounded-lg text-xs font-bold text-zinc-400 hover:text-white transition cursor-pointer"
            >
              Demandes
            </button>
          </nav>
        </div>

        <div className="flex items-center gap-2">
          {!isVip && (
            <button 
              onClick={() => setShowVipModal(true)}
              className="text-[11px] bg-amber-500/10 border border-amber-500/30 text-amber-400 px-2.5 py-1.5 rounded-lg font-bold hover:bg-amber-500/20 transition cursor-pointer flex items-center gap-1"
            >
              <span>👑</span> VIP ({watchCount}/{MAX_FREE_LIMIT})
            </button>
          )}
          <input
            type="text"
            placeholder="Rechercher..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-zinc-900 border border-zinc-800 text-xs text-white px-3 py-1.5 rounded-lg focus:outline-none focus:border-red-600 w-28 sm:w-48 transition"
          />
          <button onClick={() => router.push('/history')} className="text-xs bg-zinc-900 border border-zinc-800 px-2.5 py-1.5 rounded-lg text-zinc-300 hover:text-white transition cursor-pointer">
            Historique
          </button>
          {userEmail === ADMIN_EMAIL && (
            <a href="/admin" className="text-xs bg-zinc-900 border border-zinc-800 px-2.5 py-1.5 rounded-lg text-zinc-300 hover:text-white">
              Admin
            </a>
          )}
          <button onClick={handleLogout} className="text-xs bg-zinc-900 border border-zinc-800 px-2.5 py-1.5 rounded-lg text-zinc-400 hover:text-white">
            Déco
          </button>
        </div>
      </header>

      {/* Hero Banner */}
      {!searchQuery && selectedType === 'all' && (
        <div className="relative h-[38vh] sm:h-[55vh] w-full flex items-end p-4 sm:p-10 overflow-hidden bg-zinc-950">
          <div className="absolute inset-0 z-0">
            {heroImage ? (
              <img 
                key={featured.id + '-' + heroImage} 
                src={heroImage} 
                alt={featured.title} 
                className="w-full h-full object-cover object-center scale-105 opacity-80" 
              />
            ) : (
              <div className="w-full h-full bg-zinc-900" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-[#141414] via-[#141414]/50 to-transparent" />
          </div>
          
          <div className="w-full max-w-xl z-10 flex flex-col items-start">
            <span className="uppercase text-[10px] text-red-500 font-bold tracking-wider bg-red-600/20 px-2 py-0.5 rounded-md border border-red-500/30 mb-1.5">
              {featured.type === 'movie' ? 'Film' : 'Série'} À la une
            </span>
            <h1 className="text-xl sm:text-4xl font-black tracking-tight mb-1 drop-shadow-md line-clamp-1">{featured.title}</h1>
            <p className="text-[11px] sm:text-xs text-zinc-300 line-clamp-2 mb-3 max-w-md">{featured.description}</p>
            
            <div className="flex items-center gap-2">
              <button onClick={() => handleMediaClick(featured)} className="bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-1.5 transition text-xs shadow-lg shadow-red-600/30 cursor-pointer">
                ▶ Regarder
              </button>
              <button onClick={() => handleMediaClick(featured)} className="bg-zinc-800/80 backdrop-blur border border-zinc-700 text-zinc-200 font-medium py-2 px-3.5 rounded-lg text-xs transition cursor-pointer">
                Détails
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Barre des genres */}
      {selectedType !== 'all' && (
        <div className="px-3 sm:px-10 mt-6">
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none [-webkit-overflow-scrolling:touch]">
            <button
              onClick={() => setSelectedGenre('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 cursor-pointer ${
                selectedGenre === 'all'
                  ? 'bg-red-600 text-white'
                  : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white'
              }`}
            >
              Tous les genres
            </button>
            {availableGenres.map((genre) => (
              <button
                key={genre}
                onClick={() => setSelectedGenre(genre)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 cursor-pointer ${
                  selectedGenre === genre
                    ? 'bg-red-600 text-white'
                    : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                {genre}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Catalogue */}
      <section className="px-3 sm:px-10 mt-4 space-y-8">
        {searchQuery || selectedGenre !== 'all' || selectedType !== 'all' ? (
          <div>
            <h2 className="text-sm sm:text-base font-bold mb-3">
              {selectedType === 'movie' ? 'Films' : selectedType === 'series' ? 'Séries' : 'Résultats'}{' '}
              {selectedGenre !== 'all' ? `• ${selectedGenre}` : ''} ({filteredMedia.length})
            </h2>
            {filteredMedia.length === 0 ? (
              <p className="text-xs text-zinc-500 py-4">Aucun contenu trouvé.</p>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 sm:gap-3">
                {filteredMedia.map((item) => (
                  <div key={item.id} onClick={() => handleMediaClick(item)} className="bg-zinc-900 rounded-md overflow-hidden border border-zinc-800 aspect-[2/3] active:scale-95 transition cursor-pointer shrink-0 relative group">
                    {item.poster ? <img src={item.poster} alt={item.title} className={`w-full h-full object-cover transition ${userLimitReached ? 'blur-[2px] opacity-40' : ''}`} /> : <div className="flex items-center justify-center h-full text-[10px] text-zinc-500 p-1 text-center">Aucune image</div>}
                    {userLimitReached && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-[1px]">
                        <span className="text-xl mb-1">🔒</span>
                        <span className="text-[9px] font-bold uppercase tracking-wider text-amber-400 bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/30">VIP Requis</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            {continueWatchingList.length > 0 && (
              <div>
                <h2 className="text-sm sm:text-base font-bold mb-3 flex items-center gap-2 text-white">
                  <span className="text-red-600">▶</span> Reprendre la lecture
                </h2>
                <div className="flex gap-3 overflow-x-auto pb-3 pt-1 scrollbar-none [-webkit-overflow-scrolling:touch]">
                  {continueWatchingList.map((item) => (
                    <div 
                      key={item.id} 
                      onClick={() => handleMediaClick(item)} 
                      className="bg-zinc-900 rounded-xl overflow-hidden border border-zinc-800 w-[160px] sm:w-[220px] aspect-[16/9] active:scale-95 transition cursor-pointer shrink-0 shadow-xl relative group flex flex-col justify-end"
                    >
                      {item.backdrop || item.poster ? (
                        <img src={item.backdrop || item.poster} alt={item.title} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition duration-300" />
                      ) : null}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
                      
                      <div className="relative p-3 z-10">
                        {item.type === 'series' && item.progress && (
                          <span className="text-[9px] uppercase tracking-wider font-bold text-red-500 block">
                            S{item.progress.seasonNumber} Ép. {item.progress.episodeNumber}
                          </span>
                        )}
                        {item.type === 'movie' && (
                          <span className="text-[9px] uppercase tracking-wider font-bold text-red-500 block">
                            Film
                          </span>
                        )}
                        <h4 className="text-xs font-black text-white truncate">{item.title}</h4>
                        <div className="mt-2 flex items-center gap-1.5 text-[10px] text-zinc-300 bg-white/10 backdrop-blur px-2 py-1 rounded-lg w-fit">
                          <span>▶</span> Reprendre
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h2 className="text-sm sm:text-base font-bold mb-3">Films récents</h2>
              {recentMovies.length === 0 ? (
                <p className="text-xs text-zinc-500">Aucun film.</p>
              ) : (
                <div className="flex gap-3 overflow-x-auto pb-3 pt-1 scrollbar-none [-webkit-overflow-scrolling:touch]">
                  {recentMovies.map((item) => (
                    <div key={item.id} onClick={() => handleMediaClick(item)} className="bg-zinc-900 rounded-md overflow-hidden border border-zinc-800 w-[110px] sm:w-[150px] aspect-[2/3] active:scale-95 transition cursor-pointer shrink-0 shadow-lg relative group">
                      {item.poster ? <img src={item.poster} alt={item.title} className={`w-full h-full object-cover transition ${userLimitReached ? 'blur-[2px] opacity-40' : ''}`} /> : <div className="flex items-center justify-center h-full text-[10px] text-zinc-500 p-1 text-center">Aucune image</div>}
                      {userLimitReached && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-[1px]">
                          <span className="text-xl mb-1">🔒</span>
                          <span className="text-[9px] font-bold uppercase tracking-wider text-amber-400 bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/30">VIP Requis</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h2 className="text-sm sm:text-base font-bold mb-3">Séries récentes</h2>
              {recentSeries.length === 0 ? (
                <p className="text-xs text-zinc-500">Aucune série.</p>
              ) : (
                <div className="flex gap-3 overflow-x-auto pb-3 pt-1 scrollbar-none [-webkit-overflow-scrolling:touch]">
                  {recentSeries.map((item) => (
                    <div key={item.id} onClick={() => handleMediaClick(item)} className="bg-zinc-900 rounded-md overflow-hidden border border-zinc-800 w-[110px] sm:w-[150px] aspect-[2/3] active:scale-95 transition cursor-pointer shrink-0 shadow-lg relative group">
                      {item.poster ? <img src={item.poster} alt={item.title} className={`w-full h-full object-cover transition ${userLimitReached ? 'blur-[2px] opacity-40' : ''}`} /> : <div className="flex items-center justify-center h-full text-[10px] text-zinc-500 p-1 text-center">Aucune image</div>}
                      {userLimitReached && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-[1px]">
                          <span className="text-xl mb-1">🔒</span>
                          <span className="text-[9px] font-bold uppercase tracking-wider text-amber-400 bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/30">VIP Requis</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </section>

      {/* Navigation Mobile */}
      <nav className="fixed bottom-0 left-0 right-0 bg-[#141414]/95 backdrop-blur-lg border-t border-zinc-800 py-2.5 px-4 flex justify-around items-center z-50 sm:hidden">
        <button 
          onClick={() => { setSelectedType('all'); setSelectedGenre('all'); setSearchQuery(''); }} 
          className={`flex flex-col items-center gap-0.5 text-[10px] transition cursor-pointer ${selectedType === 'all' && !searchQuery ? 'text-red-600 font-bold' : 'text-zinc-400'}`}
        >
          <span className="text-lg">🏠</span> Accueil
        </button>
        <button 
          onClick={() => { setSelectedType('movie'); setSelectedGenre('all'); setSearchQuery(''); }} 
          className={`flex flex-col items-center gap-0.5 text-[10px] transition cursor-pointer ${selectedType === 'movie' ? 'text-red-600 font-bold' : 'text-zinc-400'}`}
        >
          <span className="text-lg">🎬</span> Films
        </button>
        <button 
          onClick={() => { setSelectedType('series'); setSelectedGenre('all'); setSearchQuery(''); }} 
          className={`flex flex-col items-center gap-0.5 text-[10px] transition cursor-pointer ${selectedType === 'series' ? 'text-red-600 font-bold' : 'text-zinc-400'}`}
        >
          <span className="text-lg">📺</span> Séries
        </button>
        <button 
          onClick={() => router.push('/requests')} 
          className="flex flex-col items-center gap-0.5 text-[10px] text-zinc-400 hover:text-white transition cursor-pointer"
        >
          <span className="text-lg">📝</span> Demandes
        </button>
        <button 
          onClick={() => router.push('/history')} 
          className="flex flex-col items-center gap-0.5 text-[10px] text-zinc-400 hover:text-white transition cursor-pointer"
        >
          <span className="text-lg">✓</span> Historique
        </button>
      </nav>
    </main>
  );
}