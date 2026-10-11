'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

interface MediaItem {
  id: any;
  title: string;
  type: 'movie' | 'series';
  poster: string;
}

interface BannerItem {
  id: string;
  title: string;
  subtitle?: string;
  backdrop: string;
  media_ids: string[];
  active: boolean;
  created_at: string;
}

export default function AdminBannersPage() {
  const router = useRouter();
  const ADMIN_EMAIL = 'lukas.leclerc312@gmail.com';

  const [loadingAuth, setLoadingAuth] = useState(true);
  const [mediaList, setMediaList] = useState<MediaItem[]>([]);
  const [banners, setBanners] = useState<BannerItem[]>([]);

  // Formulaire
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [backdrop, setBackdrop] = useState('');
  const [selectedMediaIds, setSelectedMediaIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || session.user.email !== ADMIN_EMAIL) {
        router.push('/');
        return;
      }
      setLoadingAuth(false);
      fetchMedia();
      fetchBanners();
    }
    init();
  }, [router]);

  const fetchMedia = async () => {
    const { data } = await supabase
      .from('media')
      .select('id, title, type, poster')
      .order('created_at', { ascending: false });
    if (data) setMediaList(data);
  };

  const fetchBanners = async () => {
    const { data } = await supabase
      .from('banners')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setBanners(data);
  };

  const handleMediaToggle = (mediaId: string) => {
    if (selectedMediaIds.includes(mediaId)) {
      setSelectedMediaIds(selectedMediaIds.filter(id => id !== mediaId));
    } else {
      setSelectedMediaIds([...selectedMediaIds, mediaId]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !backdrop.trim()) return;

    setSubmitting(true);
    setMessage('');
    setErrorMsg('');

    const { error } = await supabase.from('banners').insert([
      {
        title: title.trim(),
        subtitle: subtitle.trim() || null,
        backdrop: backdrop.trim(),
        media_ids: selectedMediaIds,
        active: true,
      }
    ]);

    if (error) {
      setErrorMsg(`Erreur : ${error.message}`);
    } else {
      setMessage('Bannière publiée avec succès sur la page d\'accueil !');
      setTitle('');
      setSubtitle('');
      setBackdrop('');
      setSelectedMediaIds([]);
      fetchBanners();
    }
    setSubmitting(false);
  };

  const handleDeleteBanner = async (id: string) => {
    if (!confirm('Voulez-vous supprimer cette bannière ?')) return;
    const { error } = await supabase.from('banners').delete().eq('id', id);
    if (!error) {
      fetchBanners();
    }
  };

  const toggleActive = async (id: string, currentActive: boolean) => {
    const { error } = await supabase
      .from('banners')
      .update({ active: !currentActive })
      .eq('id', id);
    if (!error) fetchBanners();
  };

  if (loadingAuth) {
    return (
      <div className="min-h-screen bg-[#141414] text-white flex items-center justify-center text-sm">
        Vérification des accès Administrateur...
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#141414] text-white p-4 sm:p-10 font-sans pb-24">
      <header className="flex justify-between items-center mb-8 pb-4 border-b border-zinc-800">
        <div>
          <span className="font-black text-xl tracking-wider text-red-600">
            YAMON<span className="text-white">FIM</span>
          </span>
          <h1 className="text-sm font-bold text-zinc-400 mt-1">Gestion des Bannières Thématiques</h1>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => router.push('/admin')}
            className="text-xs bg-zinc-900 border border-zinc-800 px-3 py-2 rounded-lg hover:text-white transition cursor-pointer"
          >
            Espace Admin
          </button>
          <button
            onClick={() => router.push('/')}
            className="text-xs bg-zinc-900 border border-zinc-800 px-3 py-2 rounded-lg hover:text-red-500 transition cursor-pointer"
          >
            Retour au site
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto space-y-10">
        
        {/* Formulaire de création */}
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5 sm:p-8 shadow-xl">
          <h2 className="text-base sm:text-lg font-bold mb-4 text-red-500 flex items-center gap-2">
            <span>🎯</span> Créer une bannière (Ex: Halloween 🎃, Soirée Action 💥)
          </h2>

          {message && <div className="bg-green-600/20 border border-green-500/40 text-green-400 text-xs p-3 rounded-lg mb-4">{message}</div>}
          {errorMsg && <div className="bg-red-600/20 border border-red-500/40 text-red-400 text-xs p-3 rounded-lg mb-4">{errorMsg}</div>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">Titre de la bannière</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Spécial Halloween 🎃"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-red-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">Sous-titre (optionnel)</label>
                <input
                  type="text"
                  placeholder="Ex: Les meilleurs films d'horreur du site..."
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-red-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1">Image de fond (Backdrop Landscape URL)</label>
              <input
                type="text"
                required
                placeholder="Ex: https://image.tmdb.org/t/p/original/..."
                value={backdrop}
                onChange={(e) => setBackdrop(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-red-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-2">
                Sélectionne les films / séries à intégrer ({selectedMediaIds.length} sélectionné(s))
              </label>
              
              <div className="max-h-56 overflow-y-auto bg-zinc-950 border border-zinc-800 p-3 rounded-xl grid grid-cols-1 sm:grid-cols-2 gap-2">
                {mediaList.map((m) => {
                  const isSelected = selectedMediaIds.includes(String(m.id));
                  return (
                    <div
                      key={m.id}
                      onClick={() => handleMediaToggle(String(m.id))}
                      className={`flex items-center gap-3 p-2 rounded-lg border transition cursor-pointer ${
                        isSelected
                          ? 'bg-red-600/20 border-red-500/50 text-white'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                      }`}
                    >
                      <div className="w-8 h-10 bg-zinc-800 rounded overflow-hidden shrink-0">
                        {m.poster && <img src={m.poster} alt="" className="w-full h-full object-cover" />}
                      </div>
                      <div className="truncate text-xs font-medium">
                        <p className="truncate">{m.title}</p>
                        <span className="text-[10px] text-zinc-500 uppercase">{m.type === 'movie' ? 'Film' : 'Série'}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-lg text-xs transition cursor-pointer shadow-lg shadow-red-600/20"
            >
              {submitting ? 'Publication...' : 'Publier la bannière'}
            </button>
          </form>
        </div>

        {/* Liste des bannières */}
        <div>
          <h2 className="text-base font-bold mb-4">Bannières existantes ({banners.length})</h2>

          {banners.length === 0 ? (
            <p className="text-xs text-zinc-500 py-6 text-center border border-dashed border-zinc-800 rounded-xl">
              Aucune bannière créée pour le moment.
            </p>
          ) : (
            <div className="space-y-4">
              {banners.map((b) => (
                <div key={b.id} className="relative bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4 z-10">
                    <div className="w-20 h-12 bg-zinc-800 rounded-lg overflow-hidden shrink-0 border border-zinc-700">
                      <img src={b.backdrop} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-white">{b.title}</h3>
                      {b.subtitle && <p className="text-xs text-zinc-400">{b.subtitle}</p>}
                      <p className="text-[10px] text-zinc-500 mt-1">
                        {b.media_ids?.length || 0} média(s) associé(s)
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 z-10">
                    <button
                      onClick={() => toggleActive(b.id, b.active)}
                      className={`text-xs px-3 py-1.5 rounded-lg font-bold border transition cursor-pointer ${
                        b.active
                          ? 'bg-green-500/10 text-green-400 border-green-500/30'
                          : 'bg-zinc-800 text-zinc-500 border-zinc-700'
                      }`}
                    >
                      {b.active ? 'Active' : 'Masquée'}
                    </button>
                    <button
                      onClick={() => handleDeleteBanner(b.id)}
                      className="text-xs bg-red-600/20 hover:bg-red-600/40 text-red-400 border border-red-500/30 px-3 py-1.5 rounded-lg transition cursor-pointer"
                    >
                      Supprimer
                    </button>
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