'use client';

import { getPersistentSession } from '@/lib/auth-session';

import SectionNavigation from '@/components/SectionNavigation';
import PageHero from '@/components/PageHero';
import ContactExport from '@/components/ContactExport';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { reconcileMemberDrafts, newlyActivatedMembers } from './member-sync';
import { expirationDate } from '@/app/abonnement/plans';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

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

async function readAll<T>(table: string, order: string, signal: AbortSignal): Promise<T[]> {
  const rows: T[] = [];
  let total = Infinity;
  while (rows.length < total) {
    const { data, error, count } = await supabase.from(table).select('*', { count: 'exact' }).order(order).range(rows.length, rows.length + 499).abortSignal(signal);
    if (error) throw new Error(error.message);
    if (signal.aborted) throw new Error('Chargement annulé');
    if (count !== null) total = count;
    if (!data?.length) {
      if (total !== Infinity && rows.length < total) throw new Error('Lecture incomplète. Actualise les membres.');
      break;
    }
    rows.push(...data as T[]);
  }
  return rows;
}

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

/**
 * Helper de détection VIP
 * Vérifie si la valeur de is_vip équivaut à true (booléen, string, ou nombre)
 */
function checkIsVip(value: unknown): boolean {
  if (value === true || value === 1) return true;
  if (typeof value === 'string') {
    const cleanValue = value.trim().toLowerCase();
    return cleanValue === 'true' || cleanValue === '1' || cleanValue === 't' || cleanValue === 'yes';
  }
  return false;
}

function VipCountdown({
  startDate,
  duration,
}: {
  startDate?: string;
  duration?: VipDurationType;
}) {
  const [clock, setClock] = useState<number | null>(null);
  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const end = expirationDate(startDate, duration);
  const difference = end !== null && clock !== null ? end - clock : null;
  const seconds = Math.max(0, Math.floor((difference ?? 0) / 1000));
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor(seconds / 3600) % 24;
  const minutes = Math.floor(seconds / 60) % 60;
  const status = {
    expired: difference !== null && difference <= 0,
    text: end === null ? 'Durée non définie' : difference === null ? 'Calcul…' : difference <= 0 ? 'Expiré' : days > 0 ? `${days}j ${hours}h ${minutes}m restants` : `${hours}h ${minutes}m ${seconds % 60}s restants`,
  };

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

export default function AdminVipPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<VipMember[]>([]);
  const [visitByUser, setVisitByUser] = useState<Record<string, { user_id: string; first_visited_at: string; last_visited_at: string }>>({});
  const [visitsError, setVisitsError] = useState('');
  const [memberFilter, setMemberFilter] = useState<'all' | 'vip' | 'visited' | 'free'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [selectedDurations, setSelectedDurations] = useState<Record<string, VipDurationType>>({});
  const [watchCounts, setWatchCounts] = useState<Record<string, number>>({});

  const [authorized, setAuthorized] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const previousMembers = useRef<VipMember[]>([]);
  const initialized = useRef(false);
  const mounted = useRef(false);
  const busy = useRef(false);
  const activeController = useRef<AbortController | null>(null);
  const notificationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchProfiles = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    const controller = new AbortController();
    activeController.current = controller;
    try {
      const { data: { session }, error: authError } = await getPersistentSession();
      if (!mounted.current || controller.signal.aborted) return;
      if (authError) throw authError;
      if (session?.user.email !== ADMIN_EMAIL) {
        setAuthorized(false);
        router.replace(session ? '/' : '/login');
        return;
      }
      setAuthorized(true);

      const profilesData = await readAll<VipMember>('profiles', 'id', controller.signal);
      if (controller.signal.aborted) return;

      // Détection stricte True / False pour chaque compte
      const rows: VipMember[] = (profilesData || []).map(member => ({
        ...member,
        is_vip: checkIsVip(member.is_vip),
      }));

      try {
        const visitsData = await readAll<{user_id: string; first_visited_at: string; last_visited_at: string}>('vip_page_visits', 'user_id', controller.signal);
        if (!mounted.current || controller.signal.aborted) return;
        setVisitByUser(Object.fromEntries(visitsData.map(v => [v.user_id, v])));
        setVisitsError('');
      } catch (error) {
        if (!mounted.current || controller.signal.aborted) return;
        setVisitsError(error instanceof Error ? error.message : 'Suivi indisponible');
      }

      rows.sort((a, b) => Number(b.is_vip) - Number(a.is_vip) || (a.email || a.id).localeCompare(b.email || b.id));
      
      const before = previousMembers.current;
      const added = newlyActivatedMembers(before, rows, initialized.current);
      setSelectedDurations(drafts => reconcileMemberDrafts(drafts, Object.fromEntries(before.map(m => [m.id, m.vip_duration || '15d'])), Object.fromEntries(rows.map(m => [m.id, m.vip_duration || '15d']))));
      setWatchCounts(drafts => reconcileMemberDrafts(drafts, Object.fromEntries(before.map(m => [m.id, m.watch_count || 0])), Object.fromEntries(rows.map(m => [m.id, m.watch_count || 0]))));
      previousMembers.current = rows;
      initialized.current = true;
      setMembers(rows);
      setLastUpdated(Date.now());
      setErrorMsg('');

      if (added.length) {
        if (notificationTimer.current) clearTimeout(notificationTimer.current);
        setSuccessMsg(added.length === 1 ? `${added[0].email || 'Un membre'} vient de passer VIP.` : `${added.length} membres viennent de passer VIP.`);
        notificationTimer.current = setTimeout(() => { if (mounted.current) setSuccessMsg(''); }, 10000);
      }
    } catch (error) {
      if (mounted.current && !controller.signal.aborted) {
        setErrorMsg(error instanceof Error ? error.message : 'Impossible d’actualiser les membres.');
      }
    } finally {
      if (activeController.current === controller) busy.current = false;
      if (mounted.current && !controller.signal.aborted) setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    mounted.current = true;
    void fetchProfiles();
    return () => {
      mounted.current = false;
      activeController.current?.abort();
      busy.current = false;
      if (notificationTimer.current) clearTimeout(notificationTimer.current);
    };
  }, [fetchProfiles]);

  useEffect(() => {
    if (!authorized) return;
    const refresh = () => { if (document.visibilityState === 'visible') void fetchProfiles(); };
    const timer = setInterval(refresh, 10000);
    document.addEventListener('visibilitychange', refresh);
    const channel = supabase.channel('admin-vip-member-updates').on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, refresh).on('postgres_changes', { event: '*', schema: 'public', table: 'vip_page_visits' }, refresh).subscribe();
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', refresh); void supabase.removeChannel(channel); };
  }, [authorized, fetchProfiles]);

  const showNotification = (msg: string) => {
    if (notificationTimer.current) clearTimeout(notificationTimer.current);
    setSuccessMsg(msg);
    notificationTimer.current = setTimeout(() => { if (mounted.current) setSuccessMsg(''); }, 3000);
  };

  const handleUpdateWatchCount = async (userId: string) => {
    setErrorMsg('');
    const newCount = watchCounts[userId] ?? 0;
    const { error } = await supabase.from('profiles').update({ watch_count: newCount }).eq('id', userId);
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
    const { error } = await supabase.from('profiles').update({ is_vip: true, vip_started_at: now, vip_duration: duration }).eq('id', userId);
    if (!error) {
      showNotification('Statut VIP mis à jour !');
      await fetchProfiles();
    } else {
      setErrorMsg(`Impossible d'activer le VIP : ${error.message}`);
    }
  };

  const handleRemoveVip = async (userId: string) => {
    setErrorMsg('');
    const { error } = await supabase.from('profiles').update({ is_vip: false, vip_started_at: null, vip_duration: null }).eq('id', userId);
    if (!error) {
      showNotification('Accès VIP retiré');
      await fetchProfiles();
    } else {
      setErrorMsg(`Impossible de retirer le VIP : ${error.message}`);
    }
  };

  const filteredMembers = members.filter(member => {
    const query = searchQuery.toLowerCase();
    const emailMatch = member.email?.toLowerCase().includes(query) || false;
    const idMatch = member.id.toLowerCase().includes(query);
    const inFilter = memberFilter === 'all' || (memberFilter === 'vip' && member.is_vip) || (memberFilter === 'free' && !member.is_vip) || (memberFilter === 'visited' && !!visitByUser[member.id]);
    return (emailMatch || idMatch) && inFilter;
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

  if (!authorized) return errorMsg ? <main className="grid min-h-screen place-items-center p-8 bg-[#0a0a0b] text-white"><div role="alert"><p>{errorMsg}</p><button className="mt-4 rounded-full bg-red-600 px-5 py-3 text-sm font-bold" onClick={() => void fetchProfiles()}>Réessayer</button></div></main> : null;

  return (
    <main className="yf-page yf-admin-vip min-h-screen bg-[#0a0a0b] pb-24 text-white font-sans antialiased">
      <header className="sticky top-0 z-40 border-b border-white/5 bg-[#0a0a0b]/85 backdrop-blur-xl">
        <div className="mx-auto flex min-h-16 flex-wrap gap-3 py-3 max-w-7xl items-center justify-between px-4 sm:px-10">
          <button
            onClick={() => router.push('/')}
            className="cursor-pointer rounded-full border border-white/10 bg-white/5 py-2 pl-3 pr-4 text-sm font-medium text-zinc-200 transition hover:bg-white/10 hover:text-white"
          >
            ← Retour
          </button>
          <span className="text-lg font-black tracking-[0.2em] text-red-600">
            YAMON<span className="text-white">FILM</span>
          </span>
          <span className="rounded-full bg-amber-500/15 px-3 py-1 text-xs font-bold text-amber-300 ring-1 ring-amber-500/30">
            👑 Admin VIP
          </span>
        </div>
      </header>
      <SectionNavigation admin />

      <div className="mx-auto max-w-7xl space-y-8 px-4 pt-10 sm:px-10">
        <PageHero eyebrow="LES MEMBRES, AU PREMIER PLAN" title="Ils passent au VIP." accent="Tu gardes le fil." description="Retrouve les nouveaux membres VIP, leurs accès et les quotas. Une vue claire pour accompagner chaque abonnement." cardLabel="LES MEMBRES VIP" cardTitle="Le premier rang se remplit." cardDetail={`${vipUsers} VIP · ${totalUsers} COMPTES`} variant="collection" />
        <ContactExport />
        
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-red-500">LES MEMBRES, AU PREMIER PLAN</p>
            <h2 className="text-lg font-semibold mt-1">Gérer les membres</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Gère les abonnements, les dates d’activation, les comptes à rebours et modifie les quotas.
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

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.02] px-5 py-3 text-xs text-zinc-400">
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            Mise à jour automatique · 10 secondes
          </span>
          <span>{lastUpdated ? `Dernier relevé : ${new Date(lastUpdated).toLocaleTimeString('fr-FR', { timeZone: 'Europe/Paris' })}` : 'En attente du premier relevé'}</span>
          <button type="button" onClick={() => void fetchProfiles()} className="rounded-lg bg-white/10 px-3 py-1 font-semibold text-white hover:bg-white/20 transition">Actualiser ↻</button>
        </div>

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

        <div className="flex flex-wrap gap-2" aria-label="Filtrer les membres">
          {([
            { id: 'all', label: `Tous les comptes (${totalUsers})` },
            { id: 'vip', label: `Comptes VIP (${vipUsers})` },
            { id: 'visited', label: `Passés sur /vip (${visitsError ? '—' : Object.keys(visitByUser).length})` },
            { id: 'free', label: `Gratuits (${freeUsers})` },
          ] as const).map(filter => (
            <button
              key={filter.id}
              type="button"
              aria-pressed={memberFilter === filter.id}
              onClick={() => setMemberFilter(filter.id)}
              className={`rounded-full px-4 py-2 text-xs font-semibold transition cursor-pointer ${
                memberFilter === filter.id
                  ? 'bg-white text-black'
                  : 'bg-white/5 text-zinc-400 ring-1 ring-white/10 hover:text-white'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <p className="text-xs leading-6 text-zinc-500">La colonne « Page VIP visitée » indique un passage enregistré. Le badge VIP indique le statut du compte ; aucun paiement n’est confirmé par une simple visite.</p>

        {visitsError && (
          <p role="status" className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs leading-6 text-amber-200">
            Le suivi des passages est indisponible. Installe le script <code>20261020_vip_page_visits.sql</code> dans Supabase. Les anciens passages ne sont pas récupérables sans traces conservées.
          </p>
        )}

        <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03]">
          <div className="overflow-x-auto">
            <table className="yf-vip-table w-full text-left text-sm">
              <thead className="border-b border-white/10 bg-white/[0.02] text-xs uppercase tracking-wider text-zinc-400">
                <tr>
                  <th className="px-6 py-4">Utilisateur</th>
                  <th className="px-6 py-4">Statut</th>
                  <th className="px-6 py-4">Page VIP visitée</th>
                  <th className="px-6 py-4">Visions consommées</th>
                  <th className="px-6 py-4">Date d’activation</th>
                  <th className="px-6 py-4">Compte à rebours VIP</th>
                  <th className="px-6 py-4">Durée attribuée</th>
                  <th className="px-6 py-4 text-right">Actions VIP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredMembers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-zinc-500">
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
                        <td data-label="Utilisateur" className="px-6 py-4 font-medium text-white">
                          <p>{member.email || member.id}</p>
                          <p className="text-[11px] text-zinc-500">ID: {member.id}</p>
                        </td>
                        <td data-label="Statut" className="px-6 py-4">
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
                        <td data-label="Page VIP visitée" className="px-6 py-4 text-xs">
                          {visitsError ? (
                            <span className="text-zinc-500">Indisponible</span>
                          ) : visitByUser[member.id] ? (
                            <>
                              <span className="inline-flex rounded-full border border-red-500/20 bg-red-500/10 px-2.5 py-1 text-red-300">Passage enregistré</span>
                              <p className="mt-2 whitespace-nowrap text-zinc-400">{formatDate(visitByUser[member.id].last_visited_at)}</p>
                            </>
                          ) : (
                            <span className="text-zinc-500">Aucune visite enregistrée</span>
                          )}
                        </td>
                        <td data-label="Visions consommées" className="px-6 py-4">
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
                              Enregistrer
                            </button>
                          </div>
                          <p className="mt-1 text-[11px] text-zinc-400">
                            {remainingFree} restante{remainingFree > 1 ? 's' : ''} sur {MAX_FREE_LIMIT}
                          </p>
                        </td>
                        <td data-label="Date d’activation" className="px-6 py-4 text-xs text-zinc-300">
                          {member.is_vip ? formatDate(member.vip_started_at) : <span className="text-zinc-600">—</span>}
                        </td>
                        <td data-label="Temps VIP restant" className="px-6 py-4">
                          {member.is_vip && member.vip_started_at ? (
                            <VipCountdown
                              startDate={member.vip_started_at}
                              duration={member.vip_duration}
                            />
                          ) : (
                            <span className="text-xs text-zinc-600">—</span>
                          )}
                        </td>
                        <td data-label="Durée attribuée" className="px-6 py-4">
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
                        <td data-label="Actions VIP" className="px-6 py-4 text-right">
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
