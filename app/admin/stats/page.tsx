'use client';

import SectionNavigation from '@/components/SectionNavigation';
import PageHero from '@/components/PageHero';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { buildAnalytics, buildConnections, mergePresenceToday, recoverHistoricalConnections, dayKey, dateValue, isVip, percent, vipExpiry, emptyDataset, type Dataset, type Presence, type ContentType, type DailyActivity } from './analytics';

const ADMIN_EMAIL = 'lukas.leclerc312@gmail.com';
const number = (n: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(n);
const pct = (n: number) => `${number(n)} %`;
const dateLabel = (value: string | number) => new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
const shortDate = (key: string) => new Date(`${key}T12:00:00Z`).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', timeZone: 'Europe/Paris' });
const panel = 'rounded-2xl border border-white/[0.08] bg-[#121319] p-5 sm:p-6';
const button = 'inline-flex items-center justify-center rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-zinc-300 transition hover:bg-white/10 hover:text-white disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-red-400';
type SourceKey = keyof Dataset | 'daily';
type Issues = Partial<Record<SourceKey | 'presence', string>>;
const sources: { key: SourceKey; table: string; order: string[]; label: string }[] = [
  { key: 'profiles', table: 'profiles', order: ['id'], label: 'Comptes' },
  { key: 'media', table: 'media', order: ['id'], label: 'Catalogue' },
  { key: 'history', table: 'watch_history', order: ['user_id', 'profile_id', 'media_id'], label: 'Progressions' },
  { key: 'requests', table: 'requests', order: ['id'], label: 'Demandes' },
  { key: 'banners', table: 'banners', order: ['id'], label: 'Bannières' },
  { key: 'promotions', table: 'promotions', order: ['id'], label: 'Promotions' },
  { key: 'comments', table: 'comments', order: ['id'], label: 'Commentaires' },
  { key: 'daily', table: 'user_daily_activity', order: ['activity_date', 'user_id'], label: 'Présence quotidienne' },
];
// Read every page, including when the server imposes a lower row limit.
async function readTable(table: string, columns: string[], signal: AbortSignal, seenAfter?: string, activityDate?: string): Promise<unknown[]> {
  const rows: unknown[] = [];
  let total = Infinity;
  while (rows.length < total) {
    let query = supabase.from(table).select('*', { count: 'exact' });
    if (seenAfter) query = query.gte('last_seen', seenAfter);
    if (activityDate) query = query.eq('activity_date', activityDate);
    for (const column of columns) query = query.order(column, { ascending: true });
    const { data, error, count } = await query.range(rows.length, rows.length + 499).abortSignal(signal);
    if (error) throw new Error(error.message);
    if (signal.aborted) throw new Error('Chargement annulé');
    if (count !== null) total = count;
    if (!data?.length) { if (rows.length < total && total !== Infinity) throw new Error('Lecture incomplète : actualisez les données.'); break; }
    rows.push(...data);
    if (count === null && data.length < 500) break;
  }
  return rows;
}
function Metric({ label, value, note, accent = false }: { label: string; value: string | number; note?: string; accent?: boolean }) {
  return <article className={`${panel} ${accent ? 'border-red-400/20 bg-gradient-to-br from-red-500/10 to-[#121319]' : ''}`}><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400">{label}</p><p className={`mt-3 text-3xl font-semibold tracking-tight ${accent ? 'text-red-300' : 'text-white'}`}>{typeof value === 'number' ? number(value) : value}</p>{note && <p className="mt-2 text-[11px] leading-5 text-zinc-500">{note}</p>}</article>;
}
function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return <section className={panel}><h2 className="text-base font-semibold tracking-tight">{title}</h2>{description && <p className="mt-1 text-xs leading-5 text-zinc-500">{description}</p>}<div className="mt-5">{children}</div></section>;
}
function Empty({ text = 'Aucune donnée pour cette sélection.' }: { text?: string }) { return <p className="flex min-h-24 items-center justify-center rounded-xl border border-dashed border-white/10 p-5 text-center text-xs leading-6 text-zinc-500">{text}</p>; }
function Chart({ data, bars = false, fields = [{ key: 'records', label: 'Progressions', color: '#fb7185' }], dates = false }: { data: object[]; bars?: boolean; fields?: { key: string; label: string; color: string }[]; dates?: boolean }) {
  const grid = <><CartesianGrid vertical={false} stroke="#272832" strokeDasharray="3 5" /><XAxis dataKey="name" tickFormatter={dates ? shortDate : undefined} stroke="#777985" tick={{ fontSize: 10 }} minTickGap={25} tickLine={false} axisLine={false} /><YAxis allowDecimals={false} stroke="#777985" tick={{ fontSize: 10 }} width={35} tickLine={false} axisLine={false} /><Tooltip labelFormatter={dates ? label => shortDate(String(label)) : undefined} contentStyle={{ background: '#191a22', border: '1px solid #363742', borderRadius: 12, fontSize: 12, color: '#eee' }} /><Legend wrapperStyle={{ fontSize: 11, paddingTop: 14 }} /></>;
  return <div className="h-64 w-full min-w-0" role="img" aria-label={`Graphique : ${fields.map(f => f.label).join(', ')}`}><ResponsiveContainer width="100%" height="100%">{bars ? <BarChart data={data}>{grid}{fields.map(f => <Bar key={f.key} dataKey={f.key} name={f.label} fill={f.color} radius={[4, 4, 0, 0]} isAnimationActive={false} />)}</BarChart> : <AreaChart data={data}>{grid}{fields.map(f => <Area key={f.key} type="monotone" dataKey={f.key} name={f.label} stroke={f.color} fill={f.color} fillOpacity={.08} strokeWidth={2} isAnimationActive={false} />)}</AreaChart>}</ResponsiveContainer></div>;
}
function change(value: number, previous: number) { return previous ? `${value >= previous ? '+' : ''}${number((value - previous) / previous * 100)} % vs période précédente` : value ? 'Aucune base sur la période précédente' : 'Aucune activité sur les deux périodes'; }
function download(name: string, content: string, type: string) { const url = URL.createObjectURL(new Blob([content], { type })); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
const csvCell = (value: unknown) => { let text = String(value ?? ''); if (/^[=+@\-\t\r]/.test(text)) text = `'${text}`; return `"${text.replaceAll('"', '""')}"`; };

export default function AdminStatsPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<Dataset>(emptyDataset);
  const [daily, setDaily] = useState<DailyActivity[]>([]);
  const [observedDaily, setObservedDaily] = useState<DailyActivity[]>([]);
  const [presence, setPresence] = useState<Presence[]>([]);
  const [issues, setIssues] = useState<Issues>({});
  const [fatal, setFatal] = useState('');
  const [updated, setUpdated] = useState<number | null>(null);
  const [presenceUpdated, setPresenceUpdated] = useState<number | null>(null);
  const [dailyUpdated, setDailyUpdated] = useState<number | null>(null);
  const [pastPresence, setPastPresence] = useState<Presence[]>([]);
  const [days, setDays] = useState(30);
  const [type, setType] = useState<ContentType>('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('count');
  const [page, setPage] = useState(0);
  const [now, setNow] = useState(0);
  const [auto, setAuto] = useState(true);
  const controller = useRef<AbortController | null>(null);
  const presenceController = useRef<AbortController | null>(null);
  const busy = useRef(false);
  const liveBusy = useRef(false);

  const load = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    const abort = new AbortController(); controller.current = abort;
    setRefreshing(true); setFatal('');
    try {
      const { data: auth, error } = await supabase.auth.getSession();
      if (abort.signal.aborted) return;
      if (error) throw error;
      if (auth.session?.user.email !== ADMIN_EMAIL) { setAuthorized(false); router.replace('/'); return; }
      setAuthorized(true);
      const results = await Promise.allSettled(sources.map(source => readTable(source.table, source.order, abort.signal)));
      if (abort.signal.aborted) return;
      const next = { ...emptyDataset };
      const nextIssues: Issues = {};
      let nextDaily: DailyActivity[] = [];
      results.forEach((result, i) => {
        const source = sources[i];
        if (result.status === 'rejected') nextIssues[source.key] = result.reason instanceof Error ? result.reason.message : 'Source indisponible';
        else if (source.key === 'daily') nextDaily = result.value as DailyActivity[];
        else Object.assign(next, { [source.key]: result.value });
      });
      setData(next); setDaily(nextDaily);
      if (!nextIssues.daily) setDailyUpdated(Date.now());
      setIssues(previous => ({ ...nextIssues, ...(previous.presence ? { presence: previous.presence } : {}) }));
      const stamp = Date.now(); setUpdated(stamp); setNow(stamp);
    } catch (error) { if (!abort.signal.aborted) setFatal(error instanceof Error ? error.message : 'Impossible de charger les statistiques.'); }
    finally { if (controller.current === abort) busy.current = false; if (!abort.signal.aborted) { setLoading(false); setRefreshing(false); } }
  }, [router]);
  const loadPresence = useCallback(async () => {
    if (liveBusy.current) return;
    liveBusy.current = true;
    const abort = new AbortController(); presenceController.current = abort;
    try {
      const { data: auth } = await supabase.auth.getSession();
      if (abort.signal.aborted) return;
      if (auth.session?.user.email !== ADMIN_EMAIL) { setAuthorized(false); router.replace('/'); return; }
      const today = dayKey(new Date());
      const results = await Promise.allSettled([
        readTable('user_presence', ['user_id'], abort.signal),
        readTable('user_daily_activity', ['activity_date', 'user_id'], abort.signal, undefined, today),
      ]);
      if (abort.signal.aborted) return;
      const [liveResult, dailyResult] = results;
      if (liveResult.status === 'fulfilled') {
        const rows = liveResult.value as Presence[];
        setPresence(rows); setPastPresence(rows); setPresenceUpdated(Date.now());
        setObservedDaily(previous => mergePresenceToday(previous, rows, Date.now()));
      }
      if (dailyResult.status === 'fulfilled') {
        setDaily(previous => [...previous.filter(row => row.activity_date !== today), ...dailyResult.value as DailyActivity[]]);
        setDailyUpdated(Date.now());
      }
      setNow(Date.now());
      setIssues(previous => {
        const copy = { ...previous };
        for (const [key, result] of [['presence', liveResult], ['daily', dailyResult]] as const) {
          if (result.status === 'fulfilled') delete copy[key];
          else copy[key] = result.reason instanceof Error ? result.reason.message : 'Source indisponible';
        }
        return copy;
      });
    } catch (error) { if (!abort.signal.aborted) setIssues(previous => ({ ...previous, presence: error instanceof Error ? error.message : 'Présence indisponible' })); }
    finally { if (presenceController.current === abort) liveBusy.current = false; }
  }, [router]);
  useEffect(() => { void load(); return () => { controller.current?.abort(); busy.current = false; }; }, [load]);
  useEffect(() => {
    if (!authorized) return;
    void loadPresence();
    if (!auto) return () => { presenceController.current?.abort(); liveBusy.current = false; };
    const timer = setInterval(() => { if (document.visibilityState === 'visible') void loadPresence(); }, 15000);
    const totals = setInterval(() => { if (document.visibilityState === 'visible') void load(); }, 60000);
    return () => { clearInterval(timer); clearInterval(totals); presenceController.current?.abort(); liveBusy.current = false; };
  }, [authorized, auto, loadPresence, load]);

  const analytics = useMemo(() => buildAnalytics(data, days, type, now), [data, days, type, now]);
  const combinedDaily = useMemo(() => mergePresenceToday([...daily, ...observedDaily], presence, now), [daily, observedDaily, presence, now]);
  const connections = useMemo(() => buildConnections(combinedDaily, analytics.timeline, analytics.start, now), [combinedDaily, analytics.timeline, analytics.start, now]);
  const supplementedToday = connections.today - new Set(daily.filter(row => row.activity_date === analytics.today).map(row => row.user_id)).size;
  const recovered = useMemo(() => recoverHistoricalConnections(data.history, pastPresence, now), [data.history, pastPresence, now]);
  const recoveredPeriod = recovered.days.filter(day => (!days || day.name >= analytics.start) && day.name <= analytics.today);
  const exportRecovered = () => {
    const lines: unknown[][] = [['Date (Paris)', 'Comptes retrouvés (minimum, historique incomplet)'], ...recoveredPeriod.map(day => [day.name, day.connections])];
    download(`yamonfim-historique-retrouve-${analytics.today}.csv`, '\ufeff' + lines.map(row => row.map(csvCell).join(';')).join('\r\n'), 'text/csv;charset=utf-8');
  };
  const rows = useMemo(() => analytics.ranked.filter(m => (m.title ?? '').toLocaleLowerCase('fr').includes(query.toLocaleLowerCase('fr'))).sort((a, b) => sort === 'title' ? (a.title ?? '').localeCompare(b.title ?? '', 'fr') : sort === 'audience' ? b.audience - a.audience : sort === 'least' ? a.count - b.count : b.count - a.count), [analytics.ranked, query, sort]);
  const totalPages = Math.max(1, Math.ceil(rows.length / 10));
  const currentPage = Math.min(page, totalPages - 1);
  const totalVip = data.profiles.filter(isVip).length;
  const online = [...new Map(presence.filter(p => { const stamp = dateValue(p.last_seen); return stamp !== null && stamp >= now - 5 * 60_000 && stamp <= now + 60_000; }).map(p => [p.user_id, p])).values()];
  const expired = data.profiles.filter(p => isVip(p) && (vipExpiry(p) ?? Infinity) <= now).length;
  const expiring = data.profiles.filter(p => { const end = vipExpiry(p); return isVip(p) && end !== null && end > now && end <= now + 7 * 86400000; }).length;
  const undatedVip = data.profiles.filter(p => isVip(p) && vipExpiry(p) === null).length;
  const rangeLabel = days ? `${days} derniers jours` : 'Tout l’historique';
  const available = (key: SourceKey, value: number | string) => issues[key] ? key === 'daily' && combinedDaily.length && typeof value === 'number' ? `≥ ${number(value)}` : '—' : value;
  const historyAvailable = (value: number | string) => available('history', value);
  const coverageAvailable = (value: number | string) => issues.history || issues.media ? '—' : value;
  const exportCsv = () => {
    const lines: unknown[][] = [['Titre', 'Type', 'Progressions enregistrées', 'Comptes distincts', 'Progressions ≥ 90 % (%)'], ...rows.map(m => [m.title, m.type, m.count, m.audience, m.completion === null ? '' : m.completion.toFixed(1)])];
    download(`yamonfim-statistiques-${analytics.today}.csv`, '\ufeff' + lines.map(row => row.map(csvCell).join(';')).join('\r\n'), 'text/csv;charset=utf-8');
  };
  const exportJson = () => download(`yamonfim-donnees-${analytics.today}.json`, JSON.stringify({ exportedAt: new Date().toISOString(), loadedAt: updated ? new Date(updated).toISOString() : null, timezone: 'Europe/Paris', unavailableSources: issues, scope: 'Tables chargées dans le tableau de bord, pas une sauvegarde complète de la base', ...data, dailyActivity: daily, dailyActivityReconciled: combinedDaily, presence }, null, 2), 'application/json');
  const exportDaily = () => {
    const lines: unknown[][] = [['Date (Paris)', 'Comptes connectés uniques', 'Progressions mises à jour', 'Comptes avec progression', 'Nouveaux comptes'], ...analytics.timeline.filter(t => connections.firstDay && t.name >= connections.firstDay).map(t => [t.name, connections.trend.find(c => c.name === t.name)?.connections ?? 0, issues.history ? '' : t.records, issues.history ? '' : t.accounts, issues.profiles ? '' : t.signups])];
    download(`yamonfim-audience-quotidienne-${analytics.today}.csv`, '\ufeff' + lines.map(row => row.map(csvCell).join(';')).join('\r\n'), 'text/csv;charset=utf-8');
  };

  if (loading) return <main className="yf-page yf-stats grid min-h-screen place-items-center bg-[#0b0c10] p-8 text-sm text-zinc-400">Chargement de votre tableau de bord…</main>;
  if (!authorized) return fatal ? <main className="yf-page yf-stats grid min-h-screen place-items-center bg-[#0b0c10] p-8 text-white"><div role="alert"><p>{fatal}</p><button className={`${button} mt-4`} onClick={() => void load()}>Réessayer</button></div></main> : null;
  return (
    <main className="yf-page yf-stats min-h-screen bg-[#0b0c10] pb-16 font-sans text-zinc-100 selection:bg-red-500/30">
      <nav className="yf-topbar border-b border-white/[0.07] px-5 sm:px-10" aria-label="Administration"><div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-4 py-5"><Link href="/" className="text-lg font-black tracking-tight text-red-500">YAMON<span className="text-white">FIM</span><span className="ml-3 border-l border-white/20 pl-3 text-[9px] font-medium tracking-[0.18em] text-zinc-500">ANALYTICS</span></Link><div className="flex flex-wrap gap-4 text-xs text-zinc-400"><Link href="/">Accueil ↗</Link><Link href="/admin">Catalogue</Link><Link href="/admin/banners">Bannières</Link><Link href="/admin-vip">Admin VIP</Link></div></div></nav>
      <SectionNavigation admin />
      <div className="mx-auto max-w-[1500px] space-y-7 px-5 pt-9 sm:px-10">
        <PageHero eyebrow="LES CHIFFRES DERRIÈRE L’ÉCRAN" title="Ton site en chiffres." accent="Et en perspective." description="L’audience du jour, les connexions et les contenus qui attirent les regards : retrouve les indicateurs utiles à ta programmation." cardLabel="LES STATISTIQUES" cardTitle="Chaque visite compte." cardDetail="AUDIENCE · CATALOGUE · MEMBRES" variant="chart" />
        <header className="flex flex-col justify-between gap-5 xl:flex-row xl:items-center"><div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-red-400">LES CHIFFRES DERRIÈRE L’ÉCRAN</p><h2 className="mt-2 text-base font-semibold">Tableau de bord</h2><p className="mt-3 text-xs leading-6 text-zinc-500">{updated ? `Données chargées le ${dateLabel(updated)} · Europe/Paris` : 'En attente de données'} · Actualisation des totaux chaque minute.</p></div><div className="flex flex-wrap gap-2"><label className={`${button} cursor-pointer gap-2`}><input type="checkbox" checked={auto} onChange={e => setAuto(e.target.checked)} className="accent-red-500" />Actualisation auto</label><button onClick={() => { void load(); void loadPresence(); }} disabled={refreshing} className={button}>{refreshing ? 'Actualisation…' : '↻ Actualiser'}</button><button onClick={exportJson} disabled={!updated || refreshing} className={button}>Exporter JSON</button></div></header>
        {fatal && <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{fatal}</p>}
        {Object.keys(issues).length > 0 && <div role="status" className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4 text-xs leading-6 text-amber-200"><p className="font-semibold">Certaines sources sont indisponibles. Les indicateurs concernés affichent « — », ou « ≥ » pour un minimum retrouvé.</p>{Object.entries(issues).map(([key, message]) => <p key={key}>{sources.find(s => s.key === key)?.label ?? 'Présence en direct'} : {message}</p>)}{issues.daily && <p className="mt-2">Le suivi quotidien nécessite l’installation du script <code>supabase/migrations/20261020_daily_activity.sql</code>. Les anciennes connexions ne peuvent pas être reconstituées.</p>}</div>}
        <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-white/[0.08] bg-[#121319] p-3" aria-label="Filtres"><div className="flex flex-wrap gap-1">{[7, 30, 90, 365, 0].map(value => <button key={value} onClick={() => { setDays(value); setPage(0); }} aria-pressed={days === value} className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${days === value ? 'bg-red-500/15 text-red-300' : 'text-zinc-500 hover:text-white'}`}>{value ? `${value} jours` : 'Tout'}</button>)}</div><label className="flex items-center gap-3 text-xs text-zinc-500">Contenus<select className="rounded-lg border border-white/10 bg-[#1a1b23] px-3 py-2 text-zinc-200" value={type} onChange={e => { setType(e.target.value as ContentType); setPage(0); }}><option value="all">Films et séries</option><option value="movie">Films</option><option value="series">Séries</option></select></label></section>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-[11px] leading-6 text-zinc-400"><strong className="text-zinc-200">Comment lire ces chiffres ?</strong> Une « progression » est la dernière position sauvegardée d’un profil sur un titre. Les reprises écrasent cette ligne : ce ne sont ni des vues totales, ni des sessions. Les graphiques d’activité utilisent sa dernière mise à jour. Le filtre de contenu concerne les progressions et le catalogue ; les connexions et les comptes restent globaux.</div>
        <section className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-semibold">Connexions & audience quotidienne</h2><p className="text-[10px] text-zinc-500">Un compte présent compte une seule fois par jour.</p></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Connectés aujourd’hui" value={available('daily', connections.today)} note={issues.daily ? 'Suivi à installer' : `${connections.yesterday} hier · présence authentifiée`} accent /><Metric label="Actifs sur 7 jours" value={available('daily', connections.week)} note="Comptes distincts, tous contenus" /><Metric label="Actifs sur 30 jours" value={available('daily', connections.month)} note="Un compte compte une seule fois" /><Metric label="Connectés sur la période" value={available('daily', connections.selected)} note={rangeLabel} /></div><div className="grid gap-5 xl:grid-cols-[2fr_1fr]"><Section title="Connectés uniques par jour" description={connections.firstDay ? `Première présence enregistrée le ${shortDate(connections.firstDay)}. ${days ? rangeLabel : 'Graphique limité aux 365 derniers jours'}.` : 'Le suivi commencera après installation et première visite.'}>{issues.daily || !daily.length ? <Empty text={issues.daily ? 'Le suivi quotidien n’est pas encore disponible.' : 'Aucune présence quotidienne enregistrée pour le moment.'} /> : <Chart data={connections.trend.filter(t => t.name >= connections.firstDay)} dates fields={[{ key: 'connections', label: 'Comptes connectés', color: '#fb7185' }]} />}</Section><Section title="Habitudes de retour" description="Indicateurs de présence, indépendants des lectures."><dl className="space-y-5 text-xs">{[['Moyenne quotidienne sur les jours suivis', available('daily', number(connections.average))], ['Pic quotidien dans la période', available('daily', connections.peak.name ? `${connections.peak.connections} · ${shortDate(connections.peak.name)}` : '—')], ['Présents hier et aujourd’hui', available('daily', connections.returning)], ['Retour des comptes présents hier', available('daily', connections.yesterday ? pct(connections.retention) : '—')], ['Actifs du jour / actifs sur 30 jours', available('daily', connections.month ? pct(connections.stickiness) : '—')]].map(([label, value]) => <div key={String(label)} className="flex items-start justify-between gap-4 border-b border-white/5 pb-3"><dt className="text-zinc-500">{label}</dt><dd className="shrink-0 font-semibold text-zinc-100">{value}</dd></div>)}</dl></Section></div></section>
        {supplementedToday > 0 && <p role="status" className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs leading-6 text-amber-200">Le total du jour inclut {supplementedToday} compte(s) détecté(s) sur le site mais absent(s) du relevé quotidien. Pour les conserver automatiquement, installez le correctif <code>20261020_sync_presence_daily.sql</code> dans Supabase.</p>}
        <Section title="Votre audience en direct" description={`${auto ? 'Relevé automatique toutes les 15 secondes' : 'Actualisation automatique en pause'}${dailyUpdated ? ` · compteur quotidien relevé à ${dateLabel(dailyUpdated)}` : ''}. Présences détectées par le site toutes les 20 secondes.`}>
          <div className="grid gap-3 sm:grid-cols-2"><Metric label="Personnes connectées aujourd’hui" value={available('daily', connections.today)} note="Total de comptes distincts depuis minuit, heure de Paris" accent /><Metric label="Présents en ce moment" value={issues.presence ? '—' : online.length} note="Comptes ayant envoyé un signal au cours des 5 dernières minutes" /></div>
        </Section>
        <Section title="Connexions retrouvées depuis les premières traces" description={recovered.firstDay ? `Première trace disponible : ${shortDate(recovered.firstDay)} ${recovered.firstDay.slice(0, 4)}. Historique et dernières présences conservés ; ces nombres constituent un minimum documenté.` : 'Recherche des traces déjà enregistrées dans l’historique et les présences.'}>
          <p className="mb-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs leading-6 text-amber-200">L’ancien site ne conservait pas toutes les connexions. Une date sans trace signifie « inconnu », jamais zéro. La première trace retrouvée ne prouve pas la date de création du site. Les traces écrasées et les comptes supprimés ne peuvent pas être récupérés ici.</p>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-zinc-400">{recovered.totalUsers} comptes distincts retrouvés sur {recovered.days.length} jours documentés, toutes périodes.</p><div className="flex gap-2"><button className={button} onClick={() => setDays(0)}>Depuis la première trace</button><button className={button} disabled={!recoveredPeriod.length} onClick={exportRecovered}>Exporter l’historique CSV</button></div></div>
          {(issues.history || issues.presence) && <p className="mb-4 text-xs text-amber-200">Récupération partielle : une source est indisponible. Les nombres affichés se limitent aux traces accessibles.</p>}
          {!recoveredPeriod.length ? <Empty text="Aucune ancienne présence datée retrouvée sur cette période." /> : <><Chart data={recoveredPeriod.slice(-365)} bars dates fields={[{ key: 'connections', label: 'Comptes retrouvés (minimum)', color: '#fbbf24' }]} /><p className="my-4 text-[10px] leading-5 text-zinc-500">Graphique : 365 dernières dates documentées au maximum. Tableau : 30 dernières dates documentées. L’export inclut toute la période sélectionnée. Le filtre films/séries ne s’applique pas.</p><div className="max-h-80 overflow-auto"><table className="w-full text-left text-xs"><caption className="sr-only">Présences anciennes retrouvées, nombres minimums</caption><thead className="border-b border-white/10 text-zinc-500"><tr><th scope="col" className="px-3 py-3 font-medium">Date</th><th scope="col" className="px-3 py-3 font-medium">Personnes retrouvées</th><th scope="col" className="px-3 py-3 font-medium">Fiabilité</th></tr></thead><tbody>{recoveredPeriod.slice(-30).reverse().map(day => <tr key={day.name} className="border-b border-white/5"><td className="px-3 py-3">{shortDate(day.name)} {day.name.slice(0, 4)}</td><td className="px-3 py-3 font-semibold text-amber-200">Au moins {day.connections}</td><td className="px-3 py-3 text-zinc-500">Historique partiel</td></tr>)}</tbody></table></div></>}
        </Section>
        <Section title="Le détail, jour par jour" description="Les 14 derniers jours suivis dans votre sélection. L’export contient toute la période affichée (365 jours maximum pour « Tout »).">
          <div className="mb-4 flex justify-end"><button className={button} disabled={!!issues.daily || !daily.length} onClick={exportDaily}>Exporter l’audience CSV</button></div>
          {issues.daily || !daily.length ? <Empty text="Les connexions quotidiennes apparaîtront après activation du suivi." /> : <div className="overflow-x-auto"><table className="w-full min-w-[550px] text-left text-xs"><caption className="sr-only">Audience quotidienne et activité enregistrée</caption><thead className="border-b border-white/10 text-zinc-500"><tr>{['Jour', 'Connectés uniques', 'Progressions', 'Comptes avec progression', 'Nouveaux comptes'].map(label => <th className="px-3 py-3 font-medium" scope="col" key={label}>{label}</th>)}</tr></thead><tbody>{analytics.timeline.filter(t => t.name >= connections.firstDay).slice(-14).reverse().map(t => <tr key={t.name} className="border-b border-white/5"><td className="px-3 py-3 text-zinc-300">{shortDate(t.name)}</td><td className="px-3 py-3 font-semibold text-red-300">{connections.trend.find(c => c.name === t.name)?.connections ?? 0}</td><td className="px-3 py-3">{historyAvailable(t.records)}</td><td className="px-3 py-3">{historyAvailable(t.accounts)}</td><td className="px-3 py-3">{available('profiles', t.signups)}</td></tr>)}</tbody></table></div>}
        </Section>
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Activité des contenus <span className="ml-2 text-xs font-normal text-zinc-500">{rangeLabel}</span></h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="Progressions enregistrées" value={historyAvailable(analytics.rows.length)} note={days && !issues.history ? change(analytics.rows.length, analytics.previousCount) : 'Dernière progression par profil et titre'} accent />
            <Metric label="Comptes avec une progression" value={historyAvailable(analytics.users)} note={days && !issues.history ? change(analytics.users, analytics.previousUsers) : 'Comptes distincts dans l’historique'} />
            <Metric label="Titres consultés" value={coverageAvailable(analytics.titles)} note={issues.media ? 'Catalogue indisponible' : `Sur ${analytics.selectedMedia.length} titres du catalogue sélectionné`} />
            <Metric label="Positions sauvegardées cumulées" value={historyAvailable(`${number(analytics.positions / 3600)} h`)} note="Somme des positions actuelles, pas du temps réel passé" />
            <Metric label="Progression moyenne" value={historyAvailable(analytics.progress === null ? '—' : pct(analytics.progress))} note={`${analytics.measured} progressions avec durée connue`} />
            <Metric label="Progressions à 90 % ou plus" value={historyAvailable(analytics.complete)} note={analytics.measured ? `${pct(percent(analytics.complete, analytics.measured))} des progressions mesurables ; épisode courant pour les séries` : 'Aucune durée exploitable'} />
            <Metric label="Couverture du catalogue" value={coverageAvailable(pct(percent(analytics.titles, analytics.selectedMedia.length)))} note="Part des titres ayant une progression dans la période" />
            <Metric label="Titres jamais enregistrés" value={coverageAvailable(analytics.neverConsulted)} note="Sans historique conservé, toutes périodes confondues" />
          </div>
        </section>
        <div className="grid gap-5 xl:grid-cols-2">
          <Section title="Évolution quotidienne des progressions" description={`${days ? rangeLabel : '365 derniers jours affichés'} · Les reprises déplacent la dernière activité.`}>{issues.history ? <Empty text="Historique indisponible." /> : <Chart data={analytics.timeline} dates fields={[{ key: 'records', label: 'Progressions', color: '#fb7185' }, { key: 'accounts', label: 'Comptes actifs', color: '#818cf8' }]} />}</Section>
          <Section title="Activité par mois" description="Année et mois restent distincts. Basé sur les dernières mises à jour.">{issues.history || !analytics.monthly.length ? <Empty /> : <Chart data={analytics.monthly} bars />}</Section>
          <Section title="Heures d’activité" description="Heure de Paris · Dernière mise à jour d’une progression, pas heure de connexion.">{issues.history ? <Empty /> : <Chart data={analytics.hours} bars />}</Section>
          <Section title="Jours de la semaine" description="Cumul des dernières mises à jour sur la période sélectionnée.">{issues.history ? <Empty /> : <Chart data={analytics.weekdays} bars />}</Section>
        </div>
        <div className="grid gap-5 xl:grid-cols-2">
          <Section title="Genres les plus consultés" description="Une progression peut compter dans plusieurs genres.">{issues.media || issues.history || !analytics.genres.length ? <Empty /> : <div className="space-y-4">{analytics.genres.slice(0, 10).map(g => <div key={g.name}><div className="mb-2 flex justify-between text-xs"><span>{g.name}</span><span className="text-zinc-400">{g.records}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-white/5"><div className="h-full rounded-full bg-gradient-to-r from-red-500 to-rose-300" style={{ width: `${percent(g.records, analytics.genres[0].records)}%` }} /></div></div>)}</div>}</Section>
          <Section title="Qui consulte les contenus ?" description="Statut VIP actuel du compte, pas statut historique à la date de lecture."><div className="grid gap-3 sm:grid-cols-3">{[['VIP', analytics.vipRecords], ['Gratuits', analytics.freeRecords], ['Non rattachés', analytics.unknownRecords]].map(([label, value]) => <div key={String(label)} className="rounded-xl border border-white/5 bg-white/[0.02] p-4"><p className="text-xs text-zinc-500">{label}</p><p className="mt-3 text-2xl font-semibold">{issues.profiles || issues.history ? '—' : value}</p></div>)}</div><p className="mt-5 text-xs leading-6 text-zinc-500">Les comptes supprimés ou non accessibles restent dans « Non rattachés ». Le taux VIP représente une répartition actuelle, pas une conversion commerciale mesurée.</p></Section>
        </div>
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Comptes & abonnements <span className="ml-2 text-xs font-normal text-zinc-500">État actuel, tous contenus</span></h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="Comptes enregistrés" value={available('profiles', data.profiles.length)} note="Lignes accessibles dans la table profiles" />
            <Metric label="Comptes marqués VIP" value={available('profiles', totalVip)} note={issues.profiles ? undefined : `${pct(percent(totalVip, data.profiles.length))} des comptes`} />
            <Metric label="Comptes gratuits" value={available('profiles', data.profiles.length - totalVip)} note="Sans marqueur VIP" />
            <Metric label="Nouveaux comptes" value={available('profiles', analytics.signups)} note={`${rangeLabel} · date de création connue`} />
            <Metric label="Quotas gratuits épuisés" value={available('profiles', data.profiles.filter(p => !isVip(p) && (p.watch_count ?? 0) >= 5).length)} note="Compteur de visionnage ≥ 5" />
            <Metric label="VIP arrivant à échéance" value={available('profiles', expiring)} note="Dans les 7 prochains jours · échéance calculée" />
            <Metric label="VIP avec échéance dépassée" value={available('profiles', expired)} note="Marqueur VIP encore actif · à vérifier dans Admin VIP" />
            <Metric label="VIP sans échéance calculable" value={available('profiles', undatedVip)} note="Date ou formule absente / non reconnue" />
          </div>
        </section>
        <div className="grid gap-5 xl:grid-cols-2">
          <Section title="Nouveaux comptes par jour" description="Comptes créés · indépendant du filtre films / séries.">{issues.profiles ? <Empty /> : <Chart data={analytics.timeline} dates fields={[{ key: 'signups', label: 'Nouveaux comptes', color: '#818cf8' }]} />}</Section>
          <Section title="Comptes les plus actifs" description="Classés par nombre de progressions enregistrées sur la période.">{issues.profiles || issues.history || !analytics.activeAccounts.length ? <Empty /> : <div className="space-y-3">{analytics.activeAccounts.slice(0, 8).map((account, index) => <div key={account.id} className="flex items-center gap-3 rounded-xl bg-white/[0.03] p-3"><span className="text-xs font-bold text-red-400">{String(index + 1).padStart(2, '0')}</span><div className="min-w-0 flex-1"><p className="truncate text-xs font-medium">{account.email}</p><p className="mt-1 text-[10px] text-zinc-500">{account.vip ? 'VIP' : 'Gratuit / inconnu'} · {account.titles} titres · {dateLabel(account.last)}</p></div><span className="text-sm font-semibold">{account.count}</span></div>)}</div>}</Section>
        </div>
        <Section title="Catalogue & performances" description="Recherchez, triez et exportez tous les titres. Le classement respecte les filtres de contenu et de période.">
          <div className="mb-4 flex flex-wrap gap-3"><input aria-label="Rechercher un titre" value={query} onChange={e => { setQuery(e.target.value); setPage(0); }} placeholder="Rechercher un film, une série…" className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs outline-none focus:border-red-400" /><select aria-label="Trier les titres" value={sort} onChange={e => { setSort(e.target.value); setPage(0); }} className="rounded-lg border border-white/10 bg-[#1a1b23] px-3 py-2 text-xs"><option value="count">Plus de progressions</option><option value="audience">Plus de comptes</option><option value="least">Moins de progressions</option><option value="title">Ordre alphabétique</option></select><button onClick={exportCsv} disabled={!!issues.history || !!issues.media} className={button}>Exporter CSV</button></div>
          {issues.history || issues.media ? <Empty text="Le catalogue et l’historique doivent être disponibles pour ce classement." /> : <>
            <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-xs"><caption className="sr-only">Performances des contenus pour {rangeLabel}</caption><thead className="border-b border-white/10 text-[10px] uppercase tracking-wider text-zinc-500"><tr>{['Contenu', 'Type', 'Progressions', 'Comptes distincts', 'À ≥ 90 %'].map(label => <th key={label} scope="col" className="px-3 py-3 font-medium">{label}</th>)}</tr></thead><tbody>{rows.slice(currentPage * 10, (currentPage + 1) * 10).map(item => <tr key={item.id} className="border-b border-white/5"><td className="px-3 py-3"><div className="flex items-center gap-3"><div className="h-12 w-8 shrink-0 overflow-hidden rounded bg-white/5">{item.poster && <img src={item.poster} alt="" loading="lazy" className="h-full w-full object-cover" />}</div><span className="max-w-xs truncate font-medium">{item.title || 'Sans titre'}</span></div></td><td className="px-3 py-3 text-zinc-400">{item.type === 'movie' ? 'Film' : item.type === 'series' ? 'Série' : 'Inconnu'}</td><td className="px-3 py-3 font-semibold text-red-300">{number(item.count)}</td><td className="px-3 py-3">{number(item.audience)}</td><td className="px-3 py-3 text-zinc-400">{item.completion === null ? '—' : pct(item.completion)}</td></tr>)}</tbody></table></div>
            {!rows.length && <Empty text="Aucun titre ne correspond à votre recherche." />}<div className="mt-4 flex items-center justify-between text-xs text-zinc-500"><span>{rows.length} titres · Page {currentPage + 1} / {totalPages}</span><div className="flex gap-2"><button className={button} disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>← Précédente</button><button className={button} disabled={currentPage + 1 >= totalPages} onClick={() => setPage(currentPage + 1)}>Suivante →</button></div></div>
          </>}
        </Section>
        <section className="space-y-4"><h2 className="text-lg font-semibold">Catalogue, communauté & mise en avant</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="Films au catalogue" value={available('media', data.media.filter(m => m.type === 'movie').length)} note="Total actuel" />
            <Metric label="Séries au catalogue" value={available('media', data.media.filter(m => m.type === 'series').length)} note={`${data.media.reduce((sum, m) => sum + (Array.isArray(m.seasons) ? m.seasons.reduce((n, s) => n + (s.episodes?.length ?? 0), 0) : 0), 0)} épisodes répertoriés`} />
            <Metric label="Titres ajoutés" value={available('media', analytics.added)} note={`${rangeLabel} · filtre de contenu appliqué`} />
            <Metric label="Commentaires publiés" value={available('comments', analytics.commentRows.length)} note={`${rangeLabel} · tous contenus`} />
            <Metric label="Demandes reçues" value={available('requests', analytics.requestRows.length)} note={`${rangeLabel} · tous contenus`} />
            <Metric label="Demandes à traiter" value={available('requests', data.requests.filter(r => r.status === 'en_attente' || r.status === 'en_cours').length)} note="Stock actuel, toutes dates" />
            <Metric label="Bannières actives" value={available('banners', data.banners.filter(b => b.active).length)} note={`${data.banners.length} enregistrées au total`} />
            <Metric label="Promotions diffusables" value={available('promotions', data.promotions.filter(p => p.active && (!p.starts_at || (dateValue(p.starts_at) ?? Infinity) <= now) && (!p.ends_at || (dateValue(p.ends_at) ?? -Infinity) > now)).length)} note="Actives et dans leur calendrier · audience non filtrée" />
          </div>
          <div className="grid gap-5 xl:grid-cols-2">
            <Section title="Traitement des demandes" description="Statut actuel des demandes créées sur la période.">{issues.requests || !analytics.requestRows.length ? <Empty /> : <div className="grid grid-cols-2 gap-3">{[['en_attente', 'En attente'], ['en_cours', 'En cours'], ['ajoute', 'Ajoutées'], ['refuse', 'Refusées']].map(([status, label]) => <div key={status} className="rounded-xl bg-white/[0.03] p-4"><p className="text-xs text-zinc-500">{label}</p><p className="mt-2 text-xl font-semibold">{analytics.requestRows.filter(r => r.status === status).length}</p></div>)}</div>}</Section>
            <Section title="Qualité des données" description="Pour repérer ce qui limite la précision des statistiques."><dl className="space-y-4 text-xs">{[['Historiques sans date exploitable (total)', historyAvailable(analytics.missingDates)], ['Progressions avec média absent (période)', coverageAvailable(analytics.missingMedia)], ['Titres sans affiche (total)', available('media', data.media.filter(m => !m.poster).length)], ['Titres sans image panoramique (total)', available('media', data.media.filter(m => !m.backdrop).length)], ['Comptes sans date de création (total)', available('profiles', data.profiles.filter(p => dateValue(p.created_at) === null).length)]].map(([label, value]) => <div key={String(label)} className="flex justify-between gap-4 border-b border-white/5 pb-3"><dt className="text-zinc-500">{label}</dt><dd className="font-semibold">{value}</dd></div>)}</dl></Section>
          </div>
        </section>
        <Section title="Présence en direct" description={`Comptes ayant envoyé un signal dans les 5 dernières minutes · actualisation toutes les 15 secondes${presenceUpdated ? ` · dernier relevé ${dateLabel(presenceUpdated)}` : ''}. Une page lecteur ouverte ne prouve pas une lecture en cours.`}>
          <div className="mb-4 flex flex-wrap gap-3"><span className="rounded-full bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-300">● {issues.presence ? '—' : online.length} présents</span><span className="rounded-full bg-white/5 px-3 py-1.5 text-xs text-zinc-400">{issues.presence ? '—' : online.filter(p => p.current_media_id).length} sur une page lecteur</span></div>
          {issues.presence || !online.length ? <Empty text={issues.presence ? 'Présence indisponible : le dernier relevé ne doit pas être interprété comme actuel.' : 'Aucun compte présent détecté.'} /> : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{online.map(p => <article key={p.user_id} className="rounded-xl border border-white/5 bg-white/[0.02] p-4"><p className="truncate text-xs font-semibold">{p.email || p.user_id}</p><p className="mt-2 text-[11px] text-zinc-500">{p.current_action || 'Navigation'} · {dateLabel(p.last_seen!)}</p>{p.current_media_id && <p className="mt-3 truncate text-xs text-red-300">{data.media.find(m => String(m.id) === String(p.current_media_id))?.title || 'Titre non disponible'}</p>}</article>)}</div>}
        </Section>
        <footer className="flex flex-wrap justify-between gap-3 border-t border-white/5 pt-6 text-[10px] leading-6 text-zinc-600"><span>YAMONFIM ANALYTICS · Europe/Paris</span><span>Sources accessibles à votre compte · Aucun revenu ni temps de lecture réel estimé.</span></footer>
      </div>
    </main>
  );
}
