'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
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
  backdrop?: string;
  url: string;
  embedUrl?: string;
  description: string;
  seasons?: Season[];
}

export default function WatchPage() {
  const params = useParams();
  const router = useRouter();
  const { id } = params;

  const [media, setMedia] = useState<MediaItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);

  // Onglet actif par défaut pour les séries
  const [activeTab, setActiveTab] = useState<'episodes' | 'synopsis'>('episodes');

  // Sélection des saisons et épisodes
  const [selectedSeasonIdx, setSelectedSeasonIdx] = useState(0);
  const [selectedEpisodeIdx, setSelectedEpisodeIdx] = useState(0);

  useEffect(() => {
    if (!id) return;

    async function fetchMediaById() {
      const { data, error } = await supabase
        .from('media')
        .select('*')
        .eq('id', id)
        .single();

      if (!error && data) {
        setMedia(data);
      }
      setLoading(false);
    }

    fetchMediaById();
  }, [id]);

  const getCleanEmbedUrl = (rawUrl?: string) => {
    if (!rawUrl) return '';
    if (rawUrl.includes('<iframe')) {
      try {
        const doc = new DOMParser().parseFromString(rawUrl, 'text/html');
        const iframe = doc.querySelector('iframe');
        return iframe ? iframe.getAttribute('src') || '' : '';
      } catch (e) {
        return '';
      }
    }
    return rawUrl.trim();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#141414] text-white flex items-center justify-center text-xs tracking-wider">
        Chargement...
      </div>
    );
  }

  if (!media) {
    return (
      <div className="min-h-screen bg-[#141414] text-white flex flex-col items-center justify-center gap-3 p-4 text-center">
        <p className="text-zinc-400 text-xs font-medium">Média introuvable.</p>
        <button 
          onClick={() => router.push('/')} 
          className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer"
        >
          Retour à l'accueil
        </button>
      </div>
    );
  }

  let currentEmbedRaw = '';
  let currentEpisodeTitle = '';

  if (media.type === 'series' && media.seasons && media.seasons.length > 0) {
    const currentSeason = media.seasons[selectedSeasonIdx] || media.seasons[0];
    const currentEpisode = currentSeason?.episodes[selectedEpisodeIdx] || currentSeason?.episodes[0];
    currentEmbedRaw = currentEpisode?.embedUrl || '';
    currentEpisodeTitle = currentEpisode ? `S${currentSeason.seasonNumber} • Ép. ${currentEpisode.number}` : '';
  } else {
    currentEmbedRaw = media.embedUrl || media.url || '';
  }

  const finalEmbedUrl = getCleanEmbedUrl(currentEmbedRaw);
  const bgImage = (media.backdrop && media.backdrop.trim() !== '') ? media.backdrop : media.poster;

  return (
    <main className="min-h-screen bg-[#141414] text-white font-sans pb-24 selection:bg-red-600 selection:text-white">
      
      {/* 1. Header Navigation Style Pro */}
      <header className="flex items-center justify-between px-4 sm:px-6 py-3.5 bg-[#141414]/90 backdrop-blur-md sticky top-0 z-50 border-b border-zinc-800/60">
        <button 
          onClick={() => router.push('/')}
          className="flex items-center gap-2 text-xs font-semibold text-zinc-300 hover:text-white bg-zinc-900/80 border border-zinc-800 px-3 py-1.5 rounded-xl transition cursor-pointer"
        >
          <span>←</span> Retour
        </button>
        <span className="font-black text-base tracking-wider text-red-600">
          YAMON<span className="text-white">FIM</span>
        </span>
      </header>

      {/* 2. Modale Lecteur Plein Écran */}
      {isPlaying && (
        <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center p-3 sm:p-6">
          <div className="w-full max-w-5xl flex justify-between items-center mb-3 px-2">
            <div>
              <h2 className="text-xs sm:text-sm font-bold text-white">{media.title}</h2>
              {currentEpisodeTitle && <p className="text-[10px] text-red-500 font-semibold">{currentEpisodeTitle}</p>}
            </div>
            <button 
              onClick={() => setIsPlaying(false)}
              className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              Fermer ✕
            </button>
          </div>
          <div className="w-full max-w-5xl aspect-video bg-black rounded-2xl overflow-hidden border border-zinc-800 shadow-2xl flex items-center justify-center">
            {finalEmbedUrl ? (
              <iframe 
                src={finalEmbedUrl} 
                className="w-full h-full border-0" 
                allow="fullscreen; accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title={media.title}
              />
            ) : (
              <div className="text-zinc-500 text-xs">Aucun flux disponible pour ce contenu.</div>
            )}
          </div>
        </div>
      )}

      {/* 3. Hero Section Immersif */}
      <div className="relative w-full">
        {bgImage && (
          <div className="relative h-[45vh] sm:h-[55vh] w-full overflow-hidden">
            <img src={bgImage} alt={media.title} className="w-full h-full object-cover object-center opacity-60" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#141414] via-[#141414]/30 to-transparent" />
          </div>
        )}

        <div className="px-4 sm:px-6 -mt-20 relative z-10 space-y-3">
          <span className="inline-block text-[10px] uppercase font-bold text-red-500 bg-red-600/20 px-2.5 py-1 rounded-md border border-red-500/30">
            {media.type === 'movie' ? 'Film' : 'Série'}
          </span>
          <h1 className="text-2xl sm:text-4xl font-black tracking-tight">{media.title}</h1>

          {/* Boutons d'actions rapides */}
          <div className="flex items-center gap-2.5 pt-1 overflow-x-auto pb-2">
            <button 
              onClick={() => setIsPlaying(true)}
              className="bg-red-600 hover:bg-red-500 text-white font-bold py-2.5 px-6 rounded-xl text-xs transition shadow-lg shadow-red-600/20 flex items-center gap-2 shrink-0 cursor-pointer"
            >
              <span>▶</span> Lecture
            </button>
            <button className="bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white font-medium py-2.5 px-4 rounded-xl text-xs transition shrink-0 cursor-pointer flex items-center gap-1.5">
              <span>+</span> Ma liste
            </button>
            <button className="bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white font-medium py-2.5 px-3 rounded-xl text-xs transition shrink-0 cursor-pointer">
              👍
            </button>
            <button className="bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white font-medium py-2.5 px-3 rounded-xl text-xs transition shrink-0 cursor-pointer">
              🔗
            </button>
          </div>
        </div>
      </div>

      {/* 4. Navigation (Onglets uniquement pour les séries, affichage direct pour les films) */}
      {media.type === 'series' && (
        <div className="px-4 sm:px-6 mt-6 border-b border-zinc-800/80 flex gap-6 text-xs font-bold">
          <button 
            onClick={() => setActiveTab('episodes')}
            className={`pb-3 transition cursor-pointer ${activeTab === 'episodes' ? 'text-white border-b-2 border-red-600' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            Épisodes
          </button>
          <button 
            onClick={() => setActiveTab('synopsis')}
            className={`pb-3 transition cursor-pointer ${activeTab === 'synopsis' ? 'text-white border-b-2 border-red-600' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            Synopsis
          </button>
        </div>
      )}

      {/* 5. Contenu */}
      <div className="px-4 sm:px-6 mt-6 space-y-4">
        
        {/* FILMS : Affichage direct du synopsis */}
        {media.type === 'movie' && (
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Synopsis</h3>
            <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
              {media.description || "Aucune description fournie pour ce film."}
            </p>
          </div>
        )}

        {/* SÉRIES : Onglet Épisodes */}
        {media.type === 'series' && activeTab === 'episodes' && media.seasons && media.seasons.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <select
                value={selectedSeasonIdx}
                onChange={(e) => {
                  setSelectedSeasonIdx(Number(e.target.value));
                  setSelectedEpisodeIdx(0);
                }}
                className="bg-zinc-900 border border-zinc-800 text-white text-xs font-bold rounded-xl px-3 py-2 outline-none cursor-pointer"
              >
                {media.seasons.map((season, sIdx) => (
                  <option key={sIdx} value={sIdx}>
                    Saison {season.seasonNumber} ({season.episodes.length} épisodes)
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-3 pt-2">
              {media.seasons[selectedSeasonIdx]?.episodes.map((ep, eIdx) => (
                <div
                  key={eIdx}
                  onClick={() => {
                    setSelectedEpisodeIdx(eIdx);
                    setIsPlaying(true);
                  }}
                  className={`group bg-zinc-900/60 border rounded-xl p-3 flex items-center justify-between gap-4 transition cursor-pointer ${selectedEpisodeIdx === eIdx ? 'border-red-600 bg-red-600/10' : 'border-zinc-800/80 hover:border-zinc-700'}`}
                >
                  <div className="flex items-center gap-3.5 overflow-hidden">
                    <div className="w-24 aspect-video bg-zinc-800 rounded-lg overflow-hidden shrink-0 relative flex items-center justify-center border border-zinc-700/50">
                      {media.poster ? (
                        <img src={media.poster} alt="" className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition duration-300" />
                      ) : null}
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center text-white text-xs">
                        ▶
                      </div>
                    </div>

                    <div className="truncate">
                      <span className="text-[10px] text-red-500 font-bold uppercase tracking-wider block">
                        E0{ep.number}
                      </span>
                      <h4 className="text-xs font-bold text-white truncate">{ep.title}</h4>
                    </div>
                  </div>

                  <span className="text-xs text-zinc-500 shrink-0">▶</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SÉRIES : Onglet Synopsis */}
        {media.type === 'series' && activeTab === 'synopsis' && (
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Synopsis</h3>
            <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
              {media.description || "Aucune description fournie pour cette série."}
            </p>
          </div>
        )}

      </div>
    </main>
  );
}