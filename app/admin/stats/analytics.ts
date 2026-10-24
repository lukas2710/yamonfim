export interface Profile { id: string; email?: string; is_vip?: boolean | string; watch_count?: number; created_at?: string; vip_started_at?: string; vip_duration?: string }
export interface Media { id: string | number; title?: string; type?: string; poster?: string; backdrop?: string; genres?: string[] | string; runtime?: number; created_at?: string; seasons?: { episodes?: unknown[] }[] }
export interface History { user_id?: string; profile_id?: string; media_id?: string | number; type?: string; current_time?: number; duration?: number; updated_at?: string; created_at?: string; watched_at?: string }
export interface Presence { user_id: string; email?: string; current_action?: string; current_media_id?: string; last_seen?: string }
export interface RequestRow { id: string; title?: string; status?: string; created_at?: string }
export interface Campaign { id: string; title?: string; active?: boolean; starts_at?: string; ends_at?: string }
export interface CommentRow { id: string; created_at?: string; media_id?: string }
export interface Dataset { profiles: Profile[]; media: Media[]; history: History[]; requests: RequestRow[]; banners: Campaign[]; promotions: Campaign[]; comments: CommentRow[]; registrations?: { registration_date: string; registrations: number | string }[] }
export type ContentType = 'all' | 'movie' | 'series';
export const emptyDataset: Dataset = { profiles: [], media: [], history: [], requests: [], banners: [], promotions: [], comments: [] };
const dayFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' });
export const dayKey = (date: Date) => {
  const parts = dayFormatter.formatToParts(date);
  return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type)!.value).join('-');
};

export function validateRegistrations(rows: unknown[]): NonNullable<Dataset['registrations']> {
  return rows.map(row => {
    const value = row as { registration_date?: unknown; registrations?: unknown } | null;
    const key = value?.registration_date;
    const count = Number(value?.registrations);
    if (typeof key !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(key) || value?.registrations == null || !Number.isSafeInteger(count) || count <= 0) {
      throw new Error('Les dates ou les totaux reçus de Supabase sont invalides. Réexécuter 20261024_registration_statistics.sql.');
    }
    return { registration_date: key, registrations: count };
  });
}
// Fixed windows (today, 7 and 30 days) that do not depend on the period filter.
export function registrationSummary(rows: NonNullable<Dataset['registrations']>, now: number) {
  const today = dayKey(new Date(now));
  const since = (from: string) => rows.reduce((sum, r) => r.registration_date >= from && r.registration_date <= today ? sum + Number(r.registrations) : sum, 0);
  const yesterday = shiftDay(today, -1);
  return {
    today: since(today),
    yesterday: rows.reduce((sum, r) => r.registration_date === yesterday ? sum + Number(r.registrations) : sum, 0),
    week: since(shiftDay(today, -6)),
    month: since(shiftDay(today, -29)),
    total: since(''),
    first: rows[0]?.registration_date ?? '',
    last: rows.at(-1)?.registration_date ?? '',
  };
}
export const dateValue = (value?: string) => { const n = value ? Date.parse(value) : NaN; return Number.isFinite(n) ? n : null; };
export const historyDate = (row: History) => dateValue(row.updated_at) ?? dateValue(row.watched_at) ?? dateValue(row.created_at);
export const isVip = (profile: Profile) => profile.is_vip === true || profile.is_vip === 'true';
export const positive = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
export function shiftDay(key: string, amount: number) { const d = new Date(`${key}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + amount); return d.toISOString().slice(0, 10); }
export function vipExpiry(profile: Profile) {
  const stamp = dateValue(profile.vip_started_at);
  if (stamp === null) return null;
  const d = new Date(stamp);
  // Match the existing countdown in /admin-vip, including calendar rollovers.
  if (profile.vip_duration === '15d') d.setDate(d.getDate() + 15);
  else if (profile.vip_duration === '3m') d.setMonth(d.getMonth() + 3);
  else if (profile.vip_duration === '1y') d.setFullYear(d.getFullYear() + 1);
  else return null;
  return d.getTime();
}
export const percent = (part: number, total: number) => total ? part / total * 100 : 0;
export function buildAnalytics(data: Dataset, days: number, type: ContentType, now: number) {
  const today = dayKey(new Date(now));
  const start = days ? shiftDay(today, 1 - days) : '';
  const previousStart = days ? shiftDay(start, -days) : '';
  const mediaMap = new Map(data.media.map(m => [String(m.id), m]));
  const matches = (h: History) => type === 'all' || (mediaMap.get(String(h.media_id))?.type ?? h.type) === type;
  const dated = data.history.filter(matches).map(h => ({ row: h, stamp: historyDate(h) })).filter((v): v is { row: History; stamp: number } => v.stamp !== null && v.stamp <= now);
  const current = dated.filter(v => !days || dayKey(new Date(v.stamp)) >= start);
  const previous = days ? dated.filter(v => { const key = dayKey(new Date(v.stamp)); return key >= previousStart && key < start; }) : [];
  const rows = current.map(v => v.row);
  const users = new Set(rows.map(h => h.user_id).filter(Boolean));
  const previousUsers = new Set(previous.map(v => v.row.user_id).filter(Boolean));
  const titles = new Set(rows.map(h => String(h.media_id)).filter(id => mediaMap.has(id)));
  const vipIds = new Set(data.profiles.filter(isVip).map(p => p.id));
  const knownUsers = new Set(data.profiles.map(p => p.id));
  const vipRecords = rows.filter(h => h.user_id && vipIds.has(h.user_id)).length;
  const freeRecords = rows.filter(h => h.user_id && knownUsers.has(h.user_id) && !vipIds.has(h.user_id)).length;
  const measured = rows.filter(h => positive(h.duration) > 0);
  const complete = measured.filter(h => positive(h.current_time) / positive(h.duration) >= .9).length;
  const progress = measured.length ? measured.reduce((sum, h) => sum + Math.min(1, positive(h.current_time) / positive(h.duration)), 0) / measured.length * 100 : null;
  const positions = rows.reduce((sum, h) => sum + (positive(h.duration) ? Math.min(positive(h.current_time), positive(h.duration)) : positive(h.current_time)), 0);
  const counts = new Map<string, { count: number; users: Set<string>; completed: number; measured: number }>();
  const genres = new Map<string, number>();
  const hours = Array.from({ length: 24 }, (_, hour) => ({ name: `${String(hour).padStart(2, '0')} h`, records: 0 }));
  const weekdays = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(name => ({ name, records: 0 }));
  const hourFormat = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', hour: '2-digit', hourCycle: 'h23' });
  const weekdayFormat = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Paris', weekday: 'short' });
  const weekdayKeys = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const chartDays = days || 365;
  const chartStart = days ? start : shiftDay(today, 1 - chartDays);
  const timeline = Array.from({ length: chartDays }, (_, i) => ({ name: shiftDay(chartStart, i), records: 0, accounts: 0, signups: 0 }));
  const timelineMap = new Map(timeline.map(t => [t.name, { item: t, users: new Set<string>() }]));
  const monthlyMap = new Map<string, number>();
  for (const { row, stamp } of current) {
    const id = String(row.media_id);
    const entry = counts.get(id) ?? { count: 0, users: new Set<string>(), completed: 0, measured: 0 };
    entry.count++;
    if (row.user_id) entry.users.add(row.user_id);
    if (positive(row.duration)) { entry.measured++; if (positive(row.current_time) / positive(row.duration) >= .9) entry.completed++; }
    counts.set(id, entry);
    const media = mediaMap.get(id);
    const list = Array.isArray(media?.genres) ? media.genres : typeof media?.genres === 'string' ? media.genres.split(',').map(s => s.trim()).filter(Boolean) : [];
    for (const genre of new Set(list)) genres.set(genre, (genres.get(genre) ?? 0) + 1);
    const date = new Date(stamp);
    const hour = Number(hourFormat.format(date));
    if (hours[hour]) hours[hour].records++;
    const weekday = weekdayKeys.indexOf(weekdayFormat.format(date));
    if (weekdays[weekday]) weekdays[weekday].records++;
    const bucket = timelineMap.get(dayKey(date));
    if (bucket) { bucket.item.records++; if (row.user_id) bucket.users.add(row.user_id); }
    const month = dayKey(date).slice(0, 7);
    monthlyMap.set(month, (monthlyMap.get(month) ?? 0) + 1);
  }
  for (const bucket of timelineMap.values()) bucket.item.accounts = bucket.users.size;
  let signups = 0;
  const registrationDays = data.registrations ?? data.profiles.flatMap(p => {
    const stamp = dateValue(p.created_at);
    return stamp === null || stamp > now ? [] : [{ registration_date: dayKey(new Date(stamp)), registrations: 1 }];
  });
  for (const row of registrationDays) {
    const key = row.registration_date;
    const count = Number(row.registrations);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || key > today || !Number.isSafeInteger(count) || count < 0) continue;
    const bucket = timelineMap.get(key);
    if (bucket) bucket.item.signups += count;
    if (!days || key >= start) signups += count;
  }
  const selectedMedia = data.media.filter(m => type === 'all' || m.type === type);
  const ranked = selectedMedia.map(m => ({ ...m, count: counts.get(String(m.id))?.count ?? 0, audience: counts.get(String(m.id))?.users.size ?? 0, completion: counts.get(String(m.id))?.measured ? percent(counts.get(String(m.id))!.completed, counts.get(String(m.id))!.measured) : null })).sort((a, b) => b.count - a.count || (a.title ?? '').localeCompare(b.title ?? ''));
  const requestRows = data.requests.filter(r => { const stamp = dateValue(r.created_at); return stamp !== null && stamp <= now && (!days || dayKey(new Date(stamp)) >= start); });
  const commentRows = data.comments.filter(r => { const stamp = dateValue(r.created_at); return stamp !== null && stamp <= now && (!days || dayKey(new Date(stamp)) >= start); });
  const profileActivity = new Map<string, { count: number; titles: Set<string>; last: number }>();
  for (const { row, stamp } of current) if (row.user_id) { const a = profileActivity.get(row.user_id) ?? { count: 0, titles: new Set<string>(), last: 0 }; a.count++; if (row.media_id != null) a.titles.add(String(row.media_id)); a.last = Math.max(a.last, stamp); profileActivity.set(row.user_id, a); }
  const profileMap = new Map(data.profiles.map(p => [p.id, p]));
  const activeAccounts = Array.from(profileActivity, ([id, a]) => ({ id, email: profileMap.get(id)?.email || id, vip: vipIds.has(id), count: a.count, titles: a.titles.size, last: a.last })).sort((a, b) => b.count - a.count);
  const added = selectedMedia.filter(m => { const stamp = dateValue(m.created_at); return stamp !== null && stamp <= now && (!days || dayKey(new Date(stamp)) >= start); }).length;
  const allReferenced = new Set(data.history.map(h => String(h.media_id)));
  return { rows, current, previousCount: previous.length, previousUsers: previousUsers.size, users: users.size, titles: titles.size, vipRecords, freeRecords, unknownRecords: rows.length - vipRecords - freeRecords, measured: measured.length, complete, progress, positions, signups, added, ranked, selectedMedia, genres: Array.from(genres, ([name, records]) => ({ name, records })).sort((a, b) => b.records - a.records), hours, weekdays, timeline, monthly: Array.from(monthlyMap, ([name, records]) => ({ name, records })).sort((a, b) => a.name.localeCompare(b.name)), activeAccounts, requestRows, commentRows, missingDates: data.history.filter(matches).filter(h => historyDate(h) === null).length, missingMedia: rows.filter(h => !mediaMap.has(String(h.media_id))).length, neverConsulted: selectedMedia.filter(m => !allReferenced.has(String(m.id))).length, start, today };
}

export interface DailyActivity { user_id: string; activity_date: string; last_seen: string }
// Reconcile sources by account, not by taking the maximum of two counts.
// Only supplement today's bucket: older last_seen snapshots are incomplete.
export function mergePresenceToday(daily: DailyActivity[], presence: Presence[], now: number): DailyActivity[] {
  const today = dayKey(new Date(now));
  const rows = new Map<string, DailyActivity>();
  for (const row of daily) {
    const key = `${row.activity_date}:${row.user_id}`;
    const previous = rows.get(key);
    if (!previous || (dateValue(row.last_seen) ?? 0) > (dateValue(previous.last_seen) ?? 0)) rows.set(key, row);
  }
  for (const row of presence) {
    const stamp = dateValue(row.last_seen);
    if (!row.user_id || stamp === null || stamp > now + 60_000) continue;
    const safeStamp = Math.min(stamp, now);
    if (dayKey(new Date(safeStamp)) !== today) continue;
    const key = `${today}:${row.user_id}`;
    const previous = rows.get(key);
    if (!previous || safeStamp > (dateValue(previous.last_seen) ?? 0)) rows.set(key, { user_id: row.user_id, activity_date: today, last_seen: new Date(safeStamp).toISOString() });
  }
  return [...rows.values()];
}
// A saved history timestamp proves activity on that date, but cannot recover
// overwritten visits. Never synthesize zeroes for days without evidence.
export function recoverHistoricalConnections(history: History[], presence: Presence[], now: number) {
  const days = new Map<string, Set<string>>();
  const users = new Set<string>();
  const add = (id: string | undefined, value: string | undefined) => {
    const stamp = dateValue(value);
    if (!id || stamp === null || stamp > now) return;
    const key = dayKey(new Date(stamp));
    const set = days.get(key) ?? new Set<string>();
    set.add(id); users.add(id); days.set(key, set);
  };
  for (const row of history) {
    add(row.user_id, row.created_at);
    add(row.user_id, row.updated_at);
    add(row.user_id, row.watched_at);
  }
  for (const row of presence) add(row.user_id, row.last_seen);
  const result = Array.from(days, ([name, set]) => ({ name, connections: set.size })).sort((a, b) => a.name.localeCompare(b.name));
  return { days: result, firstDay: result[0]?.name ?? '', totalUsers: users.size };
}
export function buildConnections(daily: DailyActivity[], timeline: { name: string }[], start: string, now: number) {
    const today = dayKey(new Date(now));
    const unique = (from: string, to = today) => new Set(daily.filter(d => d.activity_date >= from && d.activity_date <= to).map(d => d.user_id)).size;
    const map = new Map<string, Set<string>>();
    for (const row of daily) { const set = map.get(row.activity_date) ?? new Set<string>(); set.add(row.user_id); map.set(row.activity_date, set); }
    const trend = timeline.map(t => ({ name: t.name, connections: map.get(t.name)?.size ?? 0 }));
    const yesterday = shiftDay(today, -1);
    const todayUsers = map.get(today) ?? new Set<string>();
    const yesterdayUsers = map.get(yesterday) ?? new Set<string>();
    const returning = [...todayUsers].filter(id => yesterdayUsers.has(id)).length;
    const firstDay = daily.reduce((min, r) => !min || r.activity_date < min ? r.activity_date : min, '');
    const trackedDays = firstDay ? trend.filter(t => t.name >= firstDay && t.name <= today) : [];
    return { today: todayUsers.size, yesterday: yesterdayUsers.size, week: unique(shiftDay(today, -6)), month: unique(shiftDay(today, -29)), returning, retention: percent(returning, yesterdayUsers.size), trend, selected: unique(start || firstDay), firstDay, average: trackedDays.length ? trackedDays.reduce((sum, t) => sum + t.connections, 0) / trackedDays.length : 0, peak: trackedDays.reduce((best, t) => t.connections > best.connections ? t : best, { name: '', connections: 0 }), stickiness: percent(todayUsers.size, unique(shiftDay(today, -29))) };
}
