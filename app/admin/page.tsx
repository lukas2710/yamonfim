'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

interface MediaItem {
  id: string
  title: string
  type: 'movie' | 'series'
  poster: string
  url: string
  description: string
}

export default function AdminPage() {
  const [loading, setLoading] = useState(false)
  const [mediaList, setMediaList] = useState<MediaItem[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  
  const [title, setTitle] = useState('')
  const [type, setType] = useState('movie')
  const [poster, setPoster] = useState('')
  const [url, setUrl] = useState('')
  const [description, setDescription] = useState('')

  const [scrapeUrl, setScrapeUrl] = useState('')
  const [scrapedLinks, setScrapedLinks] = useState<{ text: string; href: string }[]>([])

  // Charger la liste des médias enregistrés
  async function fetchMedia() {
    const { data, error } = await supabase.from('media').select('*').order('created_at', { ascending: false })
    if (!error && data) {
      setMediaList(data)
    }
  }

  useEffect(() => {
    fetchMedia()
  }, [])

  async function handleScrape(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: scrapeUrl })
      })
      const data = await res.json()
      if (data.error) alert(data.error)
      else setScrapedLinks(data.links)
    } catch (err: any) {
      alert('Erreur lors du scan : ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    if (editingId) {
      // Mode Modification
      const { error } = await supabase
        .from('media')
        .update({ title, type, poster, url, description })
        .eq('id', editingId)

      if (error) {
        alert('Erreur modification : ' + error.message)
      } else {
        alert('Contenu mis à jour avec succès !')
        resetForm()
        fetchMedia()
      }
    } else {
      // Mode Ajout
      const { error } = await supabase
        .from('media')
        .insert([{ title, type, poster, url, description }])

      if (error) {
        alert('Erreur enregistrement : ' + error.message)
      } else {
        alert('Film/Série ajouté avec succès !')
        resetForm()
        fetchMedia()
      }
    }
    setLoading(false)
  }

  function handleEdit(item: MediaItem) {
    setEditingId(item.id)
    setTitle(item.title)
    setType(item.type)
    setPoster(item.poster)
    setUrl(item.url)
    setDescription(item.description)
    window.scrollTo({ top: 500, behavior: 'smooth' })
  }

  async function handleDelete(id: string) {
    if (confirm('Voulez-vous vraiment supprimer ce contenu ?')) {
      const { error } = await supabase.from('media').delete().eq('id', id)
      if (error) {
        alert('Erreur suppression : ' + error.message)
      } else {
        fetchMedia()
      }
    }
  }

  function resetForm() {
    setEditingId(null)
    setTitle('')
    setType('movie')
    setPoster('')
    setUrl('')
    setDescription('')
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 p-4 sm:p-8 max-w-4xl mx-auto space-y-12">
      {/* Navigation */}
      <div className="flex justify-between items-center border-b border-zinc-900 pb-4">
        <h1 className="text-xl font-bold tracking-tight text-red-600">YAMON<span className="text-white">FIM</span> - Espace Admin</h1>
        <Link href="/" className="bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 px-4 py-2 rounded-lg text-sm transition">
          Voir le site
        </Link>
      </div>

      {/* SECTION 1 : EXTRACTEUR DE LIENS */}
      <div className="bg-zinc-900/50 border border-zinc-900 p-6 rounded-2xl space-y-4">
        <h2 className="text-lg font-semibold">1. Extracteur de liens (Optionnel)</h2>
        <form onSubmit={handleScrape} className="flex gap-2">
          <input 
            type="url" 
            value={scrapeUrl} 
            onChange={(e) => setScrapeUrl(e.target.value)} 
            placeholder="https://exemple.com" 
            required 
            className="flex-1 bg-zinc-900 border border-zinc-800 p-3 rounded-xl text-sm focus:outline-none focus:border-red-600" 
          />
          <button type="submit" disabled={loading} className="bg-zinc-800 hover:bg-zinc-700 px-5 rounded-xl text-sm font-medium transition shrink-0">
            {loading ? 'Analyse...' : 'Scanner'}
          </button>
        </form>

        {scrapedLinks.length > 0 && (
          <div className="max-h-60 overflow-y-auto bg-zinc-950 border border-zinc-800 p-4 rounded-xl space-y-2">
            <p className="text-xs font-semibold text-zinc-400 uppercase">{scrapedLinks.length} liens trouvés :</p>
            {scrapedLinks.map((l, index) => (
              <div key={index} className="flex justify-between items-center text-xs border-b border-zinc-900 pb-2">
                <span className="truncate max-w-[220px] text-zinc-300">{l.text}</span>
                <button 
                  type="button" 
                  onClick={() => {
                    setUrl(l.href)
                    alert('Lien vidéo injecté dans le formulaire !')
                  }}
                  className="text-red-500 hover:underline shrink-0 ml-2 font-medium"
                >
                  Utiliser ce lien
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SECTION 2 : FORMULAIRE AJOUT / MODIFICATION */}
      <div className="bg-zinc-900/50 border border-zinc-900 p-6 rounded-2xl space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold">
            {editingId ? 'Modifier le média sélectionné' : '2. Ajouter un film ou une série'}
          </h2>
          {editingId && (
            <button type="button" onClick={resetForm} className="text-xs text-zinc-400 hover:text-white underline">
              Annuler la modification
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs uppercase text-zinc-400 font-semibold">Titre</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Inception" required className="w-full mt-1 bg-zinc-900 border border-zinc-800 p-3 rounded-xl text-sm focus:outline-none focus:border-red-600" />
          </div>
          <div>
            <label className="text-xs uppercase text-zinc-400 font-semibold">Type de contenu</label>
            <select value={type} onChange={(e) => setType(e.target.value)} className="w-full mt-1 bg-zinc-900 border border-zinc-800 p-3 rounded-xl text-sm focus:outline-none focus:border-red-600">
              <option value="movie">Film</option>
              <option value="series">Série</option>
            </select>
          </div>
          <div>
            <label className="text-xs uppercase text-zinc-400 font-semibold">URL de l'affiche (Image)</label>
            <input value={poster} onChange={(e) => setPoster(e.target.value)} placeholder="https://..." required className="w-full mt-1 bg-zinc-900 border border-zinc-800 p-3 rounded-xl text-sm focus:outline-none focus:border-red-600" />
          </div>
          <div>
            <label className="text-xs uppercase text-zinc-400 font-semibold">URL de la vidéo (Embed / Flux)</label>
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." required className="w-full mt-1 bg-zinc-900 border border-zinc-800 p-3 rounded-xl text-sm focus:outline-none focus:border-red-600" />
          </div>
          <div>
            <label className="text-xs uppercase text-zinc-400 font-semibold">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Résumé de l'histoire..." required rows={3} className="w-full mt-1 bg-zinc-900 border border-zinc-800 p-3 rounded-xl text-sm focus:outline-none focus:border-red-600"></textarea>
          </div>
          <button type="submit" disabled={loading} className="w-full bg-red-600 hover:bg-red-500 py-3 rounded-xl font-medium text-sm transition shadow-lg shadow-red-600/20">
            {loading ? 'Enregistrement...' : editingId ? 'Mettre à jour le média' : 'Publier sur yamonfim'}
          </button>
        </form>
      </div>

      {/* SECTION 3 : LISTE DES CONTENUS DÉJÀ AJOUTÉS (MODIFICATION / SUPPRESSION) */}
      <div className="bg-zinc-900/50 border border-zinc-900 p-6 rounded-2xl space-y-4">
        <h2 className="text-lg font-semibold">3. Gérer les médias enregistrés ({mediaList.length})</h2>
        
        {mediaList.length === 0 ? (
          <p className="text-zinc-500 text-sm">Aucun contenu enregistré pour le moment.</p>
        ) : (
          <div className="space-y-3">
            {mediaList.map((item) => (
              <div key={item.id} className="flex items-center justify-between bg-zinc-950 border border-zinc-800 p-3 rounded-xl gap-4">
                <div className="flex items-center space-x-3 overflow-hidden">
                  <img src={item.poster} alt={item.title} className="w-10 h-14 object-cover rounded-md shrink-0" />
                  <div className="truncate">
                    <h4 className="font-medium text-sm truncate">{item.title}</h4>
                    <span className="text-xs text-zinc-500 uppercase">{item.type === 'movie' ? 'Film' : 'Série'}</span>
                  </div>
                </div>
                <div className="flex items-center space-x-2 shrink-0">
                  <button onClick={() => handleEdit(item)} className="bg-zinc-800 hover:bg-zinc-700 text-xs px-3 py-1.5 rounded-lg transition font-medium">
                    Modifier
                  </button>
                  <button onClick={() => handleDelete(item.id)} className="bg-red-950/60 border border-red-900/50 hover:bg-red-900 text-red-400 hover:text-white text-xs px-3 py-1.5 rounded-lg transition font-medium">
                    Supprimer
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}