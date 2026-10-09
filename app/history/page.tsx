'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

interface Episode {
  number: number;
  title: string;
  embedUrl: string;
}

interface Season {
  seasonNumber: number;
  episodes: Episode[];
}

interface MediaItem {
  id: string;
  title: string;
  type: 'movie' | 'series';
  poster: string;
  seasons?: Season[];
  watched?: Record<string, boolean>;
}

export default function HistoryPage() {
  const router = useRouter();
  const [mediaList, setMediaList] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSeries, setSelectedSeries] = useState<MediaItem | null>(null);
  const [activeSeasonIdx, setActiveSeasonIdx] = useState(0);

  useEffect(() => {
    fetchMedia();
  }, []);

  const fetchMedia = async () => {
    const { data, error } = await supabase
      .from('media')
      .select('*')
      .order('title', { ascending: true });

    if (!error && data) {
      setMediaList(data);
    }
    setLoading(false);
  };

  // Basculer l'état "Vu" directement dans Supabase
  const toggleWatchedStatus = async (mediaId: string, key: string) => {
    const mediaItem = mediaList.find(m => m.id === mediaId);
    if (!mediaItem) return;

    const currentWatched = mediaItem.watched || {};
    const updatedWatched = { ...currentWatched, [key]: !currentWatched[key] };

    // Mise à jour locale pour la fluidité de l'interface
    setMediaList(prev =>
      prev.map(m => (m.id === mediaId ? { ...m, watched: updatedWatched } : m))
    );

    if (selectedSeries && selectedSeries.id === mediaId) {
      setSelectedSeries(prev => prev ? { ...prev, watched: updatedWatched } : null);
    }

    // Sauvegarde dans Supabase
    await supabase
      .from('media')
      .update({ watched: updatedWatched })
      .eq('id', mediaId);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#141414] text-white flex items-center justify-center text-xs">
        Chargement de l'historique...
      </div>
    );
  }

  const movies = mediaList.filter(m => m.type === 'movie');
  const series = mediaList.filter(m => m.type === 'series');

  return (
    <main className="min-h-screen bg-[#141414] text-white font-sans pb-24 selection:bg-red-600 selection:text-white">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-[#141414]/90 backdrop-blur-md sticky top-0 z-50 border-b border-zinc-800/60">
        <span className="font-black text-lg tracking-wider text-red-600">
          YAMON<span className="text-white">FIM</span> <span className="text-xs text-zinc-400 font-normal">/ Historique & Vus</span>
        </span>
        <button 
          onClick={() => router.push('/')}
          className="text-xs bg-zinc-900 border border-zinc-800 px-3.5 py-2 rounded-xl text-zinc-300 hover:text-white transition cursor-pointer"
        >
          ← Retour
        </button>
      </header>

      <div className="max-w-5xl mx-auto px-6 mt-8 space-y-10">
        
        {/* SECTION FILMS */}
        <div className="space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-400 border-b border-zinc-800 pb-2">
            Films ({movies.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {movies.map(movie => {
              const isWatched = movie.watched ? !!movie.watched['movie_main'] : false;

              return (
                <div 
                  key={movie.id}
                  className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-3 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 truncate">
                    <div className="w-10 h-14 bg-zinc-800 rounded overflow-hidden shrink-0">
                      {movie.poster && <img src={movie.poster} alt="" className="w-full h-full object-cover" />}
                    </div>
                    <span className="text-xs font-bold truncate">{movie.title}</span>
                  </div>

                  <button
                    onClick={() => toggleWatchedStatus(movie.id, 'movie_main')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer shrink-0 ${isWatched ? 'bg-green-500/20 text-green-400 border border-green-500/40' : 'bg-zinc-800 text-zinc-400 hover:text-white'}`}
                  >
                    {isWatched ? '✓ Vu' : 'Marquer vu'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* SECTION SÉRIES */}
        <div className="space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-400 border-b border-zinc-800 pb-2">
            Séries ({series.length}) - Cliquez pour gérer les épisodes
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {series.map(s => {
              // Compter le nombre d'épisodes vus
              let watchedCount = 0;
              let totalEpisodes = 0;
              if (s.seasons) {
                s.seasons.forEach((season, sIdx) => {
                  season.episodes.forEach((_, eIdx) => {
                    totalEpisodes++;
                    if (s.watched && s.watched[`s${sIdx}_e${eIdx}`]) {
                      watchedCount++;
                    }
                  });
                });
              }

              return (
                <div 
                  key={s.id}
                  onClick={() => {
                    setSelectedSeries(s);
                    setActiveSeasonIdx(0);
                  }}
                  className="bg-zinc-900/60 border border-zinc-800/80 hover:border-zinc-700 rounded-xl p-3 flex items-center justify-between gap-3 cursor-pointer transition"
                >
                  <div className="flex items-center gap-3 truncate">
                    <div className="w-10 h-14 bg-zinc-800 rounded overflow-hidden shrink-0">
                      {s.poster && <img src={s.poster} alt="" className="w-full h-full object-cover" />}
                    </div>
                    <div className="truncate">
                      <span className="text-xs font-bold block truncate">{s.title}</span>
                      <span className="text-[10px] text-zinc-500">{watchedCount} / {totalEpisodes} vus</span>
                    </div>
                  </div>

                  <span className="text-xs text-red-500 font-bold">Gérer →</span>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* MODALE DE GESTION DES ÉPISODES D'UNE SÉRIE */}
      {selectedSeries && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-5 max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white">{selectedSeries.title}</h3>
                <p className="text-[10px] text-zinc-400">Cochez ou décochez les épisodes vus</p>
              </div>
              <button 
                onClick={() => setSelectedSeries(null)}
                className="bg-zinc-800 hover:bg-zinc-700 text-xs px-3 py-1.5 rounded-xl font-bold cursor-pointer"
              >
                ✕ Fermer
              </button>
            </div>

            {/* Sélecteur de Saisons */}
            {selectedSeries.seasons && selectedSeries.seasons.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {selectedSeries.seasons.map((season, sIdx) => (
                  <button
                    key={sIdx}
                    onClick={() => setActiveSeasonIdx(sIdx)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer shrink-0 ${activeSeasonIdx === sIdx ? 'bg-red-600 text-white' : 'bg-zinc-800 text-zinc-400'}`}
                  >
                    Saison {season.seasonNumber}
                  </button>
                ))}
              </div>
            )}

            {/* Liste des épisodes de la saison active */}
            <div className="space-y-2 overflow-y-auto pr-1 flex-1">
              {selectedSeries.seasons && selectedSeries.seasons[activeSeasonIdx]?.episodes.map((ep, eIdx) => {
                const epKey = `s${activeSeasonIdx}_e${eIdx}`;
                const isWatched = selectedSeries.watched ? !!selectedSeries.watched[epKey] : false;

                return (
                  <div
                    key={eIdx}
                    onClick={() => toggleWatchedStatus(selectedSeries.id, epKey)}
                    className={`p-3 rounded-xl border flex items-center justify-between transition cursor-pointer ${isWatched ? 'bg-green-500/10 border-green-500/40 text-white' : 'bg-zinc-950/60 border-zinc-800 text-zinc-300 hover:border-zinc-700'}`}
                  >
                    <div className="truncate pr-3">
                      <span className="text-[10px] text-red-500 font-bold block">Épisode {ep.number}</span>
                      <h4 className="text-xs font-medium truncate">{ep.title}</h4>
                    </div>

                    <span className={`text-xs px-2.5 py-1 rounded-lg font-bold shrink-0 ${isWatched ? 'bg-green-500/20 text-green-400' : 'bg-zinc-800 text-zinc-500'}`}>
                      {isWatched ? '✓ Vu' : 'À voir'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}