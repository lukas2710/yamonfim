'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

interface MediaItem {
  id: string;
  title: string;
  type: 'movie' | 'series';
  poster: string;
  backdrop?: string;
  url: string;
  embedUrl?: string;
  description: string;
}

export default function WatchPage() {
  const params = useParams();
  const router = useRouter();
  const { id } = params;

  const [media, setMedia] = useState<MediaItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);

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

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] text-white flex items-center justify-center text-sm font-medium tracking-wide">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
          Chargement...
        </div>
      </div>
    );
  }

  if (!media) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] text-white flex flex-col items-center justify-center gap-4 px-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-zinc-900/80 border border-zinc-800 flex items-center justify-center text-xl text-red-500 shadow-xl">
          ✕
        </div>
        <h2 className="text-lg font-bold">Média introuvable</h2>
        <p className="text-xs text-zinc-400 max-w-xs">Ce contenu n'est plus disponible ou l'identifiant est incorrect.</p>
        <button onClick={() => router.push('/')} className="mt-2 bg-red-600 text-white px-5 py-2.5 rounded-xl text-xs font-bold hover:bg-red-500 transition shadow-lg shadow-red-600/20 cursor-pointer">
          Retour à l'accueil
        </button>
      </div>
    );
  }

  const bgImage = (media.backdrop && media.backdrop.trim() !== '') ? media.backdrop : media.poster;

  return (
    <main className="min-h-screen bg-[#0f0f0f] text-white font-sans pb-24 selection:bg-red-600 selection:text-white relative overflow-x-hidden">
      
      {/* 1. Header Immersif */}
      <header className="flex items-center justify-between px-6 py-4 bg-[#0f0f0f]/80 backdrop-blur-xl sticky top-0 z-50 border-b border-zinc-800/40">
        <div className="flex items-center gap-6">
          <button onClick={() => router.push('/')} className="font-black text-xl tracking-wider text-red-600 cursor-pointer flex items-center gap-1.5">
            YAMON<span className="text-white">FIM</span>
          </button>
          <nav className="hidden md:flex items-center gap-4 text-xs font-medium text-zinc-400">
            <button onClick={() => router.push('/')} className="hover:text-white transition cursor-pointer">Accueil</button>
            <button onClick={() => router.push('/')} className="hover:text-white transition cursor-pointer">Catalogue</button>
          </nav>
        </div>
        <button onClick={() => router.push('/')} className="text-xs bg-zinc-900/80 border border-zinc-800 hover:border-zinc-700 px-3.5 py-2 rounded-xl text-zinc-300 hover:text-white transition cursor-pointer flex items-center gap-1.5 shadow-sm">
          <span>←</span> Retour
        </button>
      </header>

      {/* 2. Mode Lecteur Actif (Cinéma Plein Écran) */}
      {isPlaying && (
        <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-2xl flex flex-col items-center justify-center p-3 sm:p-6 md:p-10 animate-in fade-in duration-200">
          <div className="w-full max-w-6xl flex justify-between items-center mb-4 px-2">
            <div className="flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse" />
              <h2 className="text-sm sm:text-base font-bold text-white tracking-wide truncate max-w-[280px] sm:max-w-md">{media.title}</h2>
            </div>
            <button 
              onClick={() => setIsPlaying(false)}
              className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-2 shadow-lg"
            >
              <span>✕</span> Fermer
            </button>
          </div>
          <div className="w-full max-w-6xl aspect-video bg-black rounded-2xl overflow-hidden border border-zinc-800/80 shadow-2xl flex items-center justify-center relative">
            {media.embedUrl ? (
              media.embedUrl.trim().startsWith('<iframe') ? (
                <div 
                  className="w-full h-full [&>iframe]:w-full [&>iframe]:h-full [&>iframe]:border-0"
                  dangerouslySetInnerHTML={{ __html: media.embedUrl }} 
                />
              ) : (
                <iframe 
                  src={media.embedUrl} 
                  className="w-full h-full border-0" 
                  allow="fullscreen; accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  title={media.title}
                />
              )
            ) : media.url ? (
              <iframe 
                src={media.url} 
                className="w-full h-full border-0" 
                allow="fullscreen; accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title={media.title}
              />
            ) : (
              <div className="text-zinc-500 text-xs sm:text-sm">Aucun flux vidéo disponible.</div>
            )}
          </div>
        </div>
      )}

      {/* 3. Hero Section Améliorée (Style Plateforme Pro) */}
      <div className="relative min-h-[65vh] sm:min-h-[75vh] w-full flex items-end p-6 md:p-16 overflow-hidden">
        {bgImage && (
          <div className="absolute inset-0 z-0">
            <img 
              src={bgImage} 
              alt={media.title} 
              className="w-full h-full object-cover object-center scale-105 blur-[2px] opacity-40 sm:opacity-50 transition-transform duration-1000" 
            />
            {/* Dégradés ultra-prolixes type Netflix */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#0f0f0f] via-[#0f0f0f]/60 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#0f0f0f] via-transparent to-transparent" />
          </div>
        )}

        <div className="w-full max-w-5xl z-10 flex flex-col items-start space-y-4 pt-20">
          <div className="flex items-center gap-2">
            <span className="uppercase text-[10px] sm:text-xs text-red-500 font-bold tracking-widest bg-red-600/10 px-3 py-1 rounded-lg border border-red-500/20 backdrop-blur-md">
              {media.type === 'movie' ? 'Film' : 'Série'}
            </span>
            <span className="text-[10px] sm:text-xs text-zinc-400 font-medium px-2 py-1 bg-zinc-900/60 rounded-lg border border-zinc-800/60 backdrop-blur-md">
              HD 1080p
            </span>
          </div>

          <h1 className="text-3xl sm:text-5xl md:text-7xl font-black tracking-tight drop-shadow-2xl leading-tight max-w-4xl">{media.title}</h1>
          
          <div className="flex flex-wrap items-center gap-3 pt-3">
            <button 
              onClick={() => setIsPlaying(true)}
              className="bg-red-600 hover:bg-red-500 text-white font-bold py-3 px-8 rounded-xl flex items-center gap-2.5 transition-all text-sm shadow-xl shadow-red-600/30 cursor-pointer active:scale-95"
            >
              <span className="text-base">▶</span> Lecture
            </button>
            <button className="bg-zinc-900/80 hover:bg-zinc-800 backdrop-blur-xl border border-zinc-800 text-zinc-300 hover:text-white font-medium py-3 px-5 rounded-xl text-sm transition cursor-pointer">
              + Ma liste
            </button>
            <button className="bg-zinc-900/80 hover:bg-zinc-800 backdrop-blur-xl border border-zinc-800 text-zinc-300 hover:text-white font-medium py-3 px-5 rounded-xl text-sm transition cursor-pointer">
              ✓ Vu
            </button>
          </div>
        </div>
      </div>

      {/* 4. Section Synopsis et Détails Épurée */}
      <div className="px-6 md:px-16 mt-10 max-w-7xl mx-auto space-y-8 relative z-10">
        <div className="flex border-b border-zinc-800/80 gap-8 text-sm font-bold text-zinc-400">
          <button className="text-white border-b-2 border-red-600 pb-3 cursor-pointer">Synopsis & Infos</button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          <div className="lg:col-span-2 bg-zinc-900/40 backdrop-blur-xl border border-zinc-800/60 p-6 sm:p-8 rounded-2xl shadow-xl space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Histoire</h3>
            <p className="text-sm sm:text-base text-zinc-300 leading-relaxed font-normal">
              {media.description || "Aucune description fournie pour ce média."}
            </p>
          </div>

          <div className="bg-zinc-900/40 backdrop-blur-xl border border-zinc-800/60 p-6 rounded-2xl flex flex-col items-center justify-center shadow-xl">
            {media.poster ? (
              <img src={media.poster} alt={media.title} className="w-44 sm:w-52 aspect-[2/3] object-cover rounded-xl shadow-2xl border border-zinc-800" />
            ) : (
              <div className="w-44 sm:w-52 aspect-[2/3] bg-zinc-800/60 rounded-xl flex items-center justify-center text-xs text-zinc-500 border border-zinc-800">
                Pas d'affiche
              </div>
            )}
            <span className="text-[11px] text-zinc-400 font-medium mt-3 text-center">{media.title}</span>
          </div>
        </div>
      </div>
    </main>
  );
}