'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

/* ------------------------------------------------------------------ */
/* Types & Interfaces                                                  */
/* ------------------------------------------------------------------ */

type VipDurationType = '15d' | '3m' | '1y';

interface VipMember {
  id: string;
  email?: string;
  is_vip: boolean;
  watch_count: number;
  vip_started_at?: string;
  vip_duration?: VipDurationType;
  updated_at?: string;
}

const ADMIN_EMAIL = 'lukas.leclerc312@gmail.com';
const MAX_FREE_LIMIT = 5;

/* ------------------------------------------------------------------ */
/* Fonction de formatage de date                                       */
/* ------------------------------------------------------------------ */

const formatDate = (isoString?: string) => {
  if (!isoString) return '—';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

/* ------------------------------------------------------------------ */
/* Composant Compte à Rebours VIP                                      */
/* ------------------------------------------------------------------ */

function VipCountdown({
  startDate,
  duration,
}: {
  startDate?: string;
  duration?: VipDurationType;
}) {
  const [status, setStatus] = useState<{ expired: boolean; text: string }>({
    expired: false,
    text: 'Calcul...',
  });

  useEffect(() => {
    if (!startDate || !duration) {
      setStatus({ expired: false, text: 'Durée non définie' });
      return;
    }

    const start = new Date(startDate).getTime();
    if (isNaN(start)) {
      setStatus({ expired: false, text: 'Date invalide' });
      return;
    }

    const expiration = new Date(start);

    if (duration === '15d') {
      expiration.setDate(expiration.getDate() + 15);
    } else if (duration === '3m') {
      expiration.setMonth(expiration.getMonth() + 3);
    } else if (duration === '1y') {
      expiration.setFullYear(expiration.getFullYear() + 1);
    }

    const expTime = expiration.getTime();

    const updateTimer = () => {
      const now = new Date().getTime();
      const difference = expTime - now;

      if (difference <= 0) {
        setStatus({ expired: true, text: 'Expiré' });
        return;
      }

      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);

      if (days > 0) {
        setStatus({
          expired: false,
          text: `${days}j ${hours}h ${minutes}m restants`,
        });
      } else {
        setStatus({
          expired: false,
          text: `${hours}h ${minutes}m ${seconds}s restants`,
        });
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [startDate, duration]);

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1 ${
        status.expired
          ? 'bg-red-500/10 text-red-400 ring-red-500/30'
          : 'bg-amber-500/10 text-amber-400 ring-amber-500/30'
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          status.expired ? 'bg-red-400' : 'bg-amber-400 animate-pulse'
        }`}
      />
      {status.text}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Page Principale                                                     */
/* ------------------------------------------------------------------ */

export default function AdminVipPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<VipMember[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [selectedDurations, setSelectedDurations] = useState<Record<string, VipDurationType>>({});
  const [watchCounts, setWatchCounts] = useState<Record<string, number>>({});

  const fetchProfiles = async () => {
    try {
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('*')
        .order('is_vip', { ascending: false });

      if (error) {
        setErrorMsg(`Erreur SQL : ${error.message}`);
      } else if (profiles) {
        setMembers(profiles);
        const initialDurations: Record<string, VipDurationType> = {};
        const initialWatchCounts: Record<string, number> = {};

        profiles.forEach(p => {
          initialDurations[p.id] = p.vip_duration || '15d';
          initialWatchCounts[p.id] = p.watch_count || 0;
        });

        setSelectedDurations(initialDurations);
        setWatchCounts(initialWatchCounts);
      }
    } catch (err) {
      console.error('Erreur lors de la récupération des membres:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    async function checkAdminAndFetch() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      if (session.user.email !== ADMIN_EMAIL) {
        router.push('/');
        return;
      }

      await fetchProfiles();
    }

    checkAdminAndFetch();
  }, [router]);

  const showNotification = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const handleUpdateWatchCount = async (userId: string) => {
    setErrorMsg('');
    const newCount = watchCounts[userId] ?? 0;

    const { error } = await supabase
      .from('profiles')
      .update({ watch_count: newCount })
      .eq('id', userId);

    if (!error) {
      showNotification('Quota de visions mis à jour !');
      await fetchProfiles();
    } else {
      setErrorMsg(`Impossible de modifier les visions : ${error.message}`);
    }
  };

  const handleActivateVip = async (userId: string, duration: VipDurationType) => {
    setErrorMsg('');
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('profiles')
      .update({
        is_vip: true,
        vip_started_at: now,
        vip_duration: duration,
      })
      .eq('id', userId);

    if (!error) {
      showNotification('Statut VIP mis à jour !');
      await fetchProfiles();
    } else {
      setErrorMsg(`Impossible d'activer le VIP : ${error.message}`);
    }
  };

  const handleRemoveVip = async (userId: string) => {
    setErrorMsg('');
    const { error } = await supabase
      .from('profiles')
      .update({
        is_vip: false,
        vip_started_at: null,
        vip_duration: null,
      })
      .eq('id', userId);

    if (!error) {
      showNotification('Accès VIP retiré');
      await fetchProfiles();
    } else {
      setErrorMsg(`Impossible de retirer le VIP : ${error.message}`);
    }
  };

  // Filtrage des membres selon la recherche
  const filteredMembers = members.filter(member => {
    const query = searchQuery.toLowerCase();
    const emailMatch = member.email?.toLowerCase().includes(query) || false;
    const idMatch = member.id.toLowerCase().includes(query);
    return emailMatch || idMatch;
  });

  const totalUsers = members.length;
  const vipUsers = members.filter(m => m.is_vip).length;
  const freeUsers = totalUsers - vipUsers;

  if (loading) {
    return (
      <main className="min-h-screen bg-[#0a0a0b] text-white flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-red-600 border-t-transparent" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0a0a0b] pb-24 text-white font-sans antialiased">
      <header className="sticky top-0 z-40 border-b border-white/5 bg-[#0a0a0b]/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-10">
          <button
            onClick={() => router.push('/')}
            className="cursor-pointer rounded-full border border-white/10 bg-white/5 py-2 pl-3 pr-4 text-sm font-medium text-zinc-200 transition hover:bg-white/10 hover:text-white"
          >
            ← Retour
          </button>
          <span className="text-lg font-black tracking-[0.2em] text-red-600">
            YAMON<span className="text-white">FIM</span>
          </span>
          <span className="rounded-full bg-amber-500/15 px-3 py-1 text-xs font-bold text-amber-300 ring-1 ring-amber-500/30">
            👑 Admin VIP
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-8 px-4 pt-10 sm:px-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Administration Membres & VIP</h1>
            <p className="mt-1 text-sm text-zinc-400">
              Gère les abonnements, les dates d'activation, les comptes à rebours et modifie les quotas.
            </p>
          </div>

          <div className="w-full sm:w-72">
            <input
              type="text"
              placeholder="Rechercher par email ou ID..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-zinc-500 outline-none focus:border-red-600"
            />
          </div>
        </div>

        {/* Cartes de Statistiques Utilisateurs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Total Inscrits</p>
            <p className="mt-2 text-3xl font-black text-white">{totalUsers}</p>
          </div>

          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">Membres VIP</p>
            <p className="mt-2 text-3xl font-black text-amber-300">{vipUsers}</p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Comptes Gratuits</p>
            <p className="mt-2 text-3xl font-black text-zinc-300">{freeUsers}</p>
          </div>
        </div>

        {errorMsg && (
          <div className="rounded-2xl bg-red-600/10 px-4 py-3 text-sm text-red-300 ring-1 ring-red-500/35">
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="rounded-2xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300 ring-1 ring-emerald-500/35">
            {successMsg}
          </div>
        )}

        <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03]">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-white/10 bg-white/[0.02] text-xs uppercase tracking-wider text-zinc-400">
                <tr>
                  <th className="px-6 py-4">Utilisateur</th>
                  <th className="px-6 py-4">Statut</th>
                  <th className="px-6 py-4">Visions consommées</th>
                  <th className="px-6 py-4">Date d'activation</th>
                  <th className="px-6 py-4">Compte à rebours VIP</th>
                  <th className="px-6 py-4">Durée attribuée</th>
                  <th className="px-6 py-4 text-right">Actions VIP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredMembers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-zinc-500">
                      Aucun membre trouvé pour « {searchQuery} »
                    </td>
                  </tr>
                ) : (
                  filteredMembers.map(member => {
                    const currentDuration = selectedDurations[member.id] || member.vip_duration || '15d';
                    const currentWatchCount = watchCounts[member.id] ?? 0;
                    const remainingFree = Math.max(0, MAX_FREE_LIMIT - currentWatchCount);

                    return (
                      <tr key={member.id} className="transition hover:bg-white/[0.02]">
                        <td className="px-6 py-4 font-medium text-white">
                          <p>{member.email || member.id}</p>
                          <p className="text-[11px] text-zinc-500">ID: {member.id}</p>
                        </td>
                        <td className="px-6 py-4">
                          {member.is_vip ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400 ring-1 ring-emerald-500/30">
                              VIP Actif
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-800 px-3 py-1 text-xs font-semibold text-zinc-400 ring-1 ring-white/10">
                              Gratuit
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={currentWatchCount}
                              onChange={e =>
                                setWatchCounts(prev => ({
                                  ...prev,
                                  [member.id]: parseInt(e.target.value, 10) || 0,
                                }))
                              }
                              className="w-16 rounded-xl border border-white/10 bg-black/40 px-2.5 py-1.5 text-center text-xs font-bold text-white outline-none focus:border-red-500"
                            />
                            <button
                              onClick={() => handleUpdateWatchCount(member.id)}
                              title="Enregistrer le quota"
                              className="cursor-pointer rounded-xl bg-white/10 px-2.5 py-1.5 text-xs font-semibold text-zinc-200 transition hover:bg-white/20 hover:text-white"
                            >
                              Save
                            </button>
                          </div>
                          <p className="mt-1 text-[11px] text-zinc-400">
                            {remainingFree} restante{remainingFree > 1 ? 's' : ''} sur {MAX_FREE_LIMIT}
                          </p>
                        </td>
                        <td className="px-6 py-4 text-xs text-zinc-300">
                          {member.is_vip ? formatDate(member.vip_started_at) : <span className="text-zinc-600">—</span>}
                        </td>
                        <td className="px-6 py-4">
                          {member.is_vip && member.vip_started_at ? (
                            <VipCountdown
                              startDate={member.vip_started_at}
                              duration={member.vip_duration}
                            />
                          ) : (
                            <span className="text-xs text-zinc-600">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <select
                            value={currentDuration}
                            onChange={e =>
                              setSelectedDurations(prev => ({
                                ...prev,
                                [member.id]: e.target.value as VipDurationType,
                              }))
                            }
                            className="rounded-xl border border-white/10 bg-black/40 px-3 py-1.5 text-xs text-white outline-none focus:border-amber-500"
                          >
                            <option value="15d">15 Jours</option>
                            <option value="3m">3 Mois</option>
                            <option value="1y">1 An</option>
                          </select>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleActivateVip(member.id, currentDuration)}
                              className="cursor-pointer rounded-full bg-amber-500/15 px-3.5 py-1.5 text-xs font-bold text-amber-300 ring-1 ring-amber-500/30 transition hover:bg-amber-500/25"
                            >
                              {member.is_vip ? 'Prolonger VIP' : 'Activer VIP'}
                            </button>
                            {member.is_vip && (
                              <button
                                onClick={() => handleRemoveVip(member.id)}
                                className="cursor-pointer rounded-full bg-red-600/10 px-3.5 py-1.5 text-xs font-bold text-red-400 ring-1 ring-red-500/30 transition hover:bg-red-600/20"
                              >
                                Retirer
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}