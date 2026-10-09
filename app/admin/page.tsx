'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface MediaItem {
  id: any;
  title: string;
  type: 'movie' | 'series';
  poster: string;
  backdrop?: string;
  url: string;
  description: string;
}

export default function AdminPage() {
  const [mediaList, setMediaList] = useState<MediaItem[]>([]);
  const [editingId, setEditingId] = useState<any>(null);

  const [title, setTitle] = useState('');
  const [type, setType] = useState<'movie' | 'series'>('movie');
  const [poster, setPoster] = useState('');
  const [backdrop, setBackdrop] = useState('');
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const fetchMedia = async () => {
    const { data, error } = await supabase
      .from('media')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setMediaList(data);
    }
  };

  useEffect(() => {
    fetchMedia();
  }, []);

  const handleEdit = (item: MediaItem) => {
    setEditingId(item.id);
    setTitle(item.title || '');
    setType(item.type || 'movie');
    setPoster(item.poster || '');
    setBackdrop(item.backdrop || '');
    setUrl(item.url || '');
    setDescription(item.description || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancel = () => {
    setEditingId(null);
    setTitle('');
    setType('movie');
    setPoster('');
    setBackdrop('');
    setUrl('');
    setDescription('');
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setErrorMsg('');

    if (editingId !== null && editingId !== undefined) {
      // Modification
      const { error } = await supabase
        .from('media')
        .update({ title, type, poster, backdrop, url, description })
        .eq('id', editingId);

      if (error) {
        setErrorMsg(`Erreur modification : ${error.message}`);
      } else {
        setMessage('Média modifié avec succès !');
        handleCancel();
        fetchMedia();
      }
    } else {
      // Ajout
      const { error } = await supabase.from('media').insert([
        { title, type, poster, backdrop, url, description },
      ]);

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
              placeholder="Ex: Spider-Man"
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
              type="url"
              value={poster}
              onChange={(e) => setPoster(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-red-600"
              placeholder="https://... (image verticale)"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-400 mb-1">Bandeau (Backdrop Paysage - Carrousel Haut)</label>
            <input
              type="url"
              value={backdrop}
              onChange={(e) => setBackdrop(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-red-600"
              placeholder="https://... (image horizontale)"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-400 mb-1">Lien de lecture (URL)</label>
            <input
              type="url"
              required
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-red-600"
              placeholder="https://..."
            />
          </div>

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
              className="flex-1 bg-red-600 hover:bg-red-500 font-bold py-3 rounded-lg text-xs transition shadow-lg shadow-red-600/20 disabled:opacity-50"
            >
              {loading ? 'Enregistrement...' : editingId !== null ? 'Mettre à jour' : 'Ajouter au catalogue'}
            </button>
            {editingId !== null && (
              <button
                type="button"
                onClick={handleCancel}
                className="bg-zinc-800 hover:bg-zinc-700 font-bold py-3 px-5 rounded-lg text-xs transition"
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
                  className="bg-zinc-800 hover:bg-zinc-700 text-xs px-3 py-1.5 rounded-lg transition"
                >
                  Modifier
                </button>
                <button
                  onClick={() => handleDelete(item.id)}
                  className="bg-red-600/20 hover:bg-red-600/40 text-red-400 border border-red-500/30 text-xs px-3 py-1.5 rounded-lg transition"
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