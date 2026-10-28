'use client';

import { getPersistentSession } from '@/lib/auth-session';

import { DEFAULT_AVATAR_CATEGORIES as AVATAR_CATEGORIES, avatarCategories, fetchAvatars, type Avatar } from '@/lib/avatars';
import AvatarPicker from '@/components/AvatarPicker';
import PageHero from '@/components/PageHero';
import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

interface Profile {
  id: string;
  name: string;
  avatar_url: string;
  profile_mode?: string;
}


export default function ProfilesPage() {
  const router = useRouter();
  const [avatars, setAvatars] = useState<Avatar[]>([]);
  const [avatarError, setAvatarError] = useState('');
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [saving, setSaving] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [profileName, setProfileName] = useState('');
  const [profileMode, setProfileMode] = useState('standard');
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
      try { setAvatars(await fetchAvatars()); setAvatarError(''); }
      catch { setAvatarError('Les nouveaux avatars sont indisponibles. Les avatars habituels restent disponibles.'); }

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

  useEffect(() => {
    if (!showModal) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape' && !saving) setShowModal(false);
      if (event.key !== 'Tab') return;
      const elements = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"] button:not(:disabled), [role="dialog"] input:not(:disabled), [role="dialog"] select'));
      const first = elements[0], last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
    document.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', onKey); previous?.focus(); };
  }, [showModal, saving]);

  const selectProfile = (profile: Profile) => {
    localStorage.setItem('active_profile', JSON.stringify(profile));
    router.push('/');
  };

  const handleOpenCreate = () => {
    setEditingProfile(null);
    setProfileName('');
    setProfileMode('standard');
    setSelectedAvatar(AVATAR_CATEGORIES[0].avatars[0].url);
    setShowModal(true);
  };

  const handleOpenEdit = (e: React.MouseEvent, profile: Profile) => {
    e.stopPropagation();
    setEditingProfile(profile);
    setProfileName(profile.name);
    setProfileMode(profile.profile_mode || 'standard');
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
        .update({ name: profileName.trim(), avatar_url: selectedAvatar, profile_mode: profileMode })
        .eq('id', editingProfile.id).eq('user_id', userId);
      if (error) throw error;

      if (!error) {
        const active = localStorage.getItem('active_profile');
        if (active) {
          try {
            const parsed = JSON.parse(active);
            if (parsed.id === editingProfile.id) {
              localStorage.setItem('active_profile', JSON.stringify({ ...parsed, name: profileName.trim(), avatar_url: selectedAvatar, profile_mode: profileMode }));
            }
          } catch {}
        }
        setShowModal(false);
        fetchProfiles();
      }
    } else {
      const { error } = await supabase
        .from('user_profiles')
        .insert([{ user_id: userId, name: profileName.trim(), avatar_url: selectedAvatar, profile_mode: profileMode }]);
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
                  className="absolute top-2 right-2 bg-black/60 hover:bg-red-600 text-white p-2 rounded-full opacity-100 sm:opacity-100 group-hover:opacity-100 focus:opacity-100 transition backdrop-blur-md"
                  title="Modifier le profil"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
              </div>
              <span className="text-zinc-400 group-hover:text-white font-medium text-sm sm:text-base tracking-wide transition">
                {profile.name}{profile.profile_mode === 'kids' ? ' · Kids' : profile.profile_mode === 'junior' ? ' · Junior' : ''}
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
          <div role="dialog" aria-modal="true" aria-label={editingProfile ? 'Modifier le profil' : 'Créer un profil'} className="yf-surface bg-[#141416] border border-white/10 rounded-3xl w-full max-w-4xl p-4 sm:p-8 shadow-2xl space-y-6 max-h-[92dvh] overflow-y-auto overscroll-contain">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold">
                {editingProfile ? 'Modifier le profil' : 'Créer un profil'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                aria-label="Fermer" className="text-zinc-400 hover:text-white transition p-3"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-6">
              <div>
                <label htmlFor="profile-name" className="block text-xs uppercase tracking-wider text-zinc-400 mb-2">Nom du profil</label>
                <input
                  id="profile-name"
                  autoFocus
                  type="text"
                  maxLength={40}
                  required
                  placeholder="Ex: Thomas, Enfants..."
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-red-600 transition"
                />
              </div>

              <label className="block text-sm">Type de profil
                <select value={profileMode} onChange={e => setProfileMode(e.target.value)} className="mt-2 block w-full rounded-xl bg-zinc-900 p-3">
                  <option value="standard">Standard — tout le catalogue</option><option value="kids">Kids — petits enfants</option><option value="junior">Junior — enfants plus grands</option>
                </select><span className="mt-2 block text-xs text-zinc-400">Kids : titres validés pour les petits. Junior : titres Kids et Junior. Le choix du profil reste libre, sans code parental.</span>
              </label>
              <AvatarPicker categories={avatarCategories(avatars)} selected={selectedAvatar} onSelect={setSelectedAvatar} />
              {avatarError && <p role="status" className="text-sm text-amber-200">{avatarError}</p>}

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
