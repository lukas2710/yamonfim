'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Hls from 'hls.js';

interface Channel {
  id: string;
  name: string;
  logo: string;
  category: string;
  streamUrl: string;
}

export default function TvPage() {
  const router = useRouter();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Toutes');
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [streamError, setStreamError] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    async function loadChannels() {
      try {
        const res = await fetch('/api/m3u');
        const data = await res.json();
        if (data.success) {
          setChannels(data.channels);
        }
      } catch (err) {
        console.error('Erreur chargement M3U:', err);
      } finally {
        setLoading(false);
      }
    }
    loadChannels();
  }, []);

  useEffect(() => {
    if (!activeChannel || !videoRef.current) return;

    setStreamError(false);
    const video = videoRef.current;
    
    // Si l'URL est un flux YouTube ou Dailymotion externe, on gère l'affichage direct ou via proxy
    const isEmbeddable = activeChannel.streamUrl.includes('youtube.com') || activeChannel.streamUrl.includes('dailymotion.com');
    if (isEmbeddable) return;

    const proxiedUrl = `/api/proxy?url=${encodeURIComponent(activeChannel.streamUrl)}`;
    let hls: Hls | null = null;

    if (Hls.isSupported()) {
      hls = new Hls({ enableWorker: true, lowLatencyMode: true });
      hls.loadSource(proxiedUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => {});
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          setStreamError(true);
          hls?.destroy();
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = proxiedUrl;
      video.addEventListener('loadedmetadata', () => {
        video.play().catch(() => {});
      });
    }

    return () => {
      if (hls) hls.destroy();
    };
  }, [activeChannel]);

  const categories = ['Toutes', ...Array.from(new Set(channels.map(c => c.category).filter(Boolean)))];

  const filteredChannels = channels.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'Toutes' || c.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <main className="min-h-screen bg-[#121212] text-white font-sans pb-24">
      <header className="flex items-center justify-between px-6 py-4 bg-[#121212]/90 backdrop-blur-md sticky top-0 z-40 border-b border-zinc-900">
        <button 
          onClick={() => router.push('/')}
          className="flex items-center gap-2 text-xs font-bold text-zinc-300 hover:text-white bg-zinc-900 border border-zinc-800 px-3.5 py-2 rounded-xl transition cursor-pointer"
        >
          <span>←</span> Retour
        </button>
        <span className="font-black text-base tracking-wider text-red-600">
          YAMON<span className="text-white">TV</span>
        </span>
      </header>

      {activeChannel && (
        <div className="fixed inset-0 z-50 bg-black/98 backdrop-blur-2xl flex flex-col items-center justify-center p-2 sm:p-6">
          <div className="w-full max-w-6xl flex flex-col h-full justify-center space-y-3">
            <div className="w-full flex justify-between items-center px-1">
              <div className="flex items-center gap-3">
                <span className="text-xs font-black text-red-500 bg-red-600/20 px-3 py-1 rounded-lg border border-red-500/30">
                  🔴 DIRECT
                </span>
                <span className="text-sm font-bold text-white">{activeChannel.name}</span>
              </div>

              <button 
                onClick={() => setActiveChannel(null)}
                className="bg-red-600 hover:bg-red-500 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Fermer ✕
              </button>
            </div>

            <div className="w-full aspect-video bg-black rounded-2xl overflow-hidden border border-zinc-800 shadow-2xl relative flex items-center justify-center">
              {streamError ? (
                <div className="text-center p-6 space-y-2">
                  <p className="text-red-500 text-xs font-bold">⚠️ Flux non disponible ou restreint par le diffuseur.</p>
                </div>
              ) : activeChannel.streamUrl.includes('youtube.com') || activeChannel.streamUrl.includes('dailymotion.com') ? (
                <iframe 
                  src={activeChannel.streamUrl.replace('/watch?v=', '/embed/').replace('/video/', '/embed/video/')} 
                  className="w-full h-full border-0" 
                  allow="autoplay; encrypted-media; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <video ref={videoRef} controls autoPlay className="w-full h-full object-contain" />
              )}
            </div>
          </div>
        </div>
      )}

      <div className="px-6 sm:px-12 pt-8 pb-4 max-w-7xl mx-auto space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">TV en Direct ({channels.length})</h1>
            <p className="text-xs sm:text-sm text-zinc-400">Chaînes chargées depuis la liste M3U.</p>
          </div>

          <input 
            type="text"
            placeholder="Rechercher une chaîne..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-zinc-900 border border-zinc-800 text-xs text-white px-4 py-2.5 rounded-xl w-full sm:w-64 focus:outline-none focus:border-red-600 font-medium"
          />
        </div>
      </div>

      <div className="px-6 sm:px-12 max-w-7xl mx-auto">
        {loading ? (
          <div className="text-center py-20 text-zinc-500 text-xs">Chargement des chaînes...</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {filteredChannels.map((channel) => (
              <div
                key={channel.id}
                onClick={() => setActiveChannel(channel)}
                className="bg-zinc-900/60 border border-zinc-800/80 hover:border-red-600/50 rounded-xl p-3 flex flex-col items-center justify-between gap-3 cursor-pointer transition transform hover:-translate-y-1 group"
              >
                <div className="w-full aspect-video flex items-center justify-center p-2 bg-zinc-950 rounded-lg border border-zinc-800/50">
                  {channel.logo ? (
                    <img 
                      src={channel.logo} 
                      alt={channel.name} 
                      className="max-h-10 max-w-full object-contain"
                      onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                    />
                  ) : (
                    <span className="text-xs font-bold text-zinc-600">TV</span>
                  )}
                </div>

                <div className="w-full flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-200 truncate group-hover:text-white">{channel.name}</span>
                  <span className="text-[9px] font-extrabold text-red-500 bg-red-600/10 px-1.5 py-0.5 rounded border border-red-500/20">
                    LIVE
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}