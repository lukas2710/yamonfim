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
      <div className="min-h-screen bg-[#141414] text-white flex items-center justify-center text-sm">
        Chargement...
      </div>
    );
  }

  if (!media) {
    return (
      <div className="min-h-screen bg-[#141414] text-white flex flex-col items-center justify-center gap-4">
        <p className="text-zinc-400 text-sm">Média introuvable.</p>
        <button onClick={() => router.push('/')} className="bg-red-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-red-500 transition cursor-pointer">
          Retour à l'accueil
        </button>
      </div>
    );
  }

  const bgImage = (media.backdrop && media.backdrop.trim() !== '') ? media.backdrop : media.poster;

  return (
    <main className="min-h-screen bg-[#141414] text-white font-sans pb-24 selection:bg-red-600 selection:text-white relative">
      {/* 1. Navbar */}
      <header className="flex items-center justify-between px-6 py-4 bg-[#141414]/90 backdrop-blur-md sticky top-0 z-50 border-b border-zinc-800/60">
        <div className="flex items-center gap-6">
          <button onClick={() => router.push('/')} className="font-black text-xl tracking-wider text-red-600 cursor-pointer">
            YAMON<span className="text-white">FIM</span>
          </button>
          <nav className="hidden md:flex items-center gap-4 text-xs font-medium text-zinc-400">
            <button onClick={() => router.push('/')} className="hover:text-white transition cursor-pointer">Accueil</button>
            <button onClick={() => router.push('/')} className="hover:text-white transition cursor-pointer">Catalogue</button>
          </nav>
        </div>
        <button onClick={() => router.push('/')} className="text-xs bg-zinc-900 border border-zinc-800 px-3 py-2 rounded-lg hover:text-red-500 transition cursor-pointer">
          ← Retour
        </button>
      </header>

      {/* 2. Mode Lecteur Actif */}
      {isPlaying && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-4 md:p-10">
          <div className="w-full max-w-5xl flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-white">{media.title}</h2>
            <button 
              onClick={() => setIsPlaying(false)}
              className="bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer"
            >
              ✕ Fermer le lecteur
            </button>
          </div>
          <div className="w-full max-w-5xl aspect-video bg-black rounded-2xl overflow-hidden border border-zinc-800 shadow-2xl flex items-center justify-center">
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
              <div className="text-zinc-500 text-sm">Aucun flux vidéo disponible.</div>
            )}
          </div>
        </div>
      )}

      {/* 3. Hero Section avec Image de Fond Nette et Haute Qualité */}
      <div className="relative min-h-[60vh] w-full flex items-end p-6 md:p-12 overflow-hidden">
        {bgImage && (
          <div className="absolute inset-0 z-0">
            <img 
              src={bgImage} 
              alt={media.title} 
              className="w-full h-full object-cover object-center opacity-85" 
            />
            {/* Dégradés subtils uniquement pour fondre l'image et garder la lisibilité */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#141414] via-[#141414]/30 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#141414]/80 via-transparent to-transparent" />
          </div>
        )}

        <div className="w-full max-w-4xl z-10 flex flex-col items-start space-y-4 pt-16">
          <span className="uppercase text-xs text-red-500 font-bold tracking-wider bg-red-600/20 px-2.5 py-1 rounded-md border border-red-500/30 backdrop-blur-sm">
            {media.type === 'movie' ? 'Film' : 'Série'}
          </span>
          <h1 className="text-4xl md:text-6xl font-black tracking-tight drop-shadow-2xl">{media.title}</h1>
          
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button 
              onClick={() => setIsPlaying(true)}
              className="bg-white hover:bg-zinc-200 text-black font-bold py-2.5 px-6 rounded-lg flex items-center gap-2 transition text-sm shadow-xl cursor-pointer"
            >
              ▶ Lecture
            </button>
            <button className="bg-zinc-900/80 hover:bg-zinc-800/80 backdrop-blur border border-zinc-700 text-zinc-200 font-medium py-2.5 px-4 rounded-lg text-sm transition cursor-pointer">
              + Ma liste
            </button>
            <button className="bg-zinc-900/80 hover:bg-zinc-800/80 backdrop-blur border border-zinc-700 text-zinc-200 font-medium py-2.5 px-4 rounded-lg text-sm transition cursor-pointer">
              ✓ Déjà vu
            </button>
          </div>
        </div>
      </div>

      {/* 4. Onglets et Contenu */}
      <div className="px-6 md:px-12 mt-8 max-w-7xl mx-auto space-y-6 relative z-10">
        <div className="flex border-b border-zinc-800 gap-8 text-sm font-semibold text-zinc-400">
          <button className="text-white border-b-2 border-red-600 pb-3 cursor-pointer">Synopsis</button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          <div className="lg:col-span-2 bg-zinc-900/60 backdrop-blur border border-zinc-800/80 p-6 rounded-2xl shadow-lg">
            <p className="text-sm md:text-base text-zinc-300 leading-relaxed">
              {media.description || "Aucune description fournie pour ce média."}
            </p>
          </div>

          <div className="bg-zinc-900/60 backdrop-blur border border-zinc-800/80 p-4 rounded-2xl flex justify-center shadow-lg">
            {media.poster ? (
              <img src={media.poster} alt={media.title} className="w-48 md:w-60 aspect-[2/3] object-cover rounded-xl shadow-xl border border-zinc-800" />
            ) : (
              <div className="w-48 md:w-60 aspect-[2/3] bg-zinc-800 rounded-xl flex items-center justify-center text-xs text-zinc-500">
                Pas d'affiche
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}