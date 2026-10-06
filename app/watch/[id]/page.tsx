'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

interface Media {
  id: string
  title: string
  type: 'movie' | 'series'
  poster: string
  url: string
  description: string
}

export default function WatchPage() {
  const params = useParams()
  const id = params?.id as string

  const [media, setMedia] = useState<Media | null>(null)
  const [loading, setLoading] = useState(true)
  const [isPlaying, setIsPlaying] = useState(false)

  useEffect(() => {
    try {
      const storedData = localStorage.getItem('yamonfim_media')
      if (storedData) {
        const mediaList: Media[] = JSON.parse(storedData)
        const found = mediaList.find((m) => m.id === id || String(m.id) === String(id))
        if (found) {
          setMedia(found)
        }
      }
    } catch (err) {
      console.error('Erreur lecture localStorage :', err)
    } finally {
      setLoading(false)
    }
  }, [id])

  if (loading) {
    return <div className="min-h-screen bg-zinc-950 text-zinc-500 flex items-center justify-center text-sm">Chargement...</div>
  }

  if (!media) {
    return (
      <main className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center p-6 space-y-4">
        <h1 className="text-xl font-bold">Contenu introuvable</h1>
        <Link href="/" className="bg-red-600 text-white px-4 py-2 rounded-xl text-xs font-medium">Retour à l'accueil</Link>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col selection:bg-red-600 selection:text-white">
      {/* NAVBAR */}
      <header className="sticky top-0 z-40 bg-zinc-950/90 backdrop-blur-md border-b border-zinc-900 px-4 sm:px-8 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-6 sm:space-x-8">
          <Link href="/" className="text-lg sm:text-xl font-bold tracking-tighter text-red-600">
            YAMON<span className="text-white">FIM</span>
          </Link>
          <nav className="hidden sm:flex space-x-6 text-sm font-medium">
            <Link href="/" className="text-zinc-400 hover:text-white transition">Accueil</Link>
            <Link href="/" className="text-zinc-400 hover:text-white transition">Catalogue</Link>
          </nav>
        </div>
        <Link href="/" className="bg-zinc-900 border border-zinc-800 text-zinc-300 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium hover:bg-zinc-800 transition">
          ← Retour
        </Link>
      </header>

      {/* HERO BANNER CINÉMATIQUE (Style Naka) */}
      <div className="relative w-full min-h-[50vh] sm:min-h-[60vh] flex items-end bg-zinc-900 overflow-hidden border-b border-zinc-900">
        {/* Image de fond avec effet de flou et dégradé sombre */}
        <div className="absolute inset-0 z-0">
          <img src={media.poster} alt={media.title} className="w-full h-full object-cover filter blur-sm opacity-30 scale-105" />
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/60 to-transparent"></div>
        </div>

        {/* Contenu de la bannière */}
        <div className="relative z-10 max-w-7xl w-full mx-auto px-4 sm:px-8 pb-10 flex flex-col sm:flex-row items-start sm:items-end justify-between gap-6">
          <div className="space-y-4 max-w-2xl">
            <div className="inline-block bg-red-600/20 border border-red-600/40 text-red-500 text-[10px] sm:text-xs font-semibold px-2.5 py-1 rounded-md uppercase tracking-wider">
              {media.type === 'movie' ? 'Film' : 'Série'}
            </div>
            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white">{media.title}</h1>
            
            <p className="text-xs sm:text-sm text-zinc-300 line-clamp-3 leading-relaxed">
              {media.description}
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button 
                onClick={() => setIsPlaying(true)}
                className="bg-red-600 hover:bg-red-500 text-white font-medium text-xs sm:text-sm px-6 py-3 rounded-xl flex items-center space-x-2 transition shadow-lg shadow-red-600/30"
              >
                <span>▶ Lecture</span>
              </button>
              <a 
                href={media.url} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="bg-zinc-900/80 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 font-medium text-xs sm:text-sm px-5 py-3 rounded-xl transition"
              >
                Ouvrir le flux source ↗
              </a>
            </div>
          </div>

          {/* Miniature flottante à droite sur grand écran */}
          <div className="hidden md:block w-48 aspect-[2/3] rounded-xl overflow-hidden shadow-2xl border border-zinc-800 shrink-0">
            <img src={media.poster} alt={media.title} className="w-full h-full object-cover" />
          </div>
        </div>
      </div>

      {/* SECTION LECTEUR VIDÉO SI ACTIF */}
      {isPlaying && (
        <div className="max-w-5xl w-full mx-auto px-4 sm:px-8 py-8">
          <div className="bg-black border border-zinc-800 rounded-2xl overflow-hidden aspect-video relative shadow-2xl">
            <iframe 
              src={media.url} 
              className="w-full h-full border-0 absolute inset-0" 
              allowFullScreen 
              title={media.title}
            ></iframe>
          </div>
        </div>
      )}

      {/* DÉTAILS / SYNOPSIS SOUS LA BANNIÈRE */}
      <div className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-8 py-10 space-y-6">
        <div className="flex space-x-6 border-b border-zinc-900 pb-3 text-sm font-medium">
          <span className="text-red-500 border-b-2 border-red-500 pb-3 -mb-3">Synopsis</span>
        </div>
        <div className="bg-zinc-900/30 border border-zinc-900 p-6 rounded-2xl space-y-3">
          <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">{media.description}</p>
        </div>
      </div>

      {/* FOOTER */}
      <footer className="border-t border-zinc-900 py-6 text-center text-xs text-zinc-500 mt-auto px-4">
        <p>&copy; 2026 YAMONFIM. Plateforme de diffusion privée.</p>
      </footer>
    </main>
  )
}