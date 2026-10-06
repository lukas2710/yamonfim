'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

interface Media {
  id: string
  title: string
  type: 'movie' | 'series'
  poster: string
  url: string
  description: string
}

export default function Home() {
  const [mediaList, setMediaList] = useState<Media[]>([])
  const [filteredList, setFilteredList] = useState<Media[]>([])
  const [filter, setFilter] = useState<'all' | 'movie' | 'series'>('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchMedia() {
      try {
        const { data, error } = await supabase
          .from('media')
          .select('*')
          .order('created_at', { ascending: false })

        if (error) throw error

        if (data) {
          setMediaList(data)
          setFilteredList(data)
        }
      } catch (err) {
        console.error('Erreur chargement Supabase :', err)
      } finally {
        setLoading(false)
      }
    }

    fetchMedia()
  }, [])

  function handleFilter(type: 'all' | 'movie' | 'series') {
    setFilter(type)
    if (type === 'all') {
      setFilteredList(mediaList)
    } else {
      setFilteredList(mediaList.filter(m => m.type === type))
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col selection:bg-red-600 selection:text-white">
      {/* HEADER NAVBAR */}
      <header className="sticky top-0 z-40 bg-zinc-950/90 backdrop-blur-md border-b border-zinc-900 px-4 sm:px-8 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-6 sm:space-x-8">
          <Link href="/" className="text-lg sm:text-xl font-bold tracking-tighter text-red-600">
            YAMON<span className="text-white">FIM</span>
          </Link>
          <nav className="hidden sm:flex space-x-6 text-sm font-medium">
            <button onClick={() => handleFilter('all')} className={`transition ${filter === 'all' ? 'text-white font-semibold' : 'text-zinc-400 hover:text-white'}`}>Catalogue</button>
            <button onClick={() => handleFilter('movie')} className={`transition ${filter === 'movie' ? 'text-white font-semibold' : 'text-zinc-400 hover:text-white'}`}>Films</button>
            <button onClick={() => handleFilter('series')} className={`transition ${filter === 'series' ? 'text-white font-semibold' : 'text-zinc-400 hover:text-white'}`}>Séries</button>
          </nav>
        </div>
        <div>
          <a href="/admin" className="bg-zinc-900 border border-zinc-800 text-zinc-300 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium hover:bg-zinc-800 transition">
            Admin
          </a>
        </div>
      </header>

      {/* CONTENU PRINCIPAL : CATALOGUE */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-8 py-6 sm:py-8 space-y-8">
        
        {/* FILTRES MOBILE */}
        <div className="flex sm:hidden space-x-2 text-xs overflow-x-auto pb-2">
          <button onClick={() => handleFilter('all')} className={`px-4 py-2 rounded-lg border ${filter === 'all' ? 'bg-red-600 border-red-600 text-white' : 'bg-zinc-900 border-zinc-800 text-zinc-300'}`}>Tous</button>
          <button onClick={() => handleFilter('movie')} className={`px-4 py-2 rounded-lg border ${filter === 'movie' ? 'bg-red-600 border-red-600 text-white' : 'bg-zinc-900 border-zinc-800 text-zinc-300'}`}>Films</button>
          <button onClick={() => handleFilter('series')} className={`px-4 py-2 rounded-lg border ${filter === 'series' ? 'bg-red-600 border-red-600 text-white' : 'bg-zinc-900 border-zinc-800 text-zinc-300'}`}>Séries</button>
        </div>

        {/* GRILLE DU CATALOGUE */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Catalogue des programmes</h2>
          </div>

          {loading ? (
            <div className="text-center py-24 text-zinc-500 text-sm">Chargement du catalogue...</div>
          ) : filteredList.length === 0 ? (
            <div className="text-center py-24 text-zinc-500 text-sm">Aucun programme trouvé. Ajoute-en via l'espace admin.</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
              {filteredList.map((m) => (
                <Link 
                  key={m.id} 
                  href={`/watch/${m.id}`} 
                  className="group cursor-pointer space-y-2 block"
                >
                  <div className="aspect-[2/3] rounded-xl overflow-hidden bg-zinc-900 border border-zinc-900 relative shadow-md">
                    <img src={m.poster} alt={m.title} className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                      <div className="w-12 h-12 rounded-full bg-red-600 text-white flex items-center justify-center shadow-lg transform scale-90 group-hover:scale-100 transition">
                        <span className="text-xs font-bold uppercase">Voir</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-medium text-xs sm:text-sm truncate group-hover:text-red-500 transition">{m.title}</h4>
                    <span className="text-[10px] sm:text-xs text-zinc-500 uppercase">{m.type === 'movie' ? 'Film' : 'Série'}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* FOOTER */}
      <footer className="border-t border-zinc-900 py-6 text-center text-xs text-zinc-500 mt-auto px-4">
        <p>&copy; 2026 YAMONFIM. Plateforme de diffusion privée.</p>
      </footer>
    </main>
  )
}