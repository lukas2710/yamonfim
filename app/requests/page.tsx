'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

interface RequestItem {
  id: string;
  user_email: string;
  title: string;
  type: 'movie' | 'series';
  tmdb_id?: string;
  poster?: string;
  note?: string;
  status: 'en_attente' | 'en_cours' | 'ajoute' | 'refuse';
  created_at: string;
}

interface TmdbResult {
  id: number;
  title?: string;
  name?: string;
  poster_path?: string;
  media_type?: string;
  release_date?: string;
  first_air_date?: string;
}

export default function RequestsPage() {
  const router = useRouter();
  const ADMIN_EMAIL = 'lukas.leclerc312@gmail.com';
  const TMDB_KEY = 'af281c5089038e174e83c576ff765be9';

  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [requests, setRequests] = useState<RequestItem[]>([]);

  // Formulaire & TMDb Search
  const [searchQuery, setSearchQuery] = useState('');
  const [type, setType] = useState<'movie' | 'series'>('movie');
  const [tmdbResults, setTmdbResults] = useState<TmdbResult[]>([]);
  const [selectedMedia, setSelectedMedia] = useState<TmdbResult | null>(null);
  const [searchingTmdb, setSearchingTmdb] = useState(false);

  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setCurrentUser(session.user);
      }
      await fetchRequests();
      setLoading(false);
    }
    init();
  }, []);

  const fetchRequests = async () => {
    const { data, error } = await supabase
      .from('requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setRequests(data);
    }
  };

  // Recherche automatique sur TMDb
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setTmdbResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearchingTmdb(true);
      try {
        const endpoint = type === 'movie' ? 'movie' : 'tv';
        const res = await fetch(
          `https://api.themoviedb.org/3/search/${endpoint}?api_key=${TMDB_KEY}&language=fr-FR&query=${encodeURIComponent(searchQuery)}`
        );
        const data = await res.json();
        if (data && data.results) {
          setTmdbResults(data.results.slice(0, 6));
        }
      } catch (err) {
        console.error('Erreur TMDb search', err);
      }
      setSearchingTmdb(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, type]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMedia && !searchQuery) return;

    setSubmitting(true);
    setMsg('');
    setErrorMsg('');

    const mediaTitle = selectedMedia ? (selectedMedia.title || selectedMedia.name) : searchQuery;
    const mediaTmdbId = selectedMedia ? String(selectedMedia.id) : null;
    const mediaPoster = selectedMedia?.poster_path ? `https://image.tmdb.org/t/p/w500${selectedMedia.poster_path}` : null;

    const { error } = await supabase.from('requests').insert([
      {
        user_id: currentUser?.id || null,
        user_email: currentUser?.email || 'Visiteur',
        title: mediaTitle,
        type,
        tmdb_id: mediaTmdbId,
        poster: mediaPoster,
        note: note.trim() || null,
        status: 'en_attente'
      }
    ]);

    if (error) {
      setErrorMsg(`Erreur : ${error.message}`);
    } else {
      setMsg('Demande enregistrée avec succès !');
      setSearchQuery('');
      setSelectedMedia(null);
      setNote('');
      setTmdbResults([]);
      fetchRequests();
    }
    setSubmitting(false);
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    const { error } = await supabase
      .from('requests')
      .update({ status: newStatus })
      .eq('id', id);

    if (!error) {
      fetchRequests();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer cette demande ?')) return;
    const { error } = await supabase.from('requests').delete().eq('id', id);
    if (!error) fetchRequests();
  };

  const isAdmin = currentUser?.email === ADMIN_EMAIL;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'en_cours':
        return <span className="bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[10px] px-2.5 py-1 rounded-full font-bold">En cours de traitement</span>;
      case 'ajoute':
        return <span className="bg-green-500/10 text-green-400 border border-green-500/30 text-[10px] px-2.5 py-1 rounded-full font-bold">✓ Ajouté au catalogue</span>;
      case 'refuse':
        return <span className="bg-red-500/10 text-red-400 border border-red-500/30 text-[10px] px-2.5 py-1 rounded-full font-bold">Non disponible</span>;
      default:
        return <span className="bg-zinc-800 text-zinc-400 border border-zinc-700 text-[10px] px-2.5 py-1 rounded-full font-bold">En attente</span>;
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-[#141414] text-white flex items-center justify-center text-sm">Chargement...</div>;
  }

  return (
    <main className="min-h-screen bg-[#141414] text-white p-4 sm:p-10 font-sans pb-24">
      <header className="flex justify-between items-center mb-8 pb-4 border-b border-zinc-800">
        <div>
          <span className="font-black text-xl tracking-wider text-red-600">
            YAMON<span className="text-white">FIM</span>
          </span>
          <h1 className="text-sm font-bold text-zinc-400 mt-1">Demandes de Films & Séries</h1>
        </div>

        <button onClick={() => router.push('/')} className="text-xs bg-zinc-900 border border-zinc-800 px-3 py-2 rounded-lg hover:text-red-500 transition cursor-pointer">
          Retour à l'accueil
        </button>
      </header>

      <div className="max-w-4xl mx-auto space-y-10">
        
        {/* Formulaire de recherche TMDb */}
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 sm:p-8 shadow-xl">
          <h2 className="text-base sm:text-lg font-bold mb-4 flex items-center gap-2">
            <span>🎬</span> Faire une demande
          </h2>

          {msg && <div className="bg-green-600/20 border border-green-500/40 text-green-400 text-xs p-3 rounded-lg mb-4">{msg}</div>}
          {errorMsg && <div className="bg-red-600/20 border border-red-500/40 text-red-400 text-xs p-3 rounded-lg mb-4">{errorMsg}</div>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">Type</label>
                <select
                  value={type}
                  onChange={(e) => {
                    setType(e.target.value as 'movie' | 'series');
                    setSelectedMedia(null);
                    setTmdbResults([]);
                  }}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-red-600 cursor-pointer"
                >
                  <option value="movie">Film</option>
                  <option value="series">Série</option>
                </select>
              </div>

              <div className="sm:col-span-2 relative">
                <label className="block text-xs font-semibold text-zinc-400 mb-1">Rechercher le titre exact (TMDb)</label>
                <input
                  type="text"
                  required
                  placeholder={type === 'movie' ? 'Ex: Fast & Furious, Avatar...' : 'Ex: Breaking Bad, Game of Thrones...'}
                  value={selectedMedia ? (selectedMedia.title || selectedMedia.name) : searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setSelectedMedia(null);
                  }}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-red-600"
                />

                {/* Autocomplétion TMDb */}
                {!selectedMedia && tmdbResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-50 bg-zinc-900 border border-zinc-800 rounded-xl mt-1 overflow-hidden shadow-2xl max-h-60 overflow-y-auto">
                    {tmdbResults.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => {
                          setSelectedMedia(item);
                          setSearchQuery('');
                          setTmdbResults([]);
                        }}
                        className="p-2.5 hover:bg-zinc-800 flex items-center gap-3 cursor-pointer transition border-b border-zinc-800/50 last:border-0"
                      >
                        <div className="w-8 h-12 bg-zinc-800 shrink-0 rounded overflow-hidden">
                          {item.poster_path && (
                            <img src={`https://image.tmdb.org/t/p/w92${item.poster_path}`} alt="" className="w-full h-full object-cover" />
                          )}
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-white">{item.title || item.name}</h4>
                          <span className="text-[10px] text-zinc-500">
                            {item.release_date?.slice(0, 4) || item.first_air_date?.slice(0, 4) || 'TMDb ID: ' + item.id}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Aperçu du média sélectionné */}
            {selectedMedia && (
              <div className="bg-red-600/10 border border-red-500/30 p-3 rounded-xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  {selectedMedia.poster_path && (
                    <img src={`https://image.tmdb.org/t/p/w92${selectedMedia.poster_path}`} alt="" className="w-10 h-14 rounded object-cover" />
                  )}
                  <div>
                    <span className="text-[10px] text-red-400 font-bold uppercase">Sélectionné</span>
                    <h4 className="text-xs font-bold text-white">{selectedMedia.title || selectedMedia.name}</h4>
                    <span className="text-[10px] text-zinc-400">ID TMDb : {selectedMedia.id}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedMedia(null)}
                  className="text-xs text-zinc-400 hover:text-white"
                >
                  Changer ✕
                </button>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1">Remarque (optionnel)</label>
              <input
                type="text"
                placeholder="Ex: Version VF uniquement..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-red-600"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-lg text-xs transition cursor-pointer shadow-lg shadow-red-600/20"
            >
              {submitting ? 'Envoi...' : 'Envoyer la demande'}
            </button>
          </form>
        </div>

        {/* Liste globale des demandes */}
        <div>
          <h2 className="text-base font-bold mb-4 flex items-center justify-between">
            <span>Demandes de la communauté ({requests.length})</span>
            {isAdmin && <span className="text-xs bg-red-600/20 text-red-400 px-2.5 py-1 rounded-md border border-red-500/30">Mode Admin Actif</span>}
          </h2>

          {requests.length === 0 ? (
            <p className="text-xs text-zinc-500 py-6 text-center border border-dashed border-zinc-800 rounded-xl">
              Aucune demande pour le moment.
            </p>
          ) : (
            <div className="space-y-3">
              {requests.map((req) => (
                <div key={req.id} className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-14 bg-zinc-800 rounded overflow-hidden shrink-0">
                      {req.poster && <img src={req.poster} alt="" className="w-full h-full object-cover" />}
                    </div>
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-bold uppercase bg-zinc-800 px-2 py-0.5 rounded text-zinc-300">
                          {req.type === 'movie' ? 'Film' : 'Série'}
                        </span>
                        <h3 className="font-bold text-sm text-white">{req.title}</h3>
                      </div>

                      {req.note && <p className="text-xs text-zinc-400">Note : {req.note}</p>}

                      <div className="text-[10px] text-zinc-500">
                        Demandé par <span className="text-zinc-400">{req.user_email}</span>
                        {req.tmdb_id && <span className="text-zinc-500 ml-2">• ID TMDb: {req.tmdb_id}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {isAdmin ? (
                      <div className="flex items-center gap-2">
                        <select
                          value={req.status}
                          onChange={(e) => handleStatusChange(req.id, e.target.value)}
                          className="bg-zinc-950 border border-zinc-700 text-xs text-white p-1.5 rounded-lg focus:outline-none focus:border-red-600 cursor-pointer"
                        >
                          <option value="en_attente">⏳ En attente</option>
                          <option value="en_cours">🔄 En cours</option>
                          <option value="ajoute">✅ Ajouté</option>
                          <option value="refuse">❌ Non dispo</option>
                        </select>
                        <button
                          onClick={() => handleDelete(req.id)}
                          className="text-xs bg-red-600/20 hover:bg-red-600/40 text-red-400 border border-red-500/30 px-2.5 py-1.5 rounded-lg transition cursor-pointer"
                        >
                          🗑️
                        </button>
                      </div>
                    ) : (
                      <div>{getStatusBadge(req.status)}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </main>
  );
}