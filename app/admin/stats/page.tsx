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
    freeUsers: 0,
    totalMedia: 0,
    totalMoviesCount: 0,
    totalSeriesCount: 0,
    totalViews: 0,
    vipConversionRate: '0',
    avgViewsPerUser: '0',
  });

  const [onlineUsers, setOnlineUsers] = useState<any[]>([]);
  const [topMedia, setTopMedia] = useState<any[]>([]);
  const [genresData, setGenresData] = useState<any[]>([]);
  const [dailyData, setDailyData] = useState<any[]>([]);
  const [monthlyData, setMonthlyData] = useState<any[]>([]);

  useEffect(() => {
    async function initStats() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session || session.user.email !== ADMIN_EMAIL) {
          router.push('/');
          return;
        }
        setAuthorized(true);

        const [profilesRes, mediaRes, historyRes] = await Promise.all([
          supabase.from('profiles').select('*'),
          supabase.from('media').select('*'),
          supabase.from('watch_history').select('*'),
        ]);

        const profiles = profilesRes.data || [];
        const mediaList = mediaRes.data || [];
        const historyData = historyRes.data || [];

        const totalUsers = profiles.length;
        const vipUsers = profiles.filter(p => p.is_vip === true || p.is_vip === 'true').length;
        const freeUsers = totalUsers - vipUsers;
        const vipConversionRate = totalUsers > 0 ? ((vipUsers / totalUsers) * 100).toFixed(1) : '0';
        const avgViewsPerUser = totalUsers > 0 ? (historyData.length / totalUsers).toFixed(1) : '0';

        let totalMoviesCount = 0;
        let totalSeriesCount = 0;
        const mediaViewsCount: Record<string, number> = {};
        const genresCount: Record<string, number> = {};

        historyData.forEach(h => {
          // Recherche souple du média lié à l'historique
          const mediaId = h.media_id || h.movie_id || h.id;
          const media = mediaList.find(m => String(m.id) === String(mediaId));
          
          if (media) {
            const mediaType = (media.type || '').toLowerCase();
            if (mediaType.includes('movie') || mediaType === 'film') {
              totalMoviesCount++;
            } else {
              totalSeriesCount++;
            }

            const title = media.title || media.name || 'Média sans titre';
            mediaViewsCount[title] = (mediaViewsCount[title] || 0) + 1;

            // Gestion du tableau de genres (genres) ou string (genre)
            const mediaGenres = media.genres || media.genre;
            if (Array.isArray(mediaGenres) && mediaGenres.length > 0) {
              mediaGenres.forEach(g => {
                genresCount[g] = (genresCount[g] || 0) + 1;
              });
            } else if (typeof mediaGenres === 'string' && mediaGenres.trim() !== '') {
              genresCount[mediaGenres] = (genresCount[mediaGenres] || 0) + 1;
            } else {
              genresCount['Inconnu'] = (genresCount['Inconnu'] || 0) + 1;
            }
          } else {
            totalMoviesCount++;
          }
        });

        const sortedTopMedia = Object.entries(mediaViewsCount)
          .map(([title, count]) => ({ title, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);
        setTopMedia(sortedTopMedia);

        const sortedGenres = Object.entries(genresCount)
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);
        setGenresData(sortedGenres);

        setStats({
          totalUsers,
          vipUsers,
          freeUsers,
          totalMedia: mediaList.length,
          totalMoviesCount,
          totalSeriesCount,
          totalViews: historyData.length,
          vipConversionRate,
          avgViewsPerUser,
        });

        const twoMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        const { data: onlineData } = await supabase
          .from('user_presence')
          .select('*')
          .gte('last_seen', twoMinutesAgo);

        const enrichedOnline = (onlineData || []).map(user => {
          let mediaTitle = null;
          if (user.current_media_id) {
            const found = mediaList.find(m => String(m.id) === String(user.current_media_id));
            if (found) mediaTitle = found.title || found.name;
          }
          return { ...user, mediaTitle };
        });

        setOnlineUsers(enrichedOnline);
        processCharts(historyData);

      } catch (err) {
        console.error('Erreur chargement stats :', err);
      } finally {
        setLoading(false);
      }
    }

    initStats();

    const interval = setInterval(async () => {
      const twoMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { data: onlineData } = await supabase.from('user_presence').select('*').gte('last_seen', twoMinutesAgo);
      const { data: mediaRes } = await supabase.from('media').select('*');
      const mediaList = mediaRes || [];

      const enrichedOnline = (onlineData || []).map(user => {
        let mediaTitle = null;
        if (user.current_media_id) {
          const found = mediaList.find((m: any) => String(m.id) === String(user.current_media_id));
          if (found) mediaTitle = found.title || found.name;
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

    history.forEach(item => {
      const dateVal = item.updated_at || item.created_at || item.watched_at;
      if (!dateVal) return;
      const d = new Date(dateVal);
      
      const dayStr = dayNames[d.getDay()];
      if (daysMap[dayStr] !== undefined) daysMap[dayStr]++;

      const monthStr = monthNames[d.getMonth()];
      if (monthsMap[monthStr] !== undefined) monthsMap[monthStr]++;
    });

    const orderedDays = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
    setDailyData(orderedDays.map(d => ({ name: d, visions: daysMap[d] })));

    const orderedMonths = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
    setMonthlyData(orderedMonths.map(m => ({ name: m, visions: monthsMap[m] })));
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-[#0a0a0b] text-white flex items-center justify-center">
        <p className="text-zinc-400 text-sm animate-pulse">Chargement de toutes les statistiques...</p>
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
            <h1 className="text-2xl font-black tracking-tight">Statistiques Globales & Historique YAMONFILM</h1>
            <p className="text-sm text-zinc-400 mt-1">Tableau de bord complet de l'activité du site</p>
          </div>
          <button
            onClick={() => router.push('/admin')}
            className="bg-white/15 hover:bg-white/25 text-white px-4 py-2 rounded-full text-xs font-semibold transition cursor-pointer"
          >
            Retour Admin
          </button>
        </div>

        {/* Section EN DIRECT */}
        <div className="bg-gradient-to-r from-red-950/40 via-[#111114] to-[#111114] border border-red-500/30 rounded-3xl p-6 sm:p-8 space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="relative flex h-3.5 w-3.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-red-600"></span>
              </span>
              <h2 className="text-lg font-bold">Utilisateurs connectés en direct</h2>
            </div>
            <span className="px-3 py-1 rounded-full bg-red-600/20 text-red-400 font-mono text-sm font-bold border border-red-500/30">
              {onlineUsers.length} en ligne
            </span>
          </div>

          {onlineUsers.length === 0 ? (
            <p className="text-sm text-zinc-500 py-2">Aucun utilisateur actif détecté pour le moment.</p>
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

        {/* Cartes de métriques globales */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-[#111114] border border-white/10 rounded-3xl p-6 space-y-2 shadow-lg">
            <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Utilisateurs</p>
            <p className="text-3xl font-black text-white">{stats.totalUsers}</p>
          </div>
          <div className="bg-[#111114] border border-white/10 rounded-3xl p-6 space-y-2 shadow-lg">
            <p className="text-xs font-medium text-amber-400 uppercase tracking-wider">Membres VIP</p>
            <div className="flex items-baseline justify-between">
              <p className="text-3xl font-black text-amber-400">{stats.vipUsers}</p>
              <span className="text-xs text-amber-500 font-bold">{stats.vipConversionRate}%</span>
            </div>
          </div>
          <div className="bg-[#111114] border border-white/10 rounded-3xl p-6 space-y-2 shadow-lg">
            <p className="text-xs font-medium text-blue-400 uppercase tracking-wider">Films regardés</p>
            <p className="text-3xl font-black text-blue-400">{stats.totalMoviesCount}</p>
          </div>
          <div className="bg-[#111114] border border-white/10 rounded-3xl p-6 space-y-2 shadow-lg">
            <p className="text-xs font-medium text-purple-400 uppercase tracking-wider">Séries regardées</p>
            <p className="text-3xl font-black text-purple-400">{stats.totalSeriesCount}</p>
          </div>
        </div>

        {/* Top 5 & Genres */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-[#111114] border border-white/10 rounded-3xl p-6 sm:p-8 space-y-4 shadow-xl">
            <h2 className="text-base font-bold">🔥 Top 5 des contenus les plus regardés</h2>
            {topMedia.length === 0 ? (
              <p className="text-xs text-zinc-500 py-4">Aucune donnée d'historique.</p>
            ) : (
              <div className="space-y-3 pt-2">
                {topMedia.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-white/5 border border-white/5 rounded-2xl px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-black text-red-500">#{idx + 1}</span>
                      <span className="text-sm font-semibold text-white">{item.title}</span>
                    </div>
                    <span className="text-xs font-mono text-zinc-400 bg-black/40 px-3 py-1 rounded-full">{item.count} vues</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-[#111114] border border-white/10 rounded-3xl p-6 sm:p-8 space-y-4 shadow-xl">
            <h2 className="text-base font-bold">📊 Genres les plus regardés</h2>
            {genresData.length === 0 ? (
              <p className="text-xs text-zinc-500 py-4">Aucun genre enregistré.</p>
            ) : (
              <div className="space-y-3 pt-2">
                {genresData.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-white/5 border border-white/5 rounded-2xl px-4 py-3">
                    <span className="text-sm font-semibold text-white">{item.name}</span>
                    <span className="text-xs font-mono text-zinc-400 bg-black/40 px-3 py-1 rounded-full">{item.count} lancements</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Graphiques */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-[#111114] border border-white/10 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl">
            <div>
              <h2 className="text-base font-bold">Trafic de la semaine (Historique global)</h2>
              <p className="text-xs text-zinc-400 mt-0.5">Lancements par jour</p>
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
              <h2 className="text-base font-bold">Activité par mois</h2>
              <p className="text-xs text-zinc-400 mt-0.5">Évolution mensuelle</p>
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