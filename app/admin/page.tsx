'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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
  id: any;
  title: string;
  type: 'movie' | 'series';
  poster: string;
  backdrop?: string;
  url: string;
  embedUrl?: string;
  description: string;
  seasons?: Season[];
}

export default function AdminPage() {
  const router = useRouter();
  const [loadingAuth, setLoadingAuth] = useState(true);

  const ADMIN_EMAIL = 'lukas.leclerc312@gmail.com';

  const [mediaList, setMediaList] = useState<MediaItem[]>([]);
  const [editingId, setEditingId] = useState<any>(null);

  const [title, setTitle] = useState('');
  const [type, setType] = useState<'movie' | 'series'>('movie');
  const [poster, setPoster] = useState('');
  const [backdrop, setBackdrop] = useState('');
  const [url, setUrl] = useState('');
  const [embedUrl, setEmbedUrl] = useState('');
  const [description, setDescription] = useState('');
  
  // États spécifiques pour les séries (Saisons / Épisodes)
  const [seasons, setSeasons] = useState<Season[]>([
    { seasonNumber: 1, episodes: [{ number: 1, title: 'Épisode 1', embedUrl: '' }] }
  ]);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    async function checkAdmin() {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session || session.user.email !== ADMIN_EMAIL) {
        router.push('/');
        return;
      }
      setLoadingAuth(false);
      fetchMedia();
    }

    checkAdmin();
  }, [router]);

  const fetchMedia = async () => {
    const { data, error } = await supabase
      .from('media')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setMediaList(data);
    }
  };

  const handleEdit = (item: MediaItem) => {
    setEditingId(item.id);
    setTitle(item.title || '');
    setType(item.type || 'movie');
    setPoster(item.poster || '');
    setBackdrop(item.backdrop || '');
    setUrl(item.url || '');
    setEmbedUrl(item.embedUrl || '');
    setDescription(item.description || '');
    setSeasons(item.seasons || [{ seasonNumber: 1, episodes: [{ number: 1, title: 'Épisode 1', embedUrl: '' }] }]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancel = () => {
    setEditingId(null);
    setTitle('');
    setType('movie');
    setPoster('');
    setBackdrop('');
    setUrl('');
    setEmbedUrl('');
    setDescription('');
    setSeasons([{ seasonNumber: 1, episodes: [{ number: 1, title: 'Épisode 1', embedUrl: '' }] }]);
  };

  const handleDelete = async (id: any) => {
    if (!confirm('Voulez-vous vraiment supprimer ce média ?')) return;

    const { error } = await supabase.from('media').delete().eq('id', id);
    if (error) {
      setErrorMsg(`Erreur suppression : ${error.message}`);
    } else {
      setMessage('Média supprimé avec succès.');
      fetchMedia();
    }
  };

  // Gestion dynamique des saisons et épisodes
  const addSeason = () => {
    setSeasons(prev => [
      ...prev,
      { seasonNumber: prev.length + 1, episodes: [{ number: 1, title: 'Épisode 1', embedUrl: '' }] }
    ]);
  };

  const removeSeason = (index: number) => {
    setSeasons(prev => prev.filter((_, i) => i !== index));
  };

  const addEpisode = (seasonIndex: number) => {
    setSeasons(prev => {
      const updated = [...prev];
      const season = updated[seasonIndex];
      season.episodes.push({
        number: season.episodes.length + 1,
        title: `Épisode ${season.episodes.length + 1}`,
        embedUrl: ''
      });
      return updated;
    });
  };

  const removeEpisode = (seasonIndex: number, epIndex: number) => {
    setSeasons(prev => {
      const updated = [...prev];
      updated[seasonIndex].episodes = updated[seasonIndex].episodes.filter((_, i) => i !== epIndex);
      return updated;
    });
  };

  const updateEpisodeField = (seasonIndex: number, epIndex: number, field: keyof Episode, value: any) => {
    setSeasons(prev => {
      const updated = [...prev];
      updated[seasonIndex].episodes[epIndex] = {
        ...updated[seasonIndex].episodes[epIndex],
        [field]: value
      };
      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setErrorMsg('');

    const payload = {
      title,
      type,
      poster,
      backdrop,
      url,
      embedUrl: type === 'movie' ? embedUrl : '',
      description,
      seasons: type === 'series' ? seasons : null
    };

    if (editingId !== null && editingId !== undefined) {
      const { error } = await supabase
        .from('media')
        .update(payload)
        .eq('id', editingId);

      if (error) {
        setErrorMsg(`Erreur modification : ${error.message}`);
      } else {
        setMessage('Média modifié avec succès !');
        handleCancel();
        fetchMedia();
      }
    } else {
      const { error } = await supabase.from('media').insert([payload]);

      if (error) {
        setErrorMsg(`Erreur enregistrement Supabase : ${error.message}`);
      } else {
        setMessage('Média ajouté avec succès !');
        handleCancel();
        fetchMedia();
      }
    }
    setLoading(false);
  };

  if (loadingAuth) {
    return (
      <div className="min-h-screen bg-[#141414] text-white flex items-center justify-center text-sm">
        Vérification des accès...
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#141414] text-white p-6 md:p-12 font-sans pb-32">
      <header className="flex justify-between items-center mb-8 pb-4 border-b border-zinc-800">
        <span className="font-black text-xl tracking-wider text-red-600">
          YAMON<span className="text-white">FIM</span> <span className="text-xs text-zinc-400 font-normal">/ Admin</span>
        </span>

        <a href="/" className="text-xs bg-zinc-900 border border-zinc-800 px-3 py-2 rounded-lg hover:text-red-500 transition">
          Retour au site
        </a>
      </header>

      <div className="max-w-2xl mx-auto bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 md:p-8 shadow-xl mb-12">
        <h1 className="text-xl font-bold mb-6">
          {editingId !== null ? 'Modifier le média' : 'Ajouter un film ou une série'}
        </h1>

        {message && <div className="bg-green-600/20 border border-green-500/40 text-green-400 text-xs p-3 rounded-lg mb-4">{message}</div>}
        {errorMsg && <div className="bg-red-600/20 border border-red-500/40 text-red-400 text-xs p-3 rounded-lg mb-4">{errorMsg}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-400 mb-1">Titre</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-red-600"
              placeholder="Ex: Spider-Man ou Breaking Bad"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-400 mb-1">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as 'movie' | 'series')}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-red-600"
            >
              <option value="movie">Film</option>
              <option value="series">Série</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-400 mb-1">Affiche (Poster Portrait - Grilles)</label>
            <input
              type="text"
              value={poster}
              onChange={(e) => setPoster(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-red-600"
              placeholder="https://... (image verticale)"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-400 mb-1">Bandeau (Backdrop Paysage - Carrousel Haut)</label>
            <input
              type="text"
              value={backdrop}
              onChange={(e) => setBackdrop(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-red-600"
              placeholder="https://... (image horizontale)"
            />
          </div>

          {/* Conditionnel si c'est un film */}
          {type === 'movie' && (
            <>
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">Lien de lecture externe (URL)</label>
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-red-600"
                  placeholder="https://..."
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">Lien Iframe / Embed (Lecteur intégré)</label>
                <input
                  type="text"
                  value={embedUrl}
                  onChange={(e) => setEmbedUrl(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-red-600"
                  placeholder="https://... (lien direct iframe/embed)"
                />
              </div>
            </>
          )}

          {/* Gestion dynamique des Saisons et Épisodes si c'est une Série */}
          {type === 'series' && (
            <div className="border border-zinc-800 bg-zinc-950/60 p-4 rounded-xl space-y-4 mt-4">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-bold uppercase tracking-wider text-red-500">Gestion des Saisons & Épisodes</h3>
                <button
                  type="button"
                  onClick={addSeason}
                  className="bg-zinc-800 hover:bg-zinc-700 text-xs px-3 py-1.5 rounded-lg font-bold transition cursor-pointer"
                >
                  + Ajouter une saison
                </button>
              </div>

              {seasons.map((season, sIndex) => (
                <div key={sIndex} className="border border-zinc-800 bg-zinc-900/60 p-3 rounded-xl space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-white">Saison {season.seasonNumber}</span>
                    {seasons.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeSeason(sIndex)}
                        className="text-red-400 text-xs hover:underline cursor-pointer"
                      >
                        Supprimer la saison
                      </button>
                    )}
                  </div>

                  <div className="space-y-2 pl-2 border-l border-zinc-800">
                    {season.episodes.map((ep, eIndex) => (
                      <div key={eIndex} className="flex gap-2 items-center">
                        <span className="text-[11px] text-zinc-400 w-16 shrink-0">Ép. {ep.number}</span>
                        <input
                          type="text"
                          placeholder="Nom (ex: Pilote)"
                          value={ep.title}
                          onChange={(e) => updateEpisodeField(sIndex, eIndex, 'title', e.target.value)}
                          className="bg-zinc-950 border border-zinc-800 rounded-lg p-1.5 text-xs text-white focus:outline-none focus:border-red-600 w-1/3"
                        />
                        <input
                          type="text"
                          placeholder="Lien Iframe / Embed de l'épisode"
                          value={ep.embedUrl}
                          onChange={(e) => updateEpisodeField(sIndex, eIndex, 'embedUrl', e.target.value)}
                          className="bg-zinc-950 border border-zinc-800 rounded-lg p-1.5 text-xs text-white focus:outline-none focus:border-red-600 flex-1"
                        />
                        {season.episodes.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeEpisode(sIndex, eIndex)}
                            className="text-zinc-500 hover:text-red-400 text-xs px-2 cursor-pointer"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => addEpisode(sIndex)}
                      className="mt-2 text-xs bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 px-3 py-1 rounded-md transition cursor-pointer"
                    >
                      + Ajouter un épisode
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-zinc-400 mb-1">Description</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-red-600 resize-none"
              placeholder="Résumé du film ou de la série..."
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-red-600 hover:bg-red-500 font-bold py-3 rounded-lg text-xs transition shadow-lg shadow-red-600/20 disabled:opacity-50 cursor-pointer"
            >
              {loading ? 'Enregistrement...' : editingId !== null ? 'Mettre à jour' : 'Ajouter au catalogue'}
            </button>
            {editingId !== null && (
              <button
                type="button"
                onClick={handleCancel}
                className="bg-zinc-800 hover:bg-zinc-700 font-bold py-3 px-5 rounded-lg text-xs transition cursor-pointer"
              >
                Annuler
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="max-w-4xl mx-auto">
        <h2 className="text-lg font-bold mb-4">Gérer les médias existants ({mediaList.length})</h2>
        <div className="space-y-3">
          {mediaList.map((item) => (
            <div key={item.id} className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="w-10 h-14 bg-zinc-800 shrink-0 rounded overflow-hidden">
                  {item.poster ? <img src={item.poster} alt={item.title} className="w-full h-full object-cover" /> : null}
                </div>
                <div className="truncate">
                  <h3 className="font-bold text-sm text-white truncate">{item.title}</h3>
                  <span className="text-[10px] uppercase text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded">{item.type}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handleEdit(item)}
                  className="bg-zinc-800 hover:bg-zinc-700 text-xs px-3 py-1.5 rounded-lg transition cursor-pointer"
                >
                  Modifier
                </button>
                <button
                  onClick={() => handleDelete(item.id)}
                  className="bg-red-600/20 hover:bg-red-600/40 text-red-400 border border-red-500/30 text-xs px-3 py-1.5 rounded-lg transition cursor-pointer"
                >
                  Supprimer
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}