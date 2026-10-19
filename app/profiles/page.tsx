'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

interface Profile {
  id: string;
  name: string;
  avatar_url: string;
}

// Vrais liens d'images stables classés par catégories (Disney, Super-héros, Gaming)
const AVATAR_CATEGORIES = [
  {
    category: 'Disney & Princesses',
    avatars: [
      { name: 'Raiponce', url: 'https://static.wikia.nocookie.net/heros/images/4/42/Raiponce_Infobox.jpg/revision/latest?cb=20200723185055&path-prefix=fr' },
      { name: 'Mickey', url: 'https://avatarfiles.alphacoders.com/214/214614.jpg' },
      { name: 'Reine des Neiges', url: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRz5Y10-MulAuvwLsp9t3wrzWVcXY5o2vfv3gnwPB2sJkKn0hBlTWzAo0-9&s=10' },
      { name: 'Le Roi Lion', url: 'https://journaldemickey.com/wp-content/uploads/2024/06/roi-lion-personnages.jpg' },
    ],
  },
  {
    category: 'Super-Héros & Comics',
    avatars: [
      { name: 'Spider-Man', url: 'https://avatarfiles.alphacoders.com/375/thumb-350-375896.webp' },
      { name: 'Batman', url: 'https://image.api.playstation.com/cdn/UP1018/CUSA00133_00/Dz5i57ktol8qBJsWEVdjNy8wj3Tc5fF0Y2MyX0Poi4lAniOaUpfjH5IU2vVejxey.png' },
      { name: 'Joker', url: 'https://img.magnific.com/free-vector/scary-clown-head-with-blue-hair-vector_43623-1371.jpg?semt=ais_hybrid&w=740&q=80' },
      { name: 'Marvel', url: 'https://avatarfiles.alphacoders.com/604/60402.jpg' },
    ],
  },
  {
    category: 'Gaming & Séries',
    avatars: [
      { name: 'Mario', url: 'https://pbs.twimg.com/profile_images/1929549617441521664/dn4udfbC_400x400.jpg' },
      { name: 'Stranger Things', url: 'https://cf-images.assettype.com/cinemaexpress%2F2026-01-01%2Fbr0w32gz%2FST5-1.jpg?w=480&auto=format%2Ccompress' },
      { name: 'Anime', url: 'https://www.projectxparis.com/cdn/shop/articles/344_75d7d802-3d2c-42ca-b360-afcc41033d8d.jpg?v=1759397750' },
      { name: 'Gaming Neon', url: 'https://cdn.dribbble.com/userupload/5333469/file/original-d913e65193d78f79999f30fce27114c8.png?resize=752x&vertical=center' },
    ],
  },
];

export default function ProfilesPage() {
  const router = useRouter();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [profileName, setProfileName] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(AVATAR_CATEGORIES[0].avatars[0].url);

  const fetchProfiles = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }
      setUserId(session.user.id);

      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: true });

      if (!error && data) {
        setProfiles(data);
      }
    } catch (err) {
      console.error('Erreur chargement profils:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfiles();
  }, [router]);

  const selectProfile = (profile: Profile) => {
    localStorage.setItem('active_profile', JSON.stringify(profile));
    router.push('/');
  };

  const handleOpenCreate = () => {
    setEditingProfile(null);
    setProfileName('');
    setSelectedAvatar(AVATAR_CATEGORIES[0].avatars[0].url);
    setShowModal(true);
  };

  const handleOpenEdit = (e: React.MouseEvent, profile: Profile) => {
    e.stopPropagation();
    setEditingProfile(profile);
    setProfileName(profile.name);
    setSelectedAvatar(profile.avatar_url || AVATAR_CATEGORIES[0].avatars[0].url);
    setShowModal(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileName.trim() || !userId) return;

    if (editingProfile) {
      const { error } = await supabase
        .from('user_profiles')
        .update({ name: profileName.trim(), avatar_url: selectedAvatar })
        .eq('id', editingProfile.id);

      if (!error) {
        const active = localStorage.getItem('active_profile');
        if (active) {
          try {
            const parsed = JSON.parse(active);
            if (parsed.id === editingProfile.id) {
              localStorage.setItem('active_profile', JSON.stringify({ ...parsed, name: profileName.trim(), avatar_url: selectedAvatar }));
            }
          } catch {}
        }
        setShowModal(false);
        fetchProfiles();
      }
    } else {
      const { error } = await supabase
        .from('user_profiles')
        .insert([{ user_id: userId, name: profileName.trim(), avatar_url: selectedAvatar }]);

      if (!error) {
        setShowModal(false);
        fetchProfiles();
      }
    }
  };

  const handleDeleteProfile = async (profileId: string) => {
    if (profiles.length <= 1) {
      alert('Vous devez garder au moins un profil.');
      return;
    }
    if (confirm('Voulez-vous vraiment supprimer ce profil et tout son historique ?')) {
      const { error } = await supabase.from('user_profiles').delete().eq('id', profileId);
      if (!error) {
        const active = localStorage.getItem('active_profile');
        if (active) {
          try {
            const parsed = JSON.parse(active);
            if (parsed.id === profileId) {
              localStorage.removeItem('active_profile');
            }
          } catch {}
        }
        fetchProfiles();
      }
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-[#0a0a0b] flex items-center justify-center text-white">
        <div className="animate-pulse text-zinc-500 font-medium">Chargement des profils...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0a0a0b] text-white flex flex-col items-center justify-center p-6 select-none">
      <div className="max-w-4xl w-full text-center space-y-10">
        <h1 className="text-3xl sm:text-5xl font-black tracking-tight">Qui regarde ?</h1>

        <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-8">
          {profiles.map(profile => (
            <div
              key={profile.id}
              onClick={() => selectProfile(profile)}
              className="group flex flex-col items-center gap-3 cursor-pointer transition-transform duration-300 hover:scale-105"
            >
              <div className="relative w-28 h-28 sm:w-36 sm:h-36 rounded-2xl overflow-hidden bg-zinc-800 ring-2 ring-transparent group-hover:ring-white transition shadow-2xl">
                {profile.avatar_url && profile.avatar_url.startsWith('http') ? (
                  <img src={profile.avatar_url} alt={profile.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-4xl bg-gradient-to-br from-zinc-800 to-zinc-900">
                    {profile.avatar_url || profile.name[0]}
                  </div>
                )}
                
                <button
                  onClick={(e) => handleOpenEdit(e, profile)}
                  className="absolute top-2 right-2 bg-black/60 hover:bg-red-600 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition backdrop-blur-md"
                  title="Modifier le profil"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
              </div>
              <span className="text-zinc-400 group-hover:text-white font-medium text-sm sm:text-base tracking-wide transition">
                {profile.name}
              </span>
            </div>
          ))}

          {profiles.length < 5 && (
            <div
              onClick={handleOpenCreate}
              className="group flex flex-col items-center gap-3 cursor-pointer transition-transform duration-300 hover:scale-105"
            >
              <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-2xl border-2 border-dashed border-zinc-700 hover:border-white flex items-center justify-center bg-white/[0.02] hover:bg-white/[0.06] transition">
                <svg className="w-10 h-10 text-zinc-500 group-hover:text-white transition" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <span className="text-zinc-500 group-hover:text-zinc-300 font-medium text-sm sm:text-base tracking-wide transition">
                Ajouter
              </span>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#141416] border border-white/10 rounded-3xl w-full max-w-xl p-6 sm:p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto [scrollbar-width:none]">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold">
                {editingProfile ? 'Modifier le profil' : 'Créer un profil'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-zinc-400 hover:text-white transition p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-6">
              <div>
                <label className="block text-xs uppercase tracking-wider text-zinc-400 mb-2">Nom du profil</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Thomas, Enfants..."
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-red-600 transition"
                />
              </div>

              <div className="space-y-4">
                <label className="block text-xs uppercase tracking-wider text-zinc-400">Choisir un avatar par catégorie</label>
                
                {AVATAR_CATEGORIES.map((cat, catIdx) => (
                  <div key={catIdx} className="space-y-2">
                    <p className="text-xs font-semibold text-zinc-300">{cat.category}</p>
                    <div className="grid grid-cols-4 gap-3">
                      {cat.avatars.map((avatar, idx) => (
                        <div
                          key={idx}
                          onClick={() => setSelectedAvatar(avatar.url)}
                          className={`relative aspect-square rounded-xl overflow-hidden cursor-pointer ring-2 transition ${
                            selectedAvatar === avatar.url ? 'ring-red-600 scale-105' : 'ring-transparent hover:ring-white/50'
                          }`}
                        >
                          <img src={avatar.url} alt={avatar.name} className="w-full h-full object-cover" />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between pt-2">
                {editingProfile && profiles.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => { handleDeleteProfile(editingProfile.id); setShowModal(false); }}
                    className="text-red-500 hover:text-red-400 text-sm font-medium transition cursor-pointer"
                  >
                    Supprimer le profil
                  </button>
                ) : <div />}

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-5 py-2.5 rounded-full text-sm font-medium text-zinc-400 hover:text-white transition"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="bg-red-600 hover:bg-red-500 text-white font-bold px-6 py-2.5 rounded-full text-sm shadow-lg shadow-red-600/30 transition cursor-pointer"
                  >
                    Enregistrer
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}