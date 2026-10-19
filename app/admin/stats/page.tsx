'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

const ADMIN_EMAIL = 'lukas.leclerc312@gmail.com';

export default function AdminStatsPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);

  const [stats, setStats] = useState({
    totalUsers: 0,
    vipUsers: 0,
    totalMedia: 0,
    totalViews: 0,
  });

  const [onlineUsers, setOnlineUsers] = useState<any[]>([]);
  const [dailyData, setDailyData] = useState<any[]>([]);
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [yearlyData, setYearlyData] = useState<any[]>([]);

  useEffect(() => {
    async function initStats() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session || session.user.email !== ADMIN_EMAIL) {
          router.push('/');
          return;
        }
        setAuthorized(true);

        // 1. Récupération des profils, médias et historique
        const [profilesRes, mediaRes, historyRes] = await Promise.all([
          supabase.from('profiles').select('is_vip'),
          supabase.from('media').select('id, title, type'),
          supabase.from('watch_history').select('updated_at, media_id, user_id'),
        ]);

        const profiles = profilesRes.data || [];
        const mediaList = mediaRes.data || [];
        const historyData = historyRes.data || [];

        setStats({
          totalUsers: profiles.length,
          vipUsers: profiles.filter(p => p.is_vip).length,
          totalMedia: mediaList.length,
          totalViews: historyData.length,
        });

        // 2. Récupération des utilisateurs en ligne
        const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
        const { data: onlineData } = await supabase
          .from('user_presence')
          .select('*')
          .gte('last_seen', twoMinutesAgo);

        // Associer le titre du média si l'utilisateur en regarde un
        const enrichedOnline = (onlineData || []).map(user => {
          let mediaTitle = null;
          if (user.current_media_id) {
            const found = mediaList.find(m => String(m.id) === String(user.current_media_id));
            if (found) mediaTitle = found.title;
          }
          return { ...user, mediaTitle };
        });

        setOnlineUsers(enrichedOnline);
        processCharts(historyData);

      } catch (err) {
        console.error('Erreur chargement stats :', err);
        router.push('/');
      } finally {
        setLoading(false);
      }
    }

    initStats();

    const interval = setInterval(async () => {
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
      const { data: onlineData } = await supabase.from('user_presence').select('*').gte('last_seen', twoMinutesAgo);
      const { data: mediaRes } = await supabase.from('media').select('id, title');
      const mediaList = mediaRes || [];

      const enrichedOnline = (onlineData || []).map(user => {
        let mediaTitle = null;
        if (user.current_media_id) {
          const found = mediaList.find((m: any) => String(m.id) === String(user.current_media_id));
          if (found) mediaTitle = found.title;
        }
        return { ...user, mediaTitle };
      });

      setOnlineUsers(enrichedOnline);
    }, 15000);

    return () => clearInterval(interval);
  }, [router]);

  const processCharts = (history: any[]) => {
    const daysMap: Record<string, number> = { 'Lun': 0, 'Mar': 0, 'Mer': 0, 'Jeu': 0, 'Ven': 0, 'Sam': 0, 'Dim': 0 };
    const dayNames = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

    const monthsMap: Record<string, number> = {
      'Jan': 0, 'Fév': 0, 'Mar': 0, 'Avr': 0, 'Mai': 0, 'Juin': 0,
      'Juil': 0, 'Août': 0, 'Sep': 0, 'Oct': 0, 'Nov': 0, 'Déc': 0
    };
    const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];

    const yearsMap: Record<string, number> = {};

    history.forEach(item => {
      if (!item.updated_at) return;
      const d = new Date(item.updated_at);
      
      const dayStr = dayNames[d.getDay()];
      if (daysMap[dayStr] !== undefined) daysMap[dayStr]++;

      const monthStr = monthNames[d.getMonth()];
      if (monthsMap[monthStr] !== undefined) monthsMap[monthStr]++;

      const yearStr = d.getFullYear().toString();
      yearsMap[yearStr] = (yearsMap[yearStr] || 0) + 1;
    });

    const orderedDays = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
    setDailyData(orderedDays.map(d => ({ name: d, visions: daysMap[d] })));

    const orderedMonths = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
    setMonthlyData(orderedMonths.map(m => ({ name: m, visions: monthsMap[m] })));

    setYearlyData(Object.keys(yearsMap).map(y => ({ name: y, visions: yearsMap[y] })));
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-[#0a0a0b] text-white flex items-center justify-center">
        <p className="text-zinc-400 text-sm animate-pulse">Chargement des statistiques détaillées...</p>
      </main>
    );
  }

  if (!authorized) return null;

  return (
    <main className="min-h-screen bg-[#0a0a0b] text-white p-6 sm:p-10 font-sans pb-24">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* En-tête */}
        <div className="flex items-center justify-between border-b border-white/10 pb-5">
          <div>
            <h1 className="text-2xl font-black tracking-tight">Statistiques & Activité en Direct</h1>
            <p className="text-sm text-zinc-400 mt-1">Suivi détaillé de ce que font les utilisateurs sur le site</p>
          </div>
          <button
            onClick={() => router.push('/admin')}
            className="bg-white/15 hover:bg-white/25 text-white px-4 py-2 rounded-full text-xs font-semibold transition cursor-pointer"
          >
            Retour Admin
          </button>
        </div>

        {/* Section ACTIVITÉ EN DIRECT */}
        <div className="bg-gradient-to-r from-red-950/40 via-[#111114] to-[#111114] border border-red-500/30 rounded-3xl p-6 sm:p-8 space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="relative flex h-3.5 w-3.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-red-600"></span>
              </span>
              <h2 className="text-lg font-bold">Activité des utilisateurs en direct</h2>
            </div>
            <span className="px-3 py-1 rounded-full bg-red-600/20 text-red-400 font-mono text-sm font-bold border border-red-500/30">
              {onlineUsers.length} en ligne
            </span>
          </div>

          {onlineUsers.length === 0 ? (
            <p className="text-sm text-zinc-500 py-2">Aucun utilisateur actif pour le moment.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
              {onlineUsers.map((user, idx) => (
                <div key={idx} className="bg-black/40 border border-white/10 rounded-2xl p-4 space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-red-600/20 text-red-400 flex items-center justify-center font-bold text-xs shrink-0">
                      {(user.email || 'U')[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-white truncate">{user.email || 'Anonyme'}</p>
                      <p className="text-[10px] text-zinc-400">{user.current_action || 'En navigation'}</p>
                    </div>
                  </div>
                  {user.mediaTitle && (
                    <div className="bg-red-600/10 border border-red-500/20 rounded-xl px-3 py-1.5 text-xs text-red-300 font-medium truncate">
                      🎬 Regarde : <span className="font-bold text-white">{user.mediaTitle}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Cartes globales */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-[#111114] border border-white/10 rounded-3xl p-6 space-y-2 shadow-lg">
            <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Utilisateurs inscrits</p>
            <p className="text-3xl font-black text-white">{stats.totalUsers}</p>
          </div>
          <div className="bg-[#111114] border border-white/10 rounded-3xl p-6 space-y-2 shadow-lg">
            <p className="text-xs font-medium text-amber-400 uppercase tracking-wider">Membres VIP</p>
            <p className="text-3xl font-black text-amber-400">{stats.vipUsers}</p>
          </div>
          <div className="bg-[#111114] border border-white/10 rounded-3xl p-6 space-y-2 shadow-lg">
            <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Catalogue total</p>
            <p className="text-3xl font-black text-white">{stats.totalMedia}</p>
          </div>
          <div className="bg-[#111114] border border-white/10 rounded-3xl p-6 space-y-2 shadow-lg">
            <p className="text-xs font-medium text-red-500 uppercase tracking-wider">Total lectures globales</p>
            <p className="text-3xl font-black text-white">{stats.totalViews}</p>
          </div>
        </div>

        {/* Graphiques détaillés (Jour, Mois, Année) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-[#111114] border border-white/10 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl">
            <div>
              <h2 className="text-base font-bold">Visions par jour (Semaine)</h2>
              <p className="text-xs text-zinc-400 mt-0.5">Nombre de lancements sur les 7 derniers jours</p>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyData}>
                  <defs>
                    <linearGradient id="colorVisions" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                  <XAxis dataKey="name" stroke="#71717a" tick={{ fontSize: 12 }} />
                  <YAxis stroke="#71717a" tick={{ fontSize: 12 }} allowDecimals={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '12px', color: '#fff' }} />
                  <Area type="monotone" dataKey="visions" stroke="#ef4444" strokeWidth={3} fillOpacity={1} fill="url(#colorVisions)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-[#111114] border border-white/10 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl">
            <div>
              <h2 className="text-base font-bold">Visions par mois (Année)</h2>
              <p className="text-xs text-zinc-400 mt-0.5">Évolution mensuelle des visionnages</p>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                  <XAxis dataKey="name" stroke="#71717a" tick={{ fontSize: 12 }} />
                  <YAxis stroke="#71717a" tick={{ fontSize: 12 }} allowDecimals={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '12px', color: '#fff' }} />
                  <Bar dataKey="visions" fill="#ef4444" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

      </div>
    </main>
  );
}