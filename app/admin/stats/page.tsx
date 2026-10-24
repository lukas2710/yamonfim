'use client';

import { getPersistentSession } from '@/lib/auth-session';

import { createSearchMatcher } from '@/lib/search';

import SectionNavigation from '@/components/SectionNavigation';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { buildAnalytics, buildConnections, mergePresenceToday, recoverHistoricalConnections, validateRegistrations, registrationSummary, dayKey, dateValue, isVip, percent, vipExpiry, emptyDataset, type Dataset, type Presence, type ContentType, type DailyActivity } from './analytics';

const ADMIN_EMAIL = 'lukas.leclerc312@gmail.com';
const number = (n: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(n);
const pct = (n: number) => `${number(n)} %`;
const dateLabel = (value: string | number) => new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
const shortDate = (key: string) => new Date(`${key}T12:00:00Z`).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', timeZone: 'Europe/Paris' });
const longDate = (key: string) => key ? new Date(`${key}T12:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' }) : '—';
const panel = 'rounded-2xl border border-white/[0.08] bg-[#121319] p-5 sm:p-6';
const button = 'inline-flex items-center justify-center rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-zinc-300 transition hover:bg-white/10 hover:text-white disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-red-400';
type SourceKey = keyof Dataset | 'daily';
type Issues = Partial<Record<SourceKey | 'presence', string>>;
type Tone = 'red' | 'green' | 'indigo' | 'amber' | 'plain';
const tones: Record<Tone, string> = { red: 'text-red-300', green: 'text-emerald-300', indigo: 'text-indigo-300', amber: 'text-amber-300', plain: 'text-white' };
const sources: { key: SourceKey; table: string; order: string[]; label: string }[] = [
  { key: 'registrations', table: 'admin_registration_statistics', order: ['registration_date'], label: 'Inscriptions' },
  { key: 'profiles', table: 'profiles', order: ['id'], label: 'Comptes' },
  { key: 'media', table: 'media', order: ['id'], label: 'Catalogue' },
  { key: 'history', table: 'watch_history', order: ['user_id', 'profile_id', 'media_id'], label: 'Historique de lecture' },
  { key: 'requests', table: 'requests', order: ['id'], label: 'Demandes' },
  { key: 'banners', table: 'banners', order: ['id'], label: 'Bannières' },
  { key: 'promotions', table: 'promotions', order: ['id'], label: 'Promotions' },
  { key: 'comments', table: 'comments', order: ['id'], label: 'Commentaires' },
  { key: 'daily', table: 'user_daily_activity', order: ['activity_date', 'user_id'], label: 'Connexions quotidiennes' },
];
// Read every page, including when the server imposes a lower row limit.
async function readTable(table: string, columns: string[], signal: AbortSignal, seenAfter?: string, activityDate?: string): Promise<unknown[]> {
  const rows: unknown[] = [];
  let total = Infinity;
  while (rows.length < total) {
    let query = table === 'admin_registration_statistics'
      ? supabase.rpc('admin_registration_statistics', {}, { count: 'exact' })
      : supabase.from(table).select('*', { count: 'exact' });
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
  return table === 'admin_registration_statistics' ? validateRegistrations(rows) : rows;
}
function Kpi({ label, value, hint, tone = 'plain', big = false }: { label: string; value: string | number; hint?: string; tone?: Tone; big?: boolean }) {
  return <article className={`${panel} flex flex-col`}><p className="text-xs font-medium text-zinc-400">{label}</p><p className={`mt-2 font-semibold tracking-tight ${big ? 'text-4xl sm:text-5xl' : 'text-3xl'} ${tones[tone]}`}>{typeof value === 'number' ? number(value) : value}</p>{hint && <p className="mt-auto pt-2 text-[11px] leading-5 text-zinc-500">{hint}</p>}</article>;
}
function Block({ id, title, subtitle, children, aside }: { id?: string; title: string; subtitle?: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return <section id={id} className="scroll-mt-6 space-y-4"><div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-xl font-semibold tracking-tight">{title}</h2>{subtitle && <p className="mt-1 text-xs text-zinc-500">{subtitle}</p>}</div>{aside}</div>{children}</section>;
}
function Card({ title, hint, children, className = '' }: { title: string; hint?: string; children: React.ReactNode; className?: string }) {
  return <div className={`${panel} min-w-0 ${className}`}><h3 className="text-sm font-semibold">{title}</h3>{hint && <p className="mt-1 text-[11px] leading-5 text-zinc-500">{hint}</p>}<div className="mt-4">{children}</div></div>;
}
function Rows({ items }: { items: [string, React.ReactNode][] }) {
  return <dl className="divide-y divide-white/5 text-sm">{items.map(([label, value]) => <div key={label} className="flex items-center justify-between gap-4 py-2.5"><dt className="text-zinc-400">{label}</dt><dd className="shrink-0 font-semibold text-zinc-100">{value}</dd></div>)}</dl>;
}
function Empty({ text = 'Rien à afficher pour cette période.' }: { text?: string }) { return <p className="flex min-h-24 items-center justify-center rounded-xl border border-dashed border-white/10 p-5 text-center text-xs leading-6 text-zinc-500">{text}</p>; }
function Chart({ data, bars = false, field, label, color, dates = false, height = 'h-56' }: { data: object[]; bars?: boolean; field: string; label: string; color: string; dates?: boolean; height?: string }) {
  const grid = <><CartesianGrid vertical={false} stroke="#272832" strokeDasharray="3 5" /><XAxis dataKey="name" tickFormatter={dates ? shortDate : undefined} stroke="#777985" tick={{ fontSize: 10 }} minTickGap={25} tickLine={false} axisLine={false} /><YAxis allowDecimals={false} stroke="#777985" tick={{ fontSize: 10 }} width={30} tickLine={false} axisLine={false} /><Tooltip labelFormatter={dates ? l => shortDate(String(l)) : undefined} cursor={{ fill: 'rgba(255,255,255,.04)' }} contentStyle={{ background: '#191a22', border: '1px solid #363742', borderRadius: 12, fontSize: 12, color: '#eee' }} /></>;
  return <div className={`${height} w-full min-w-0`} role="img" aria-label={`Graphique : ${label}`}><ResponsiveContainer width="100%" height="100%">{bars ? <BarChart data={data}>{grid}<Bar dataKey={field} name={label} fill={color} radius={[4, 4, 0, 0]} isAnimationActive={false} /></BarChart> : <AreaChart data={data}>{grid}<Area type="monotone" dataKey={field} name={label} stroke={color} fill={color} fillOpacity={.12} strokeWidth={2} isAnimationActive={false} /></AreaChart>}</ResponsiveContainer></div>;
}
function Trend({ value, previous }: { value: number; previous: number }) {
  if (!previous) return null;
  const diff = (value - previous) / previous * 100;
  return <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-semibold ${diff >= 0 ? 'bg-emerald-500/10 text-emerald-300' : 'bg-red-500/10 text-red-300'}`}>{diff >= 0 ? '▲' : '▼'} {number(Math.abs(diff))} %</span>;
}
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
      const { data: auth, error } = await getPersistentSession();
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
      const { data: auth } = await getPersistentSession();
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
        setPresence(rows); setPastPresence(rows);
        setObservedDaily(previous => mergePresenceToday(previous, rows, Date.now()));
      }
      if (dailyResult.status === 'fulfilled') setDaily(previous => [...previous.filter(row => row.activity_date !== today), ...dailyResult.value as DailyActivity[]]);
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
  const signups = useMemo(() => registrationSummary(data.registrations ?? [], now), [data.registrations, now]);
  const recovered = useMemo(() => recoverHistoricalConnections(data.history, pastPresence, now), [data.history, pastPresence, now]);
  const recoveredPeriod = recovered.days.filter(day => (!days || day.name >= analytics.start) && day.name <= analytics.today);
  const rows = useMemo(() => analytics.ranked.filter(m => createSearchMatcher(query)(m.title)).sort((a, b) => sort === 'title' ? (a.title ?? '').localeCompare(b.title ?? '', 'fr') : sort === 'audience' ? b.audience - a.audience : sort === 'least' ? a.count - b.count : b.count - a.count), [analytics.ranked, query, sort]);
  const totalPages = Math.max(1, Math.ceil(rows.length / 10));
  const currentPage = Math.min(page, totalPages - 1);
  const totalVip = data.profiles.filter(isVip).length;
  const online = [...new Map(presence.filter(p => { const stamp = dateValue(p.last_seen); return stamp !== null && stamp >= now - 5 * 60_000 && stamp <= now + 60_000; }).map(p => [p.user_id, p])).values()];
  const expired = data.profiles.filter(p => isVip(p) && (vipExpiry(p) ?? Infinity) <= now).length;
  const expiring = data.profiles.filter(p => { const end = vipExpiry(p); return isVip(p) && end !== null && end > now && end <= now + 7 * 86400000; }).length;
  const undatedVip = data.profiles.filter(p => isVip(p) && vipExpiry(p) === null).length;
  const rangeLabel = days ? `${days} derniers jours` : 'depuis le début';
  const signupDays = analytics.timeline.filter(t => t.signups > 0).length;
  const available = (key: SourceKey, value: number | string) => issues[key] ? key === 'daily' && combinedDaily.length && typeof value === 'number' ? `≥ ${number(value)}` : '—' : value;
  const historyAvailable = (value: number | string) => available('history', value);
  const csv = (name: string, lines: unknown[][]) => download(`yamonfim-${name}-${analytics.today}.csv`, '﻿' + lines.map(row => row.map(csvCell).join(';')).join('\r\n'), 'text/csv;charset=utf-8');
  const exportCsv = () => csv('titres', [['Titre', 'Type', 'Lectures', 'Spectateurs', 'Terminées (%)'], ...rows.map(m => [m.title, m.type, m.count, m.audience, m.completion === null ? '' : m.completion.toFixed(1)])]);
  const exportSignups = () => csv('inscriptions', [['Date (Paris)', 'Nouveaux inscrits'], ...(data.registrations ?? []).map(r => [r.registration_date, r.registrations])]);
  const exportRecovered = () => csv('historique-retrouve', [['Date (Paris)', 'Comptes retrouvés (minimum)'], ...recoveredPeriod.map(day => [day.name, day.connections])]);
  const exportDaily = () => csv('audience-quotidienne', [['Date (Paris)', 'Connectés uniques', 'Lectures mises à jour', 'Spectateurs', 'Nouveaux inscrits'], ...analytics.timeline.filter(t => connections.firstDay && t.name >= connections.firstDay).map(t => [t.name, connections.trend.find(c => c.name === t.name)?.connections ?? 0, issues.history ? '' : t.records, issues.history ? '' : t.accounts, issues.registrations ? '' : t.signups])]);
  const exportJson = () => download(`yamonfim-donnees-${analytics.today}.json`, JSON.stringify({ exportedAt: new Date().toISOString(), loadedAt: updated ? new Date(updated).toISOString() : null, timezone: 'Europe/Paris', unavailableSources: issues, scope: 'Tables chargées dans le tableau de bord, pas une sauvegarde complète de la base', ...data, dailyActivity: daily, dailyActivityReconciled: combinedDaily, presence }, null, 2), 'application/json');

  if (loading) return <main className="yf-page yf-stats grid min-h-screen place-items-center bg-[#0b0c10] p-8 text-sm text-zinc-400">Chargement des statistiques…</main>;
  if (!authorized) return fatal ? <main className="yf-page yf-stats grid min-h-screen place-items-center bg-[#0b0c10] p-8 text-white"><div role="alert"><p>{fatal}</p><button className={`${button} mt-4`} onClick={() => void load()}>Réessayer</button></div></main> : null;
  return (
    <main className="yf-page yf-stats min-h-screen bg-[#0b0c10] pb-16 font-sans text-zinc-100 selection:bg-red-500/30">
      <nav className="yf-topbar border-b border-white/[0.07] px-5 sm:px-10" aria-label="Administration"><div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-4 py-5"><Link href="/" className="text-lg font-black tracking-tight text-red-500">YAMON<span className="text-white">FIM</span><span className="ml-3 border-l border-white/20 pl-3 text-[9px] font-medium tracking-[0.18em] text-zinc-500">STATISTIQUES</span></Link><div className="flex flex-wrap gap-4 text-xs text-zinc-400"><Link href="/">Accueil ↗</Link><Link href="/admin">Catalogue</Link><Link href="/admin/banners">Bannières</Link><Link href="/admin-vip">Admin VIP</Link></div></div></nav>
      <SectionNavigation admin />
      <div className="mx-auto max-w-[1400px] space-y-10 px-4 pt-8 sm:px-10">

        <header className="space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div><h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Statistiques</h1><p className="mt-2 text-sm text-zinc-400">{updated ? `Mis à jour à ${dateLabel(updated)}` : 'En attente de données'}{auto ? ' · actualisation automatique' : ''}</p></div>
            <div className="flex flex-wrap gap-2"><label className={`${button} cursor-pointer gap-2`}><input type="checkbox" checked={auto} onChange={e => setAuto(e.target.checked)} className="accent-red-500" />Auto</label><button onClick={() => { void load(); void loadPresence(); }} disabled={refreshing} className={button}>{refreshing ? 'Actualisation…' : '↻ Actualiser'}</button></div>
          </div>
          <div className="sticky top-0 z-10 -mx-4 flex flex-wrap items-center justify-between gap-3 border-y border-white/[0.06] bg-[#0b0c10]/90 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:border sm:px-3" aria-label="Période">
            <div className="flex flex-wrap items-center gap-1"><span className="mr-2 text-xs text-zinc-500">Période</span>{[7, 30, 90, 365, 0].map(value => <button key={value} onClick={() => { setDays(value); setPage(0); }} aria-pressed={days === value} className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${days === value ? 'bg-red-500 text-white' : 'text-zinc-400 hover:bg-white/5 hover:text-white'}`}>{value === 0 ? 'Tout' : value === 365 ? '1 an' : `${value} j`}</button>)}</div>
            <nav className="hidden gap-4 text-xs text-zinc-500 md:flex" aria-label="Sections">{[['#inscriptions', 'Inscriptions'], ['#audience', 'Audience'], ['#contenus', 'Contenus'], ['#vip', 'VIP'], ['#catalogue', 'Catalogue']].map(([href, label]) => <a key={href} href={href} className="hover:text-white">{label}</a>)}</nav>
          </div>
        </header>

        {fatal && <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{fatal}</p>}
        {Object.keys(issues).length > 0 && <div role="status" className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4 text-xs leading-6 text-amber-200"><p className="font-semibold">Certaines données n’ont pas pu être chargées (affichées « — ») :</p><ul className="mt-1 list-disc pl-5">{Object.entries(issues).map(([key, message]) => <li key={key}>{sources.find(s => s.key === key)?.label ?? 'Présence en direct'} : {message}</li>)}</ul>{issues.registrations && <p className="mt-2">Pour les inscriptions, exécuter <code>supabase/migrations/20261024_registration_statistics.sql</code> dans le SQL Editor de Supabase.</p>}</div>}

        <section aria-label="L’essentiel" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi big tone="green" label="● En ligne maintenant" value={issues.presence ? '—' : online.length} hint="Actifs dans les 5 dernières minutes" />
          <Kpi big tone="red" label="Connectés aujourd’hui" value={available('daily', connections.today)} hint={`${connections.yesterday} hier`} />
          <Kpi big tone="indigo" label="Nouveaux inscrits aujourd’hui" value={available('registrations', signups.today)} hint={`${signups.yesterday} hier`} />
          <Kpi big label="Membres inscrits" value={available('registrations', signups.total)} hint={`dont ${number(totalVip)} VIP`} />
        </section>

        <Block id="inscriptions" title="Inscriptions" subtitle="Nouveaux comptes créés sur le site (heure de Paris)." aside={<button className={button} disabled={!!issues.registrations || !data.registrations?.length} onClick={exportSignups}>Exporter CSV</button>}>
          <div className="grid gap-3 sm:grid-cols-3">
            <Kpi tone="indigo" label="7 derniers jours" value={available('registrations', signups.week)} />
            <Kpi tone="indigo" label="30 derniers jours" value={available('registrations', signups.month)} />
            <Kpi tone="indigo" label={`Période (${rangeLabel})`} value={available('registrations', analytics.signups)} />
          </div>
          <Card title="Nouveaux inscrits par jour" hint={issues.registrations ? undefined : signups.total ? `Premier inscrit le ${longDate(signups.first)} · dernier le ${longDate(signups.last)}${days ? ` · ${signupDays} jour(s) avec au moins une inscription sur la période` : ''}` : undefined}>
            {issues.registrations ? <Empty text="Inscriptions indisponibles : voir le message en haut de la page." /> : !signups.total ? <Empty text="Supabase ne renvoie aucune inscription." /> : !analytics.signups ? <Empty text={`Aucune inscription ${rangeLabel}. Choisis « Tout » pour voir l’historique.`} /> : <Chart data={analytics.timeline} bars dates field="signups" label="Nouveaux inscrits" color="#818cf8" />}
          </Card>
        </Block>

        <Block id="audience" title="Audience" subtitle="Personnes connectées au site. Une personne compte une seule fois par jour.">
          <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
            <Card title="Connectés par jour" hint={connections.firstDay ? `Suivi depuis le ${longDate(connections.firstDay)}` : undefined}>
              {issues.daily || !daily.length ? <Empty text={issues.daily ? 'Le suivi des connexions n’est pas disponible.' : 'Aucune connexion enregistrée pour le moment.'} /> : <Chart data={connections.trend.filter(t => t.name >= connections.firstDay)} dates field="connections" label="Connectés" color="#fb7185" />}
            </Card>
            <Card title="En résumé">
              <Rows items={[
                ['Actifs sur 7 jours', available('daily', connections.week)],
                ['Actifs sur 30 jours', available('daily', connections.month)],
                [`Sur la période`, available('daily', connections.selected)],
                ['Moyenne par jour', available('daily', number(connections.average))],
                ['Meilleur jour', available('daily', connections.peak.name ? `${connections.peak.connections} · ${shortDate(connections.peak.name)}` : '—')],
                ['Revenus aujourd’hui après hier', available('daily', connections.yesterday ? `${connections.returning} (${pct(connections.retention)})` : '—')],
              ]} />
            </Card>
          </div>
          <Card title={`En ligne maintenant · ${issues.presence ? '—' : online.length}`} hint="Rafraîchi toutes les 15 secondes.">
            {issues.presence || !online.length ? <Empty text={issues.presence ? 'Présence en direct indisponible.' : 'Personne en ligne pour le moment.'} /> : <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{online.map(p => <article key={p.user_id} className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3"><span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400" /><div className="min-w-0"><p className="truncate text-xs font-semibold">{p.email || p.user_id}</p><p className="truncate text-[11px] text-zinc-500">{p.current_media_id ? `▶ ${data.media.find(m => String(m.id) === String(p.current_media_id))?.title || 'Un titre'}` : p.current_action || 'Navigue sur le site'}</p></div></article>)}</div>}
          </Card>
        </Block>

        <Block id="contenus" title="Ce qui est regardé" subtitle={`Lectures ${rangeLabel}. Une lecture = un profil qui a lancé un titre (les reprises ne comptent pas en double).`} aside={<select aria-label="Type de contenu" className="rounded-lg border border-white/10 bg-[#1a1b23] px-3 py-2 text-xs text-zinc-200" value={type} onChange={e => { setType(e.target.value as ContentType); setPage(0); }}><option value="all">Films et séries</option><option value="movie">Films</option><option value="series">Séries</option></select>}>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi tone="red" label="Lectures" value={historyAvailable(analytics.rows.length)} />
            <Kpi label="Spectateurs" value={historyAvailable(analytics.users)} hint="Comptes ayant lancé au moins un titre" />
            <Kpi label="Titres différents vus" value={historyAvailable(analytics.titles)} hint={`sur ${analytics.selectedMedia.length} au catalogue`} />
            <Kpi label="Terminés" value={historyAvailable(analytics.measured ? pct(percent(analytics.complete, analytics.measured)) : '—')} hint="Lectures regardées à 90 % ou plus" />
          </div>
          {days > 0 && !issues.history && (analytics.previousCount > 0 || analytics.previousUsers > 0) && <p className="text-xs text-zinc-500">Par rapport aux {days} jours précédents : lectures <Trend value={analytics.rows.length} previous={analytics.previousCount} /> · spectateurs <Trend value={analytics.users} previous={analytics.previousUsers} /></p>}
          <div className="grid gap-5 lg:grid-cols-2">
            <Card title="Top 10 des titres">
              {issues.history || issues.media || !analytics.ranked[0]?.count ? <Empty /> : <ol className="space-y-2">{analytics.ranked.filter(m => m.count).slice(0, 10).map((m, i) => <li key={m.id} className="flex items-center gap-3"><span className="w-5 text-right text-xs font-bold text-zinc-500">{i + 1}</span><div className="h-10 w-7 shrink-0 overflow-hidden rounded bg-white/5">{m.poster && <img src={m.poster} alt="" loading="lazy" className="h-full w-full object-cover" />}</div><div className="min-w-0 flex-1"><p className="truncate text-sm">{m.title || 'Sans titre'}</p><div className="mt-1 h-1 overflow-hidden rounded-full bg-white/5"><div className="h-full rounded-full bg-red-400" style={{ width: `${percent(m.count, analytics.ranked[0].count)}%` }} /></div></div><span className="text-sm font-semibold">{m.count}</span></li>)}</ol>}
            </Card>
            <Card title="Genres préférés">
              {issues.media || issues.history || !analytics.genres.length ? <Empty /> : <div className="space-y-3">{analytics.genres.slice(0, 10).map(g => <div key={g.name}><div className="mb-1 flex justify-between text-xs"><span>{g.name}</span><span className="text-zinc-400">{g.records}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-white/5"><div className="h-full rounded-full bg-gradient-to-r from-red-500 to-rose-300" style={{ width: `${percent(g.records, analytics.genres[0].records)}%` }} /></div></div>)}</div>}
            </Card>
            <Card title="À quelle heure ?" hint="Heure de Paris">{issues.history ? <Empty /> : <Chart data={analytics.hours} bars field="records" label="Lectures" color="#fb7185" height="h-48" />}</Card>
            <Card title="Quel jour ?">{issues.history ? <Empty /> : <Chart data={analytics.weekdays} bars field="records" label="Lectures" color="#fb7185" height="h-48" />}</Card>
          </div>
          <Card title="Membres les plus actifs">
            {issues.profiles || issues.history || !analytics.activeAccounts.length ? <Empty /> : <div className="grid gap-2 md:grid-cols-2">{analytics.activeAccounts.slice(0, 8).map((account, index) => <div key={account.id} className="flex items-center gap-3 rounded-xl bg-white/[0.03] p-3"><span className="text-xs font-bold text-red-400">{index + 1}</span><div className="min-w-0 flex-1"><p className="truncate text-xs font-medium">{account.email}</p><p className="mt-0.5 text-[10px] text-zinc-500">{account.vip ? 'VIP' : 'Gratuit'} · {account.titles} titres · vu le {dateLabel(account.last)}</p></div><span className="text-sm font-semibold">{account.count}</span></div>)}</div>}
          </Card>
        </Block>

        <Block id="vip" title="VIP & abonnements" subtitle="Situation actuelle des comptes.">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <Kpi tone="amber" label="Comptes VIP" value={available('profiles', totalVip)} hint={issues.profiles ? undefined : `${pct(percent(totalVip, data.profiles.length))} des comptes`} />
            <Kpi label="Comptes gratuits" value={available('profiles', data.profiles.length - totalVip)} />
            <Kpi label="Gratuits ayant épuisé leur quota" value={available('profiles', data.profiles.filter(p => !isVip(p) && (p.watch_count ?? 0) >= 5).length)} hint="5 visionnages ou plus" />
            <Kpi tone="amber" label="VIP qui expirent sous 7 jours" value={available('profiles', expiring)} />
            <Kpi tone={expired ? 'red' : 'plain'} label="VIP expirés encore actifs" value={available('profiles', expired)} hint="À retirer dans Admin VIP" />
            <Kpi label="VIP sans date de fin" value={available('profiles', undatedVip)} />
          </div>
        </Block>

        <Block id="catalogue" title="Catalogue & communauté">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label="Films" value={available('media', data.media.filter(m => m.type === 'movie').length)} />
            <Kpi label="Séries" value={available('media', data.media.filter(m => m.type === 'series').length)} hint={`${data.media.reduce((sum, m) => sum + (Array.isArray(m.seasons) ? m.seasons.reduce((n, s) => n + (s.episodes?.length ?? 0), 0) : 0), 0)} épisodes`} />
            <Kpi label="Titres ajoutés" value={available('media', analytics.added)} hint={rangeLabel} />
            <Kpi label="Jamais regardés" value={available('history', analytics.neverConsulted)} />
            <Kpi label="Commentaires" value={available('comments', analytics.commentRows.length)} hint={rangeLabel} />
            <Kpi label="Demandes reçues" value={available('requests', analytics.requestRows.length)} hint={rangeLabel} />
            <Kpi tone="amber" label="Demandes à traiter" value={available('requests', data.requests.filter(r => r.status === 'en_attente' || r.status === 'en_cours').length)} />
            <Kpi label="Bannières · promos actives" value={issues.banners || issues.promotions ? '—' : `${data.banners.filter(b => b.active).length} · ${data.promotions.filter(p => p.active && (!p.starts_at || (dateValue(p.starts_at) ?? Infinity) <= now) && (!p.ends_at || (dateValue(p.ends_at) ?? -Infinity) > now)).length}`} />
          </div>
          <details className={`${panel} group`}>
            <summary className="cursor-pointer list-none text-sm font-semibold"><span className="mr-2 inline-block transition group-open:rotate-90">›</span>Tous les titres (recherche, tri, export)</summary>
            <div className="mt-5">
              <div className="mb-4 flex flex-wrap gap-3"><input aria-label="Rechercher un titre" value={query} onChange={e => { setQuery(e.target.value); setPage(0); }} placeholder="Rechercher un film, une série…" className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs outline-none focus:border-red-400" /><select aria-label="Trier les titres" value={sort} onChange={e => { setSort(e.target.value); setPage(0); }} className="rounded-lg border border-white/10 bg-[#1a1b23] px-3 py-2 text-xs"><option value="count">Plus regardés</option><option value="audience">Plus de spectateurs</option><option value="least">Moins regardés</option><option value="title">A → Z</option></select><button onClick={exportCsv} disabled={!!issues.history || !!issues.media} className={button}>Exporter CSV</button></div>
              {issues.history || issues.media ? <Empty text="Catalogue ou historique indisponible." /> : <>
                <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-xs"><thead className="border-b border-white/10 text-[10px] uppercase tracking-wider text-zinc-500"><tr>{['Titre', 'Type', 'Lectures', 'Spectateurs', 'Terminés'].map(label => <th key={label} scope="col" className="px-3 py-3 font-medium">{label}</th>)}</tr></thead><tbody>{rows.slice(currentPage * 10, (currentPage + 1) * 10).map(item => <tr key={item.id} className="border-b border-white/5"><td className="px-3 py-2"><div className="flex items-center gap-3"><div className="h-10 w-7 shrink-0 overflow-hidden rounded bg-white/5">{item.poster && <img src={item.poster} alt="" loading="lazy" className="h-full w-full object-cover" />}</div><span className="max-w-xs truncate font-medium">{item.title || 'Sans titre'}</span></div></td><td className="px-3 py-2 text-zinc-400">{item.type === 'movie' ? 'Film' : item.type === 'series' ? 'Série' : '—'}</td><td className="px-3 py-2 font-semibold text-red-300">{number(item.count)}</td><td className="px-3 py-2">{number(item.audience)}</td><td className="px-3 py-2 text-zinc-400">{item.completion === null ? '—' : pct(item.completion)}</td></tr>)}</tbody></table></div>
                {!rows.length && <Empty text="Aucun titre ne correspond à la recherche." />}<div className="mt-4 flex items-center justify-between text-xs text-zinc-500"><span>{rows.length} titres · page {currentPage + 1}/{totalPages}</span><div className="flex gap-2"><button className={button} disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>←</button><button className={button} disabled={currentPage + 1 >= totalPages} onClick={() => setPage(currentPage + 1)}>→</button></div></div>
              </>}
            </div>
          </details>
        </Block>

        <details className={`${panel} group`}>
          <summary className="cursor-pointer list-none text-sm font-semibold text-zinc-300"><span className="mr-2 inline-block transition group-open:rotate-90">›</span>Détails avancés & exports</summary>
          <div className="mt-5 space-y-6 text-xs leading-6 text-zinc-400">
            <div className="flex flex-wrap gap-2"><button className={button} disabled={!!issues.daily || !daily.length} onClick={exportDaily}>Audience jour par jour (CSV)</button><button className={button} disabled={!recoveredPeriod.length} onClick={exportRecovered}>Anciennes connexions retrouvées (CSV)</button><button onClick={exportJson} disabled={!updated || refreshing} className={button}>Toutes les données (JSON)</button></div>
            <div><h3 className="mb-2 text-sm font-semibold text-zinc-200">Anciennes connexions retrouvées</h3><p>Avant la mise en place du suivi, on retrouve seulement des traces partielles dans l’historique de lecture : ce sont des minimums. {recovered.firstDay ? `${recovered.totalUsers} comptes retrouvés depuis le ${longDate(recovered.firstDay)}.` : ''}</p>{recoveredPeriod.length ? <div className="mt-3"><Chart data={recoveredPeriod.slice(-365)} bars dates field="connections" label="Comptes retrouvés (minimum)" color="#fbbf24" height="h-44" /></div> : <Empty text="Aucune trace sur cette période." />}</div>
            <div><h3 className="mb-2 text-sm font-semibold text-zinc-200">Qualité des données</h3><Rows items={[
              ['Lectures sans date', historyAvailable(analytics.missingDates)],
              ['Lectures d’un titre supprimé (période)', historyAvailable(analytics.missingMedia)],
              ['Lectures de comptes VIP · gratuits · inconnus', issues.profiles || issues.history ? '—' : `${analytics.vipRecords} · ${analytics.freeRecords} · ${analytics.unknownRecords}`],
              ['Titres sans affiche', available('media', data.media.filter(m => !m.poster).length)],
              ['Titres sans image panoramique', available('media', data.media.filter(m => !m.backdrop).length)],
            ]} /></div>
            <p>Comment c’est calculé : les inscriptions viennent des comptes Supabase (<code>auth.users</code>). Une « lecture » est la dernière position sauvegardée d’un profil sur un titre : ce n’est pas un nombre de vues. Toutes les dates sont à l’heure de Paris.</p>
          </div>
        </details>

        <footer className="border-t border-white/5 pt-6 text-[10px] text-zinc-600">YAMONFIM · Statistiques · heure de Paris</footer>
      </div>
    </main>
  );
}
