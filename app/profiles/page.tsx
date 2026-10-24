'use client';

import { getPersistentSession } from '@/lib/auth-session';

import PageHero from '@/components/PageHero';
import React, { useCallback, useEffect, useState } from 'react';
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
  const [errorMsg, setErrorMsg] = useState('');
  const [saving, setSaving] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [profileName, setProfileName] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(AVATAR_CATEGORIES[0].avatars[0].url);

  const fetchProfiles = useCallback(async () => {
    try {
      setErrorMsg('');
      const { data: { session } } = await getPersistentSession();
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

      if (error) throw error;
      setProfiles(data || []);
    } catch (err) {
      console.error('Erreur chargement profils:', err);
      setErrorMsg('Impossible de charger tes profils. Réessaie dans un instant.');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    // Initial synchronization with the authenticated account.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchProfiles();
  }, [fetchProfiles]);

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
    if (!profileName.trim() || !userId || saving) return;
    setSaving(true);
    setErrorMsg('');
    try {

    if (editingProfile) {
      const { error } = await supabase
        .from('user_profiles')
        .update({ name: profileName.trim(), avatar_url: selectedAvatar })
        .eq('id', editingProfile.id).eq('user_id', userId);
      if (error) throw error;

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
      if (error) throw error;

      if (!error) {
        setShowModal(false);
        fetchProfiles();
      }
    }
    } catch {
      setErrorMsg('Le profil n’a pas été enregistré. Réessaie.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProfile = async (profileId: string) => {
    if (profiles.length <= 1) {
      alert('Vous devez garder au moins un profil.');
      return;
    }
    if (confirm('Voulez-vous vraiment supprimer ce profil et tout son historique ?')) {
      const { error } = await supabase.from('user_profiles').delete().eq('id', profileId).eq('user_id', userId);
      if (error) { setErrorMsg('Impossible de supprimer ce profil.'); return; }
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
        setShowModal(false);
      }
    }
  };

  if (loading) {
    return (
      <main className="yf-page yf-profiles min-h-screen bg-[#0a0a0b] flex items-center justify-center text-white">
        <div className="animate-pulse text-zinc-500 font-medium">Chargement des profils...</div>
      </main>
    );
  }

  return (
    <main className="yf-page yf-profiles min-h-screen bg-[#0a0a0b] text-white flex flex-col items-center justify-center p-6 select-none">
      <div className="max-w-4xl w-full text-center space-y-10">
        <PageHero eyebrow="TA PLACE EST RÉSERVÉE" title="Une nouvelle séance." accent="Pour qui, ce soir ?" description="Choisis ton profil et retrouve tes découvertes, tes épisodes et tes habitudes de cinéma." cardLabel="LES PROFILS" cardTitle="À chacun son univers." cardDetail="JUSQU’À 5 PROFILS" variant="collection" />

        <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-8">
          {profiles.map(profile => (
            <div
              key={profile.id}
              role="button"
              tabIndex={0}
              aria-label={`Regarder avec le profil ${profile.name}`}
              onKeyDown={e => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); selectProfile(profile); } }}
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
                  className="absolute top-2 right-2 bg-black/60 hover:bg-red-600 text-white p-2 rounded-full opacity-100 sm:opacity-0 group-hover:opacity-100 focus:opacity-100 transition backdrop-blur-md"
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
              role="button"
              tabIndex={0}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleOpenCreate(); } }}
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
        {errorMsg && !showModal && <div role="alert" className="text-sm text-red-300"><p>{errorMsg}</p><button onClick={() => void fetchProfiles()} className="mt-3 underline">Réessayer</button></div>}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div role="dialog" aria-modal="true" aria-label={editingProfile ? 'Modifier le profil' : 'Créer un profil'} className="yf-surface bg-[#141416] border border-white/10 rounded-3xl w-full max-w-xl p-6 sm:p-8 shadow-2xl space-y-6 max-h-[90dvh] overflow-y-auto [scrollbar-width:none]">
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
                  maxLength={40}
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
                        <button
                          type="button"
                          aria-label={avatar.name}
                          aria-pressed={selectedAvatar === avatar.url}
                          key={idx}
                          onClick={() => setSelectedAvatar(avatar.url)}
                          className={`relative aspect-square rounded-xl overflow-hidden cursor-pointer ring-2 transition ${
                            selectedAvatar === avatar.url ? 'ring-red-600 scale-105' : 'ring-transparent hover:ring-white/50'
                          }`}
                        >
                          <img src={avatar.url} alt={avatar.name} className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {errorMsg && <p role="alert" className="text-sm text-red-300">{errorMsg}</p>}
              <div className="flex flex-wrap gap-3 items-center justify-between pt-2">
                {editingProfile && profiles.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => void handleDeleteProfile(editingProfile.id)}
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
                    disabled={saving}
                    className="yf-primary bg-red-600 hover:bg-red-500 text-white font-bold px-6 py-2.5 rounded-full text-sm shadow-lg shadow-red-600/30 transition cursor-pointer"
                  >
                    {saving ? 'Enregistrement…' : 'Enregistrer'}
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
