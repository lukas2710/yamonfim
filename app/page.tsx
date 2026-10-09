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
    <main className="min-h-screen bg-[#141414] text-white pb-24 sm:pb-12 font-sans selection:bg-red-600 selection:text-white max-w-[100vw] overflow-x-hidden">
      {/* 1. Header App Bar */}
      <header className="flex items-center justify-between px-4 py-3 bg-[#141414]/95 backdrop-blur-md sticky top-0 z-50 border-b border-zinc-800/80">
        <span className="font-black text-lg tracking-wider text-red-600">
          YAMON<span className="text-white">FIM</span>
        </span>

        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Rechercher..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-zinc-900 border border-zinc-800 text-xs text-white px-3 py-1.5 rounded-lg focus:outline-none focus:border-red-600 w-32 sm:w-48 transition"
          />
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

      {/* 2. Hero Banner / Carrousel */}
      {!searchQuery && selectedType === 'all' && (
        <div className="relative h-[38vh] sm:h-[55vh] w-full flex items-end p-4 sm:p-10 overflow-hidden bg-zinc-950">
          <div className="absolute inset-0 z-0">
            {heroImage ? (
              <img 
                key={featured.id + '-' + heroImage} 
                src={heroImage} 
                alt={featured.title} 
                className="w-full h-full object-cover object-center opacity-80" 
              />
            ) : (
              <div className="w-full h-full bg-zinc-900" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-[#141414] via-[#141414]/50 to-transparent" />
          </div>
          
          <div className="w-full max-w-xl z-10 flex flex-col items-start">
            <span className="uppercase text-[10px] text-red-500 font-bold tracking-wider bg-red-600/20 px-2 py-0.5 rounded-md border border-red-500/30 mb-1.5">
              {featured.type === 'movie' ? 'Film' : 'Série'} • À la une
            </span>
            <h1 className="text-xl sm:text-4xl font-black tracking-tight mb-1 drop-shadow-md line-clamp-1">{featured.title}</h1>
            <p className="text-[11px] sm:text-xs text-zinc-300 line-clamp-2 mb-3 max-w-md">{featured.description}</p>
            
            <div className="flex items-center gap-2">
              <button onClick={() => router.push(`/watch/${featured.id}`)} className="bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-1.5 transition text-xs shadow-lg shadow-red-600/30 cursor-pointer">
                ▶ Regarder
              </button>
              <button onClick={() => router.push(`/watch/${featured.id}`)} className="bg-zinc-800/80 backdrop-blur border border-zinc-700 text-zinc-200 font-medium py-2 px-3.5 rounded-lg text-xs transition cursor-pointer">
                Détails
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Contenu du catalogue avec défilement horizontal (style Netflix) */}
      <section className="px-3 sm:px-10 mt-5 space-y-8">
        {searchQuery ? (
          <div>
            <h2 className="text-sm sm:text-base font-bold mb-3">Résultats ({filteredMedia.length})</h2>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 sm:gap-3">
              {filteredMedia.map((item) => (
                <div key={item.id} onClick={() => router.push(`/watch/${item.id}`)} className="bg-zinc-900 rounded-md overflow-hidden border border-zinc-800 aspect-[2/3] active:scale-95 transition cursor-pointer shrink-0">
                  {item.poster ? <img src={item.poster} alt={item.title} className="w-full h-full object-cover" /> : <div className="flex items-center justify-center h-full text-[10px] text-zinc-500 p-1 text-center">Aucune image</div>}
                </div>
              ))}
            </div>
          </div>
        ) : selectedType === 'movie' ? (
          <div>
            <h2 className="text-sm sm:text-base font-bold mb-3">Films</h2>
            <div className="flex gap-3 overflow-x-auto pb-3 pt-1 scrollbar-none [-webkit-overflow-scrolling:touch]">
              {recentMovies.map((item) => (
                <div key={item.id} onClick={() => router.push(`/watch/${item.id}`)} className="bg-zinc-900 rounded-md overflow-hidden border border-zinc-800 w-[110px] sm:w-[150px] aspect-[2/3] active:scale-95 transition cursor-pointer shrink-0 shadow-lg">
                  {item.poster ? <img src={item.poster} alt={item.title} className="w-full h-full object-cover" /> : <div className="flex items-center justify-center h-full text-[10px] text-zinc-500 p-1 text-center">Aucune image</div>}
                </div>
              ))}
            </div>
          </div>
        ) : selectedType === 'series' ? (
          <div>
            <h2 className="text-sm sm:text-base font-bold mb-3">Séries</h2>
            <div className="flex gap-3 overflow-x-auto pb-3 pt-1 scrollbar-none [-webkit-overflow-scrolling:touch]">
              {recentSeries.map((item) => (
                <div key={item.id} onClick={() => router.push(`/watch/${item.id}`)} className="bg-zinc-900 rounded-md overflow-hidden border border-zinc-800 w-[110px] sm:w-[150px] aspect-[2/3] active:scale-95 transition cursor-pointer shrink-0 shadow-lg">
                  {item.poster ? <img src={item.poster} alt={item.title} className="w-full h-full object-cover" /> : <div className="flex items-center justify-center h-full text-[10px] text-zinc-500 p-1 text-center">Aucune image</div>}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div>
              <h2 className="text-sm sm:text-base font-bold mb-3">Films récents</h2>
              {recentMovies.length === 0 ? (
                <p className="text-xs text-zinc-500">Aucun film.</p>
              ) : (
                <div className="flex gap-3 overflow-x-auto pb-3 pt-1 scrollbar-none [-webkit-overflow-scrolling:touch]">
                  {recentMovies.map((item) => (
                    <div key={item.id} onClick={() => router.push(`/watch/${item.id}`)} className="bg-zinc-900 rounded-md overflow-hidden border border-zinc-800 w-[110px] sm:w-[150px] aspect-[2/3] active:scale-95 transition cursor-pointer shrink-0 shadow-lg">
                      {item.poster ? <img src={item.poster} alt={item.title} className="w-full h-full object-cover" /> : <div className="flex items-center justify-center h-full text-[10px] text-zinc-500 p-1 text-center">Aucune image</div>}
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
                    <div key={item.id} onClick={() => router.push(`/watch/${item.id}`)} className="bg-zinc-900 rounded-md overflow-hidden border border-zinc-800 w-[110px] sm:w-[150px] aspect-[2/3] active:scale-95 transition cursor-pointer shrink-0 shadow-lg">
                      {item.poster ? <img src={item.poster} alt={item.title} className="w-full h-full object-cover" /> : <div className="flex items-center justify-center h-full text-[10px] text-zinc-500 p-1 text-center">Aucune image</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </section>

      {/* 4. Barre de navigation application mobile fixe en bas */}
      <nav className="fixed bottom-0 left-0 right-0 bg-[#141414]/95 backdrop-blur-lg border-t border-zinc-800 py-2.5 px-6 flex justify-around items-center z-50 sm:hidden">
        <button 
          onClick={() => { setSelectedType('all'); setSearchQuery(''); }} 
          className={`flex flex-col items-center gap-0.5 text-[10px] transition ${selectedType === 'all' && !searchQuery ? 'text-red-600 font-bold' : 'text-zinc-400'}`}
        >
          <span className="text-lg">🏠</span> Accueil
        </button>
        <button 
          onClick={() => { setSelectedType('movie'); setSearchQuery(''); }} 
          className={`flex flex-col items-center gap-0.5 text-[10px] transition ${selectedType === 'movie' ? 'text-red-600 font-bold' : 'text-zinc-400'}`}
        >
          <span className="text-lg">🎬</span> Films
        </button>
        <button 
          onClick={() => { setSelectedType('series'); setSearchQuery(''); }} 
          className={`flex flex-col items-center gap-0.5 text-[10px] transition ${selectedType === 'series' ? 'text-red-600 font-bold' : 'text-zinc-400'}`}
        >
          <span className="text-lg">📺</span> Séries
        </button>
      </nav>
    </main>
  );
}