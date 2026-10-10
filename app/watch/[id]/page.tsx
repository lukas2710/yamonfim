'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

interface Episode {
  number: number;
  title: string;
  embedUrl: string;
  still_path?: string;
  runtime?: number;
}

interface Season {
  seasonNumber: number;
  episodes: Episode[];
  poster_path?: string;
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
  watched?: Record<string, boolean>;
}

export default function WatchPage() {
  const params = useParams();
  const router = useRouter();
  const { id } = params;

  const [media, setMedia] = useState<MediaItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);

  // État de la popup d'avertissement
  const [showAdPopup, setShowAdPopup] = useState(true);

  const [activeTab, setActiveTab] = useState<'episodes' | 'synopsis'>('episodes');
  const [selectedSeasonIdx, setSelectedSeasonIdx] = useState(0);
  const [selectedEpisodeIdx, setSelectedEpisodeIdx] = useState(0);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

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

  const handleAutoNextEpisode = () => {
    if (!media || media.type !== 'series' || !media.seasons) return;
    const currentSeason = media.seasons[selectedSeasonIdx];

    if (selectedEpisodeIdx < currentSeason.episodes.length - 1) {
      const nextEpIdx = selectedEpisodeIdx + 1;
      setSelectedEpisodeIdx(nextEpIdx);
      markAsWatched(`s${selectedSeasonIdx}_e${nextEpIdx}`);
      setShowAdPopup(true);
      setIsPlaying(true);
    } else if (selectedSeasonIdx < media.seasons.length - 1) {
      const nextSeasonIdx = selectedSeasonIdx + 1;
      setSelectedSeasonIdx(nextSeasonIdx);
      setSelectedEpisodeIdx(0);
      markAsWatched(`s${nextSeasonIdx}_e0`);
      setShowAdPopup(true);
      setIsPlaying(true);
    } else {
      setIsPlaying(false);
    }
  };

  useEffect(() => {
    if (isPlaying && !showAdPopup && media?.type === 'series' && media.seasons) {
      const currentEp = media.seasons[selectedSeasonIdx]?.episodes[selectedEpisodeIdx];
      const runtimeMinutes = currentEp?.runtime || 45;
      const totalSecondsToPlay = (runtimeMinutes * 60) - 30;
      const safeDuration = totalSecondsToPlay > 0 ? totalSecondsToPlay : 2670;

      if (timerRef.current) clearInterval(timerRef.current);

      timerRef.current = setInterval(() => {
        handleAutoNextEpisode();
      }, safeDuration * 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, showAdPopup, selectedSeasonIdx, selectedEpisodeIdx, media]);

  const markAsWatched = async (key: string) => {
    if (!media) return;
    const currentWatched = media.watched || {};
    if (currentWatched[key]) return;

    const updatedWatched = { ...currentWatched, [key]: true };
    setMedia({ ...media, watched: updatedWatched });

    await supabase
      .from('media')
      .update({ watched: updatedWatched })
      .eq('id', media.id);
  };

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
  let currentKey = media.type === 'movie' ? 'movie_main' : `s${selectedSeasonIdx}_e${selectedEpisodeIdx}`;

  if (media.type === 'series' && media.seasons && media.seasons.length > 0) {
    const currentSeason = media.seasons[selectedSeasonIdx] || media.seasons[0];
    const currentEpisode = currentSeason?.episodes[selectedEpisodeIdx] || currentSeason?.episodes[0];
    currentEmbedRaw = currentEpisode?.embedUrl || '';
    currentEpisodeTitle = currentEpisode ? `S${currentSeason.seasonNumber} Ép. ${currentEpisode.number} : ${currentEpisode.title}` : '';
  } else {
    currentEmbedRaw = media.embedUrl || media.url || '';
  }

  const finalEmbedUrl = getCleanEmbedUrl(currentEmbedRaw);
  const bgImage = (media.backdrop && media.backdrop.trim() !== '') ? media.backdrop : media.poster;
  const isCurrentWatched = media.watched ? !!media.watched[currentKey] : false;
  const totalEpisodesCount = media.seasons ? media.seasons.reduce((acc, s) => acc + s.episodes.length, 0) : 0;

  return (
    <main className="min-h-screen bg-[#141414] text-white font-sans pb-24 selection:bg-red-600 selection:text-white">
      
      {/* Header Navigation */}
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

      {/* Lecteur Plein Écran */}
      {isPlaying && (
        <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center p-3 sm:p-6">
          
          {/* Popup d'avertissement simple */}
          {showAdPopup ? (
            <div className="w-full max-w-sm bg-[#0f172a] border border-zinc-800/80 rounded-2xl p-6 text-center shadow-2xl relative z-10 animate-in fade-in zoom-in duration-200">
              
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto mb-4 text-xl">
                ⚠️
              </div>

              <h3 className="text-base font-bold text-white mb-2">
                Information importante
              </h3>

              <p className="text-xs text-slate-300 leading-relaxed mb-6">
                Si une page de publicité s'ouvre au moment de lancer la vidéo, <strong className="text-white">refermez-la immédiatement sans cliquer sur quoi que ce soit dessus</strong>.
              </p>

              <button
                onClick={() => setShowAdPopup(false)}
                className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3 px-4 rounded-xl text-xs transition shadow-lg shadow-red-600/30 cursor-pointer"
              >
                J'ai compris
              </button>

            </div>
          ) : (
            /* Lecteur Iframe une fois le bouton cliqué */
            <div className="w-full max-w-5xl flex flex-col h-full justify-center">
              <div className="w-full flex justify-between items-center mb-3 px-2">
                <div>
                  <h2 className="text-xs sm:text-sm font-bold text-white">{media.title}</h2>
                  {currentEpisodeTitle && <p className="text-[10px] text-red-500 font-semibold">{currentEpisodeTitle}</p>}
                </div>

                <div className="flex items-center gap-2">
                  {media.type === 'series' && (
                    <button
                      onClick={handleAutoNextEpisode}
                      className="bg-zinc-800 hover:bg-zinc-700 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border border-zinc-700"
                    >
                      Épisode suivant ⏭
                    </button>
                  )}
                  <button 
                    onClick={() => {
                      setIsPlaying(false);
                      setShowAdPopup(true);
                    }}
                    className="bg-red-600 hover:bg-red-500 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer"
                  >
                    Fermer ✕
                  </button>
                </div>
              </div>

              <div className="w-full aspect-video bg-black rounded-2xl overflow-hidden border border-zinc-800 shadow-2xl flex items-center justify-center relative">
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

        </div>
      )}

      {/* Hero Section */}
      <div className="relative w-full">
        {bgImage && (
          <div className="relative h-[45vh] sm:h-[55vh] w-full overflow-hidden">
            <img src={bgImage} alt={media.title} className="w-full h-full object-cover object-center opacity-60" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#141414] via-[#141414]/30 to-transparent" />
          </div>
        )}

        <div className="px-4 sm:px-6 -mt-20 relative z-10 space-y-3">
          <div className="flex items-center gap-2">
            <span className="inline-block text-[10px] uppercase font-bold text-red-500 bg-red-600/20 px-2.5 py-1 rounded-md border border-red-500/30">
              {media.type === 'movie' ? 'Film' : 'Série'}
            </span>
            {isCurrentWatched && (
              <span className="inline-block text-[10px] uppercase font-bold text-green-400 bg-green-500/20 px-2 py-0.5 rounded border border-green-500/30">
                ✓ Vu
              </span>
            )}
          </div>
          
          <h1 className="text-2xl sm:text-4xl font-black tracking-tight">{media.title}</h1>

          <div className="flex items-center gap-2.5 pt-1">
            <button 
              onClick={() => {
                if (media.type === 'series') {
                  setSelectedSeasonIdx(0);
                  setSelectedEpisodeIdx(0);
                  markAsWatched(`s0_e0`);
                } else {
                  markAsWatched(`movie_main`);
                }
                setShowAdPopup(true);
                setIsPlaying(true);
              }}
              className="bg-red-600 hover:bg-red-500 text-white font-bold py-2.5 px-6 rounded-xl text-xs transition shadow-lg shadow-red-600/20 flex items-center gap-2 cursor-pointer"
            >
              <span>▶</span> {media.type === 'series' ? 'Commencer l\'épisode 1 de Saison 1' : 'Lecture'}
            </button>
          </div>
        </div>
      </div>

      {/* Infos Saisons / Épisodes */}
      {media.type === 'series' && media.seasons && (
        <div className="px-4 sm:px-6 mt-6 grid grid-cols-2 gap-3 max-w-sm">
          <div className="bg-zinc-900/60 border border-zinc-800 p-3 rounded-xl">
            <span className="text-[10px] uppercase tracking-wider text-zinc-400 block font-semibold">Saisons</span>
            <span className="text-lg font-black text-white">{media.seasons.length}</span>
          </div>
          <div className="bg-zinc-900/60 border border-zinc-800 p-3 rounded-xl">
            <span className="text-[10px] uppercase tracking-wider text-zinc-400 block font-semibold">Épisodes</span>
            <span className="text-lg font-black text-white">{totalEpisodesCount}</span>
          </div>
        </div>
      )}

      {/* Onglets */}
      {media.type === 'series' && (
        <div className="px-4 sm:px-6 mt-6 border-b border-zinc-800/80 flex gap-6 text-xs font-bold">
          <button onClick={() => setActiveTab('episodes')} className={`pb-3 transition cursor-pointer ${activeTab === 'episodes' ? 'text-white border-b-2 border-red-600' : 'text-zinc-500'}`}>Épisodes</button>
          <button onClick={() => setActiveTab('synopsis')} className={`pb-3 transition cursor-pointer ${activeTab === 'synopsis' ? 'text-white border-b-2 border-red-600' : 'text-zinc-500'}`}>Synopsis</button>
        </div>
      )}

      <div className="px-4 sm:px-6 mt-6 space-y-4">
        {media.type === 'movie' && (
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Synopsis</h3>
            <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">{media.description}</p>
          </div>
        )}

        {media.type === 'series' && activeTab === 'episodes' && media.seasons && (
          <div className="space-y-6">
            
            {/* Grille des Saisons */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400">Saisons</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {media.seasons.map((season, sIdx) => {
                  const isSelected = selectedSeasonIdx === sIdx;
                  const seasonPoster = season.poster_path || media.poster;

                  return (
                    <div
                      key={sIdx}
                      onClick={() => setSelectedSeasonIdx(sIdx)}
                      className={`group cursor-pointer bg-zinc-900 border rounded-xl overflow-hidden transition relative ${isSelected ? 'border-red-600 ring-2 ring-red-600/30' : 'border-zinc-800 hover:border-zinc-600'}`}
                    >
                      <div className="aspect-[2/3] relative bg-zinc-950 overflow-hidden">
                        <img src={seasonPoster} alt="" className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent" />
                        <div className="absolute bottom-3 left-3 right-3">
                          <h4 className="font-bold text-sm text-white">Saison {season.seasonNumber}</h4>
                          <p className="text-[11px] text-zinc-400">{season.episodes.length} épisodes</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Liste des épisodes */}
            <div className="space-y-3 pt-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400">
                Épisodes — Saison {media.seasons[selectedSeasonIdx]?.seasonNumber || 1}
              </h3>

              <div className="space-y-3">
                {media.seasons[selectedSeasonIdx]?.episodes.map((ep, eIdx) => {
                  const epKey = `s${selectedSeasonIdx}_e${eIdx}`;
                  const isEpWatched = media.watched ? !!media.watched[epKey] : false;
                  const epThumb = ep.still_path || media.seasons?.[selectedSeasonIdx]?.poster_path || media.poster;

                  return (
                    <div
                      key={eIdx}
                      onClick={() => {
                        setSelectedEpisodeIdx(eIdx);
                        setShowAdPopup(true);
                        setIsPlaying(true);
                        markAsWatched(epKey);
                      }}
                      className="group bg-zinc-900/60 border border-zinc-800 hover:border-zinc-700 rounded-xl p-3 flex items-center justify-between gap-4 transition cursor-pointer"
                    >
                      <div className="flex items-center gap-3.5 overflow-hidden">
                        <div className="w-32 aspect-video bg-zinc-800 rounded-lg overflow-hidden shrink-0 relative flex items-center justify-center border border-zinc-700/50">
                          {epThumb ? (
                            <img src={epThumb} alt="" className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
                          ) : null}
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white text-xs">
                            ▶
                          </div>
                        </div>

                        <div className="truncate">
                          <span className="text-[10px] text-red-500 font-bold uppercase tracking-wider block">
                            Épisode {ep.number} {ep.runtime ? `• ${ep.runtime} min` : ''}
                          </span>
                          <h4 className="text-xs font-bold text-white truncate">{ep.title}</h4>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        {isEpWatched && (
                          <span className="text-[10px] bg-green-500/20 text-green-400 border border-green-500/30 px-2 py-0.5 rounded font-bold">
                            VU
                          </span>
                        )}
                        <span className="text-xs text-zinc-500">▶</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        )}

        {media.type === 'series' && activeTab === 'synopsis' && (
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Synopsis</h3>
            <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">{media.description}</p>
          </div>
        )}
      </div>
    </main>
  );
}