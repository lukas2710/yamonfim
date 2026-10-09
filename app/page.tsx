'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface MediaItem {
  id: string;
  title: string;
  type: 'movie' | 'series';
  poster: string;
  url: string;
  description: string;
}

export default function Home() {
  const [mediaList, setMediaList] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchMedia() {
      const { data, error } = await supabase
        .from('media')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        setMediaList(data);
      }
      setLoading(false);
    }

    fetchMedia();
  }, []);

  const featured = mediaList[0] || {
    title: "Bienvenue sur yamonfim",
    type: "movie",
    poster: "",
    description: "Ajoute tes premiers films ou séries depuis ton espace admin.",
    url: "#"
  };

  return (
    <main className="min-h-screen bg-[#141414] text-white pb-24 font-sans">
      {/* 1. Navbar */}
      <header className="flex items-center justify-between px-4 py-3 bg-[#141414]/90 backdrop-blur-md sticky top-0 z-50 border-b border-zinc-800/60">
        <div className="flex items-center gap-2">
          <span className="font-extrabold text-xl tracking-wider text-red-600">
            YAMON<span className="text-white">FIM</span>
          </span>
        </div>
        <div className="flex items-center gap-4 text-sm text-zinc-300">
          <a href="/admin" className="hover:text-red-500 transition text-xs bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-lg">
            Admin
          </a>
        </div>
      </header>

      {/* 2. Hero Banner */}
      <div className="relative h-[55vh] w-full flex items-end p-6 bg-gradient-to-t from-[#141414] via-[#141414]/50 to-transparent">
        <div className="absolute inset-0 -z-10 bg-zinc-900">
          {featured.poster ? (
            <img src={featured.poster} alt={featured.title} className="w-full h-full object-cover opacity-60" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-zinc-800 to-zinc-900" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#141414] via-transparent to-transparent" />
        </div>
        
        <div className="w-full z-10">
          <div className="flex items-center gap-2 text-xs text-zinc-300 mb-2 font-medium">
            <span className="uppercase">{featured.type === 'movie' ? 'Film' : 'Série'}</span>
          </div>
          <h1 className="text-4xl font-black tracking-tight mb-2 drop-shadow-md">{featured.title}</h1>
          <p className="text-xs text-zinc-300 line-clamp-2 mb-4 max-w-lg">{featured.description}</p>
          
          {featured.url && featured.url !== '#' && (
            <div className="flex gap-3">
              <a href={featured.url} target="_blank" rel="noopener noreferrer" className="bg-red-600 text-white font-bold py-2.5 px-6 rounded-lg flex items-center justify-center gap-2 hover:bg-red-500 transition shadow-lg text-sm">
                ▶ Regarder
              </a>
            </div>
          )}
        </div>
      </div>

      {/* 3. Section Catalogue / Ajouts récents */}
      <section className="px-4 mt-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold tracking-wide">Ajouts récents</h2>
          <span className="text-xs text-zinc-400">{mediaList.length} titres</span>
        </div>

        {loading ? (
          <div className="text-zinc-500 text-sm py-8 text-center">Chargement du catalogue...</div>
        ) : mediaList.length === 0 ? (
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-6 text-center">
            <p className="text-zinc-400 text-sm mb-2">Aucun média pour le moment.</p>
            <p className="text-xs text-zinc-500">Ajoute tes premiers contenus depuis l'espace admin.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {mediaList.map((item) => (
              <a 
                key={item.id} 
                href={item.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="group bg-zinc-900 rounded-xl overflow-hidden border border-zinc-800 shadow-lg transition-transform hover:scale-[1.02] cursor-pointer block"
              >
                <div className="aspect-[2/3] w-full bg-zinc-800 relative overflow-hidden">
                  {item.poster ? (
                    <img src={item.poster} alt={item.title} className="object-cover w-full h-full group-hover:scale-105 transition duration-300" />
                  ) : (
                    <div className="flex items-center justify-center h-full text-xs text-zinc-500">Pas d'affiche</div>
                  )}
                  <span className="absolute top-2 right-2 bg-black/70 backdrop-blur text-[10px] px-2 py-0.5 rounded text-white uppercase font-semibold">
                    {item.type === 'movie' ? 'Film' : 'Série'}
                  </span>
                </div>
                <div className="p-3">
                  <h3 className="font-bold text-sm text-white truncate">{item.title}</h3>
                  <p className="text-xs text-zinc-400 line-clamp-1 mt-0.5">{item.description}</p>
                </div>
              </a>
            ))}
          </div>
        )}
      </section>

      {/* 4. Barre de navigation mobile */}
      <nav className="fixed bottom-0 left-0 right-0 bg-[#141414]/95 backdrop-blur-lg border-t border-zinc-800/80 py-3 px-6 flex justify-around text-xs text-zinc-400 z-50">
        <div className="text-red-600 font-bold flex flex-col items-center gap-1 cursor-pointer">
          <span className="text-base">🎬</span> Catalogue
        </div>
        <a href="/admin" className="flex flex-col items-center gap-1 hover:text-white transition cursor-pointer">
          <span className="text-base">⚙️</span> Admin
        </a>
      </nav>
    </main>
  );
}