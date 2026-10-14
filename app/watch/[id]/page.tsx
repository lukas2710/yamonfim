'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
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
  id: any;
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
  const searchParams = useSearchParams();
  const router = useRouter();
  const { id } = params;

  const [media, setMedia] = useState<MediaItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showAdPopup, setShowAdPopup] = useState(true);
  
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [playerKey, setPlayerKey] = useState(0);

  const [showVipModal, setShowVipModal] = useState(false);
  const MAX_FREE_LIMIT = 5;

  const [selectedSeasonIdx, setSelectedSeasonIdx] = useState(0);
  const [selectedEpisodeIdx, setSelectedEpisodeIdx] = useState(0);
  const [audioLang, setAudioLang] = useState<'VF' | 'VO'>('VF');

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!id) return;

    async function fetchMediaAndHistory() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const user = session?.user;

        const { data: mediaData, error } = await supabase
          .from('media')
          .select('*')
          .eq('id', id)
          .single();

        if (!error && mediaData) {
          setMedia(mediaData);

          const sParam = searchParams.get('s');
          const eParam = searchParams.get('e');

          if (sParam !== null && eParam !== null) {
            setSelectedSeasonIdx(parseInt(sParam, 10));
            setSelectedEpisodeIdx(parseInt(eParam, 10));
          } else if (user) {
            const { data: userHistory } = await supabase
              .from('watch_history')
              .select('*')
              .eq('user_id', user.id)
              .eq('media_id', String(id))
              .maybeSingle();

            if (userHistory) {
              setSelectedSeasonIdx(userHistory.season_idx || 0);
              setSelectedEpisodeIdx(userHistory.episode_idx || 0);
            }
          }
        }
      } catch (err) {
        console.error('Erreur chargement:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchMediaAndHistory();
  }, [id, searchParams]);

  const saveWatchHistory = async (sIdx: number, eIdx: number) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || !media) return;

      const user = session.user;
      const currentSeason = media.seasons?.[sIdx];

      const payload = {
        user_id: user.id,
        media_id: String(media.id),
        type: media.type,
        season_idx: sIdx,
        episode_idx: eIdx,
        season_number: currentSeason?.seasonNumber || 1,
        episode_number: currentSeason?.episodes?.[eIdx]?.number || 1,
        updated_at: new Date().toISOString()
      };

      await supabase
        .from('watch_history')
        .upsert(payload, { onConflict: 'user_id,media_id' });
    } catch (err) {
      console.error('Erreur saveWatchHistory:', err);
    }
  };

  const checkAndIncrementWatch = async (): Promise<boolean> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return false;

    const user = session.user;
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_vip, watch_count')
      .eq('id', user.id)
      .single();

    if (profile) {
      if (!profile.is_vip && (profile.watch_count || 0) >= MAX_FREE_LIMIT) {
        setShowVipModal(true);
        setIsPlaying(false);
        return false;
      }

      if (!profile.is_vip) {
        const newCount = (profile.watch_count || 0) + 1;
        await supabase
          .from('profiles')
          .update({ watch_count: newCount })
          .eq('id', user.id);
      }
    }
    return true;
  };

  const startPlaying = async (sIdx = selectedSeasonIdx, eIdx = selectedEpisodeIdx) => {
    const canPlay = await checkAndIncrementWatch();
    if (!canPlay) return;

    setPlayerKey(prev => prev + 1);
    await saveWatchHistory(sIdx, eIdx);
    setShowAdPopup(true);
    setIsPlaying(true);
  };

  const handleAutoNextEpisode = async () => {
    if (!media || media.type !== 'series' || !media.seasons) return;
    const currentSeason = media.seasons[selectedSeasonIdx];

    const canPlay = await checkAndIncrementWatch();
    if (!canPlay) return;

    if (selectedEpisodeIdx < currentSeason.episodes.length - 1) {
      const nextEpIdx = selectedEpisodeIdx + 1;
      setSelectedEpisodeIdx(nextEpIdx);
      markAsWatched(`s${selectedSeasonIdx}_e${nextEpIdx}`);
      await saveWatchHistory(selectedSeasonIdx, nextEpIdx);
      setPlayerKey(prev => prev + 1);
      setShowAdPopup(true);
      setIsPlaying(true);
    } else if (selectedSeasonIdx < media.seasons.length - 1) {
      const nextSeasonIdx = selectedSeasonIdx + 1;
      setSelectedSeasonIdx(nextSeasonIdx);
      setSelectedEpisodeIdx(0);
      markAsWatched(`s${nextSeasonIdx}_e0`);
      await saveWatchHistory(nextSeasonIdx, 0);
      setPlayerKey(prev => prev + 1);
      setShowAdPopup(true);
      setIsPlaying(true);
    } else {
      setIsPlaying(false);
    }
  };

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
    let clean = rawUrl;
    if (clean.includes('<iframe')) {
      try {
        const doc = new DOMParser().parseFromString(clean, 'text/html');
        const iframe = doc.querySelector('iframe');
        clean = iframe ? iframe.getAttribute('src') || '' : '';
      } catch (e) {
        clean = '';
      }
    }
    if (clean.includes('lang=')) {
      clean = clean.replace(/lang=[a-z]+/i, `lang=${audioLang.toLowerCase()}`);
    } else {
      clean += (clean.includes('?') ? '&' : '?') + `lang=${audioLang.toLowerCase()}`;
    }
    return clean.trim();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#121212] text-white flex items-center justify-center text-xs tracking-wider">
        Chargement...
      </div>
    );
  }

  if (!media) {
    return (
      <div className="min-h-screen bg-[#121212] text-white flex flex-col items-center justify-center gap-3 p-4 text-center">
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
  let currentKey = media.type === 'movie' ? 'movie_main' : `s${selectedSeasonIdx}_e${selectedEpisodeIdx}`;

  const currentSeason = media.seasons?.[selectedSeasonIdx] || media.seasons?.[0];
  const currentEpisode = currentSeason?.episodes?.[selectedEpisodeIdx] || currentSeason?.episodes?.[0];

  if (media.type === 'series' && media.seasons && media.seasons.length > 0) {
    currentEmbedRaw = currentEpisode?.embedUrl || '';
  } else {
    currentEmbedRaw = media.embedUrl || media.url || '';
  }

  const finalEmbedUrl = getCleanEmbedUrl(currentEmbedRaw);
  const bgImage = (media.backdrop && media.backdrop.trim() !== '') ? media.backdrop : media.poster;
  const isCurrentWatched = media.watched ? !!media.watched[currentKey] : false;

  return (
    <main className="min-h-screen bg-[#121212] text-white font-sans pb-24 selection:bg-red-600 selection:text-white">
      
      {showVipModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#18181b] border border-zinc-800 rounded-3xl max-w-md w-full p-6 text-center shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto mb-4 text-xl">👑</div>
            <h3 className="text-lg font-black text-white mb-2">Accès VIP Requis</h3>
            <p className="text-xs text-zinc-400 mb-6">Vous avez atteint votre quota gratuit de {MAX_FREE_LIMIT} visions. Passez au VIP pour un accès illimité.</p>
            <button
              onClick={() => window.location.href = 'https://buy.stripe.com/eVq6oGeqBbBvbYrbWOf3a0m'}
              className="w-full bg-gradient-to-r from-amber-500 to-amber-600 text-zinc-950 font-black py-3 rounded-2xl text-xs mb-3 cursor-pointer"
            >
              Devenir Membre VIP 👑
            </button>
            <button onClick={() => router.push('/')} className="text-xs text-zinc-400 hover:text-white">Retour à l'accueil</button>
          </div>
        </div>
      )}

      <header className="flex items-center justify-between px-6 py-4 bg-[#121212]/90 backdrop-blur-md sticky top-0 z-40 border-b border-zinc-900">
        <button 
          onClick={() => router.push('/')}
          className="flex items-center gap-2 text-xs font-bold text-zinc-300 hover:text-white bg-zinc-900 border border-zinc-800 px-3.5 py-2 rounded-xl transition cursor-pointer"
        >
          <span>←</span> Retour
        </button>
        <span className="font-black text-base tracking-wider text-red-600">
          YAMON<span className="text-white">FIM</span>
        </span>
      </header>

      {/* Lecteur Plein Écran Direct (Sans clic intermédiaire supplémentaire) */}
      {isPlaying && (
        <div className="fixed inset-0 z-50 bg-black/98 backdrop-blur-2xl flex flex-col items-center justify-center p-2 sm:p-6">
          {showAdPopup ? (
            <div className="w-full max-w-sm bg-[#18181b] border border-zinc-800 rounded-3xl p-6 text-center shadow-2xl relative z-10">
              <div className="w-12 h-12 rounded-2xl bg-red-600/10 border border-red-500/30 text-red-500 flex items-center justify-center mx-auto mb-4 text-xl">⚠️</div>
              <h3 className="text-sm font-black text-white mb-2">Déverrouiller la lecture</h3>
              <p className="text-xs text-zinc-400 leading-relaxed mb-6">
                Si une page publicitaire s'ouvre dans un nouvel onglet, <strong className="text-white">fermez-la immédiatement</strong> et revenez ici.
              </p>
              <button
                onClick={() => setShowAdPopup(false)}
                className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3 px-4 rounded-2xl text-xs transition shadow-lg shadow-red-600/30 cursor-pointer"
              >
                Lancer la vidéo
              </button>
            </div>
          ) : (
            <div className="w-full max-w-6xl flex flex-col h-full justify-center space-y-3">
              
              <div className="w-full flex justify-between items-center px-1">
                <div className="flex items-center gap-3">
                  <div className="flex bg-zinc-900 border border-zinc-800 rounded-xl p-1 gap-1">
                    <button 
                      onClick={() => { setAudioLang('VF'); setPlayerKey(prev => prev + 1); }} 
                      className={`px-3 py-1 rounded-lg text-xs font-black transition cursor-pointer ${audioLang === 'VF' ? 'bg-red-600 text-white shadow-md' : 'text-zinc-400 hover:text-white'}`}
                    >
                      VF
                    </button>
                    <button 
                      onClick={() => { setAudioLang('VO'); setPlayerKey(prev => prev + 1); }} 
                      className={`px-3 py-1 rounded-lg text-xs font-black transition cursor-pointer ${audioLang === 'VO' ? 'bg-red-600 text-white shadow-md' : 'text-zinc-400 hover:text-white'}`}
                    >
                      VO
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {media.type === 'series' && (
                    <button
                      onClick={handleAutoNextEpisode}
                      className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer"
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

              {/* Iframe directement active */}
              <div className="w-full aspect-video bg-black rounded-2xl overflow-hidden border border-zinc-800 shadow-2xl relative">
                {finalEmbedUrl ? (
                  <iframe 
                    ref={iframeRef}
                    key={`player-${playerKey}-${audioLang}`}
                    src={finalEmbedUrl} 
                    className="w-full h-full border-0" 
                    allow="fullscreen; accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    title={media.title}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-zinc-500 text-xs">Aucun flux vidéo disponible.</div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="relative w-full">
        {bgImage && (
          <div className="relative h-[45vh] sm:h-[55vh] w-full overflow-hidden">
            <img src={bgImage} alt={media.title} className="w-full h-full object-cover object-center brightness-75" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#121212] via-[#121212]/40 to-transparent" />
          </div>
        )}

        <div className="px-6 sm:px-12 -mt-24 relative z-10 space-y-3 max-w-7xl mx-auto">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-bold text-red-500 bg-red-600/20 px-2.5 py-1 rounded-md border border-red-500/30">
              {media.type === 'movie' ? 'Film' : 'Série'}
            </span>
            {isCurrentWatched && (
              <span className="text-[10px] uppercase font-bold text-emerald-400 bg-emerald-500/20 px-2.5 py-1 rounded-md border border-emerald-500/30">
                ✓ Vu
              </span>
            )}
          </div>
          
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white">{media.title}</h1>
          <p className="text-xs sm:text-sm text-zinc-300 max-w-2xl line-clamp-3 leading-relaxed">{media.description}</p>

          <div className="flex items-center gap-3 pt-3">
            <button 
              onClick={() => {
                if (media.type === 'series') {
                  markAsWatched(`s${selectedSeasonIdx}_e${selectedEpisodeIdx}`);
                  startPlaying(selectedSeasonIdx, selectedEpisodeIdx);
                } else {
                  markAsWatched(`movie_main`);
                  startPlaying();
                }
              }}
              className="bg-red-600 hover:bg-red-500 text-white font-extrabold py-3.5 px-8 rounded-2xl text-xs transition shadow-lg shadow-red-600/30 flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <span className="text-sm">▶</span> 
              <span>{media.type === 'series' ? `Lecture S${currentSeason?.seasonNumber || 1} Ép. ${currentEpisode?.number || 1}` : 'Regarder'}</span>
            </button>
          </div>
        </div>
      </div>

      {media.type === 'series' && media.seasons && (
        <div className="px-6 sm:px-12 mt-10 max-w-7xl mx-auto space-y-6">
          
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Saisons</h3>
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
              {media.seasons.map((season, sIdx) => {
                const isSelected = selectedSeasonIdx === sIdx;
                return (
                  <button
                    key={sIdx}
                    onClick={() => {
                      setSelectedSeasonIdx(sIdx);
                      setSelectedEpisodeIdx(0);
                    }}
                    className={`px-5 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${isSelected ? 'bg-red-600 text-white shadow-lg shadow-red-600/20' : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'}`}
                  >
                    Saison {season.seasonNumber}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-zinc-900/60 border border-zinc-800 rounded-3xl p-4 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              
              <div className="flex items-center gap-4 overflow-hidden">
                <div className="w-36 aspect-video bg-zinc-950 rounded-xl overflow-hidden shrink-0 relative border border-zinc-800 flex items-center justify-center">
                  {currentEpisode?.still_path || currentSeason?.poster_path || media.poster ? (
                    <img src={currentEpisode?.still_path || currentSeason?.poster_path || media.poster} alt="" className="w-full h-full object-cover" />
                  ) : null}
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white text-xs">▶</div>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-red-500 tracking-wider block">
                    En lecture — Saison {currentSeason?.seasonNumber} • Épisode {currentEpisode?.number} {currentEpisode?.runtime ? `(${currentEpisode.runtime} min)` : ''}
                  </span>
                  <h4 className="text-sm font-black text-white">{currentEpisode?.title || `Épisode ${currentEpisode?.number}`}</h4>
                </div>
              </div>

              <div className="w-full sm:w-auto flex items-center gap-2">
                <select
                  value={selectedEpisodeIdx}
                  onChange={(e) => {
                    const idx = parseInt(e.target.value, 10);
                    setSelectedEpisodeIdx(idx);
                    markAsWatched(`s${selectedSeasonIdx}_e${idx}`);
                  }}
                  className="w-full sm:w-64 bg-zinc-950 border border-zinc-800 text-xs text-white p-3 rounded-xl focus:outline-none focus:border-red-600 font-medium cursor-pointer"
                >
                  {currentSeason?.episodes.map((ep, eIdx) => (
                    <option key={eIdx} value={eIdx}>
                      Épisode {ep.number} — {ep.title}
                    </option>
                  ))}
                </select>
              </div>

            </div>

            <div className="flex items-center justify-between pt-2 border-t border-zinc-800/80">
              <button
                onClick={() => {
                  if (selectedEpisodeIdx > 0) {
                    setSelectedEpisodeIdx(selectedEpisodeIdx - 1);
                  }
                }}
                disabled={selectedEpisodeIdx === 0}
                className="text-xs text-zinc-400 hover:text-white disabled:opacity-30 font-bold transition cursor-pointer"
              >
                ← Épisode précédent
              </button>

              <button
                onClick={() => {
                  if (currentSeason && selectedEpisodeIdx < currentSeason.episodes.length - 1) {
                    setSelectedEpisodeIdx(selectedEpisodeIdx + 1);
                  }
                }}
                disabled={!currentSeason || selectedEpisodeIdx >= currentSeason.episodes.length - 1}
                className="text-xs text-zinc-400 hover:text-white disabled:opacity-30 font-bold transition cursor-pointer"
              >
                Épisode suivant →
              </button>
            </div>
          </div>

        </div>
      )}
    </main>
  );
}