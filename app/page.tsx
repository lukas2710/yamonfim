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
}

export default function Home() {
  const router = useRouter();
  const [mediaList, setMediaList] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<'all' | 'movie' | 'series'>('all');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const ADMIN_EMAIL = 'lukas.leclerc312@gmail.com';

  useEffect(() => {
    async function checkUserAndFetch() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      setUserEmail(session.user.email || null);

      const { data, error } = await supabase
        .from('media')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        setMediaList(data);
      }
      setLoading(false);
    }

    checkUserAndFetch();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

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
    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.description?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesSearch;
  });

  const recentMovies = mediaList.filter(item => item.type === 'movie');
  const recentSeries = mediaList.filter(item => item.type === 'series');

  const heroImage = (featured.backdrop && featured.backdrop.trim() !== '') ? featured.backdrop : featured.poster;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#141414] text-white flex items-center justify-center text-sm">
        Chargement...
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#141414] text-white pb-28 font-sans selection:bg-red-600 selection:text-white">
      {/* 1. Navbar */}
      <header className="flex items-center justify-between px-6 py-4 bg-[#141414]/90 backdrop-blur-md sticky top-0 z-50 border-b border-zinc-800/60">
        <div className="flex items-center gap-6">
          <span className="font-black text-xl tracking-wider text-red-600">
            YAMON<span className="text-white">FIM</span>
          </span>
          <nav className="hidden md:flex items-center gap-4 text-xs font-medium text-zinc-400">
            <button onClick={() => setSelectedType('all')} className={`transition cursor-pointer ${selectedType === 'all' ? 'text-white font-bold' : 'hover:text-white'}`}>Accueil</button>
            <button onClick={() => setSelectedType('movie')} className={`transition cursor-pointer ${selectedType === 'movie' ? 'text-white font-bold' : 'hover:text-white'}`}>Films</button>
            <button onClick={() => setSelectedType('series')} className={`transition cursor-pointer ${selectedType === 'series' ? 'text-white font-bold' : 'hover:text-white'}`}>Séries</button>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Rechercher..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-zinc-900 border border-zinc-800 text-xs text-white px-3 py-2 rounded-lg focus:outline-none focus:border-red-600 w-36 md:w-52 transition"
          />
          
          {/* Le bouton Admin s'affiche uniquement si c'est ton e-mail */}
          {userEmail === ADMIN_EMAIL && (
            <a href="/admin" className="hover:text-red-500 transition text-xs bg-zinc-900 border border-zinc-800 px-3 py-2 rounded-lg">
              Admin
            </a>
          )}

          <button onClick={handleLogout} className="text-xs bg-zinc-900 border border-zinc-800 hover:border-red-600 px-3 py-2 rounded-lg text-zinc-300 transition cursor-pointer">
            Déconnexion
          </button>
        </div>
      </header>

      {/* 2. Hero Banner Carrousel avec Backdrop Supabase */}
      {!searchQuery && selectedType === 'all' && (
        <div className="relative h-[60vh] w-full flex items-end p-6 md:p-12 overflow-hidden bg-zinc-950">
          <div className="absolute inset-0 z-0">
            {heroImage ? (
              <img 
                key={featured.id + '-' + heroImage} 
                src={heroImage} 
                alt={featured.title} 
                className="w-full h-full object-cover object-center opacity-85" 
              />
            ) : (
              <div className="w-full h-full bg-zinc-900" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-[#141414] via-[#141414]/40 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#141414]/90 via-transparent to-transparent" />
          </div>
          
          <div className="w-full max-w-xl z-10 flex flex-col items-start">
            <div className="flex items-center gap-2 text-xs text-zinc-300 mb-2 font-medium">
              <span className="uppercase text-red-500 font-bold tracking-wider bg-red-600/20 px-2.5 py-1 rounded-md border border-red-500/30">
                {featured.type === 'movie' ? 'Film' : 'Série'} • À la une
              </span>
            </div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-2 drop-shadow-lg">{featured.title}</h1>
            <p className="text-xs text-zinc-300 line-clamp-2 mb-6 max-w-lg leading-relaxed">{featured.description}</p>
            
            <div className="flex items-center gap-3">
              <button onClick={() => router.push(`/watch/${featured.id}`)} className="bg-red-600 hover:bg-red-500 text-white font-bold py-2.5 px-6 rounded-lg flex items-center justify-center gap-2 transition shadow-lg shadow-red-600/30 text-sm cursor-pointer">
                ▶ Regarder
              </button>
              <button onClick={() => router.push(`/watch/${featured.id}`)} className="bg-zinc-900/80 backdrop-blur border border-zinc-800 text-zinc-300 font-medium py-2.5 px-5 rounded-lg text-sm transition hover:text-white cursor-pointer">
                Plus d'infos
              </button>
            </div>

            {carouselItems.length > 0 && (
              <div className="flex gap-1.5 mt-8">
                {carouselItems.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentIndex(idx)}
                    className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${currentIndex === idx ? 'w-6 bg-red-600' : 'w-2 bg-zinc-700'}`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. Sections Catalogue */}
      <section className="px-4 md:px-12 mt-8 space-y-10">
        {searchQuery ? (
          <div>
            <h2 className="text-lg font-bold tracking-wide mb-4">Résultats de recherche ({filteredMedia.length})</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4">
              {filteredMedia.map((item) => (
                <div key={item.id} onClick={() => router.push(`/watch/${item.id}`)} className="group relative bg-zinc-900 rounded-lg overflow-hidden border border-zinc-800 shadow-md transition-all duration-300 hover:scale-105 cursor-pointer aspect-[2/3]">
                  {item.poster ? <img src={item.poster} alt={item.title} className="w-full h-full object-cover" /> : <div className="flex items-center justify-center h-full text-xs text-zinc-500">Pas d'affiche</div>}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3.5">
                    <h3 className="font-bold text-sm text-white truncate">{item.title}</h3>
                    <p className="text-[11px] text-zinc-300 line-clamp-2 mt-1">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : selectedType === 'movie' ? (
          <div>
            <h2 className="text-lg font-bold tracking-wide mb-4">Tous les Films</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4">
              {recentMovies.map((item) => (
                <div key={item.id} onClick={() => router.push(`/watch/${item.id}`)} className="group relative bg-zinc-900 rounded-lg overflow-hidden border border-zinc-800 shadow-md transition-all duration-300 hover:scale-105 cursor-pointer aspect-[2/3]">
                  {item.poster ? <img src={item.poster} alt={item.title} className="w-full h-full object-cover" /> : <div className="flex items-center justify-center h-full text-xs text-zinc-500">Pas d'affiche</div>}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3.5">
                    <h3 className="font-bold text-sm text-white truncate">{item.title}</h3>
                    <p className="text-[11px] text-zinc-300 line-clamp-2 mt-1">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : selectedType === 'series' ? (
          <div>
            <h2 className="text-lg font-bold tracking-wide mb-4">Toutes les Séries</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4">
              {recentSeries.map((item) => (
                <div key={item.id} onClick={() => router.push(`/watch/${item.id}`)} className="group relative bg-zinc-900 rounded-lg overflow-hidden border border-zinc-800 shadow-md transition-all duration-300 hover:scale-105 cursor-pointer aspect-[2/3]">
                  {item.poster ? <img src={item.poster} alt={item.title} className="w-full h-full object-cover" /> : <div className="flex items-center justify-center h-full text-xs text-zinc-500">Pas d'affiche</div>}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3.5">
                    <h3 className="font-bold text-sm text-white truncate">{item.title}</h3>
                    <p className="text-[11px] text-zinc-300 line-clamp-2 mt-1">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div>
              <h2 className="text-lg font-bold tracking-wide mb-4">Ajouts récents - Films</h2>
              {recentMovies.length === 0 ? (
                <p className="text-xs text-zinc-500">Aucun film récent.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4">
                  {recentMovies.map((item) => (
                    <div key={item.id} onClick={() => router.push(`/watch/${item.id}`)} className="group relative bg-zinc-900 rounded-lg overflow-hidden border border-zinc-800 shadow-md transition-all duration-300 hover:scale-105 cursor-pointer aspect-[2/3]">
                      {item.poster ? <img src={item.poster} alt={item.title} className="w-full h-full object-cover" /> : <div className="flex items-center justify-center h-full text-xs text-zinc-500">Pas d'affiche</div>}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3.5">
                        <h3 className="font-bold text-sm text-white truncate">{item.title}</h3>
                        <p className="text-[11px] text-zinc-300 line-clamp-2 mt-1">{item.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h2 className="text-lg font-bold tracking-wide mb-4">Ajouts récents - Séries</h2>
              {recentSeries.length === 0 ? (
                <p className="text-xs text-zinc-500">Aucune série récente.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4">
                  {recentSeries.map((item) => (
                    <div key={item.id} onClick={() => router.push(`/watch/${item.id}`)} className="group relative bg-zinc-900 rounded-lg overflow-hidden border border-zinc-800 shadow-md transition-all duration-300 hover:scale-105 cursor-pointer aspect-[2/3]">
                      {item.poster ? <img src={item.poster} alt={item.title} className="w-full h-full object-cover" /> : <div className="flex items-center justify-center h-full text-xs text-zinc-500">Pas d'affiche</div>}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3.5">
                        <h3 className="font-bold text-sm text-white truncate">{item.title}</h3>
                        <p className="text-[11px] text-zinc-300 line-clamp-2 mt-1">{item.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </section>

      {/* 4. Barre de navigation mobile */}
      <nav className="fixed bottom-0 left-0 right-0 bg-[#141414]/95 backdrop-blur-lg border-t border-zinc-800/80 py-3 px-6 flex justify-around text-xs text-zinc-400 z-50">
        <button onClick={() => setSelectedType('all')} className="text-red-600 font-bold flex flex-col items-center gap-1 cursor-pointer">
          <span className="text-base">🎬</span> Catalogue
        </button>
      </nav>
    </main>
  );
}