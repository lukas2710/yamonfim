'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

interface MediaItem {
  id: string;
  title: string;
  type: 'movie' | 'series';
  poster: string;
  url: string;
  description: string;
}

export default function WatchPage() {
  const params = useParams();
  const router = useRouter();
  const { id } = params;

  const [media, setMedia] = useState<MediaItem | null>(null);
  const [loading, setLoading] = useState(true);

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
        <button onClick={() => router.push('/')} className="bg-red-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-red-500 transition">
          Retour à l'accueil
        </button>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#141414] text-white p-4 sm:p-8 max-w-4xl mx-auto space-y-6">
      {/* Bouton retour */}
      <button 
        onClick={() => router.push('/')} 
        className="bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 px-4 py-2 rounded-lg text-xs transition flex items-center gap-2 w-fit text-zinc-300 hover:text-white"
      >
        ← Retour au catalogue
      </button>

      {/* Titre et type */}
      <div>
        <span className="text-xs text-red-600 font-bold uppercase tracking-wider">{media.type === 'movie' ? 'Film' : 'Série'}</span>
        <h1 className="text-2xl sm:text-3xl font-black mt-1">{media.title}</h1>
      </div>

      {/* Lecteur / Vidéo */}
      <div className="aspect-video w-full bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden flex items-center justify-center relative shadow-xl">
        {media.url ? (
          <iframe 
            src={media.url} 
            className="w-full h-full border-0" 
            allowFullScreen
            title={media.title}
          />
        ) : (
          <div className="text-zinc-500 text-sm">Aucun lien vidéo disponible.</div>
        )}
      </div>

      {/* Description */}
      <div className="bg-zinc-900/50 border border-zinc-800/80 p-5 rounded-xl space-y-2">
        <h3 className="text-xs uppercase font-semibold text-zinc-400">Synopsis</h3>
        <p className="text-sm text-zinc-300 leading-relaxed">{media.description || "Aucune description fournie."}</p>
      </div>
    </main>
  );
}