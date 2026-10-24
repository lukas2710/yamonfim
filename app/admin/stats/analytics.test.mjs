import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAnalytics, buildConnections, mergePresenceToday, recoverHistoricalConnections, validateRegistrations, registrationSummary, dayKey, shiftDay, vipExpiry, emptyDataset } from './analytics.ts';

const now = Date.parse('2026-10-20T12:00:00Z');
const dataset = extra => ({ ...emptyDataset, ...extra });

test('malformed registration data is reported rather than silently converted to zero', () => {
  assert.throws(() => validateRegistrations([{ registration_date: '24/10/2026', registrations: 3 }]));
  assert.throws(() => validateRegistrations([{ registration_date: '2026-10-24', count: 3 }]));
  assert.throws(() => validateRegistrations([null]));
  assert.deepEqual(validateRegistrations([{ registration_date: '2026-10-24', registrations: '3' }]), [{ registration_date: '2026-10-24', registrations: 3 }]);
  assert.deepEqual(validateRegistrations([]), []);
});

test('signups use actual Auth registrations even when profile dates are missing or wrong', () => {
  const stats = buildAnalytics(dataset({ profiles: [{ id: 'old', created_at: '2026-10-20T09:00:00Z' }, { id: 'new' }], registrations: [
    { registration_date: '2026-10-20', registrations: '3' },
    { registration_date: '2026-10-14', registrations: 2 },
    { registration_date: '2026-10-13', registrations: 5 },
    { registration_date: '2026-10-21', registrations: 10 },
  ] }), 7, 'movie', now);
  assert.equal(stats.signups, 5);
  assert.equal(stats.timeline.at(-1).signups, 3);
  assert.equal(stats.timeline[0].signups, 2);
});

test('empty authoritative registration data does not count profile creation as a signup', () => {
  const stats = buildAnalytics(dataset({ profiles: [{ id: 'u', created_at: '2026-10-20T09:00:00Z' }], registrations: [] }), 7, 'all', now);
  assert.equal(stats.signups, 0);
});

test('Paris calendar dates include the local midnight and handle DST', () => {
  assert.equal(dayKey(new Date('2026-10-19T22:30:00Z')), '2026-10-20');
  assert.equal(dayKey(new Date('2026-10-25T23:30:00Z')), '2026-10-26');
  assert.equal(shiftDay('2026-10-26', -1), '2026-10-25');
  assert.equal(shiftDay('2026-03-01', -1), '2026-02-28');
});

test('period comparison uses dated calendar ranges, omits invalid/future data, and fills quiet days', () => {
  const input = dataset({ history: [
    { media_id: '1', user_id: 'u', updated_at: '2026-10-19T22:30:00Z' },
    { media_id: '2', user_id: 'u', updated_at: '2026-10-14T12:00:00Z' },
    { media_id: '3', user_id: 'v', updated_at: '2026-10-13T12:00:00Z' },
    { media_id: '4', updated_at: 'broken' },
    { media_id: '5', updated_at: '2026-10-21T12:00:00Z' },
  ] });
  const stats = buildAnalytics(input, 7, 'all', now);
  assert.equal(stats.start, '2026-10-14');
  assert.equal(stats.rows.length, 2);
  assert.equal(stats.previousCount, 1);
  assert.equal(stats.users, 1);
  assert.equal(stats.missingDates, 1);
  assert.equal(stats.timeline.length, 7);
  assert.equal(stats.timeline[6].records, 1);
  assert.equal(stats.timeline[1].records, 0);
});

test('same-title media stay separate, users deduplicate, and missing media are not labelled as films', () => {
  const stats = buildAnalytics(dataset({
    profiles: [{ id: 'u', is_vip: true }],
    media: [{ id: 'a', title: 'Même titre', type: 'movie', genres: ['Action', 'Action'] }, { id: 'b', title: 'Même titre', type: 'series' }, { id: 'c', title: 'Jamais consulté', type: 'movie' }],
    history: [
      { media_id: 'a', user_id: 'u', profile_id: 'p1', updated_at: '2026-10-20T10:00:00Z' },
      { media_id: 'a', user_id: 'u', profile_id: 'p2', updated_at: '2026-10-20T10:00:00Z' },
      { media_id: 'b', user_id: 'u', updated_at: '2026-10-20T10:00:00Z' },
      { media_id: 'deleted', user_id: 'removed', updated_at: '2026-10-20T10:00:00Z' },
    ],
  }), 7, 'all', now);
  assert.equal(stats.ranked.find(m => m.id === 'a').count, 2);
  assert.equal(stats.ranked.find(m => m.id === 'a').audience, 1);
  assert.equal(stats.ranked.find(m => m.id === 'b').count, 1);
  assert.equal(stats.neverConsulted, 1);
  assert.equal(stats.genres[0].records, 2);
  assert.equal(stats.missingMedia, 1);
  assert.equal(stats.unknownRecords, 1);
  assert.equal(stats.vipRecords, 3);
});

test('progress percentages clamp outliers and exclude unknown or invalid duration', () => {
  const stats = buildAnalytics(dataset({ history: [
    { current_time: 200, duration: 100, updated_at: '2026-10-20T10:00:00Z' },
    { current_time: 50, duration: 100, updated_at: '2026-10-20T10:00:00Z' },
    { current_time: -50, duration: 0, updated_at: '2026-10-20T10:00:00Z' },
    { current_time: NaN, duration: NaN, updated_at: '2026-10-20T10:00:00Z' },
  ] }), 30, 'all', now);
  assert.equal(stats.progress, 75);
  assert.equal(stats.measured, 2);
  assert.equal(stats.complete, 1);
  assert.equal(stats.positions, 150);
});

test('film filter affects content activity but not registrations', () => {
  const stats = buildAnalytics(dataset({ profiles: [{ id: 'u', created_at: '2026-10-20T10:00:00Z' }], media: [{ id: 'm', type: 'movie' }, { id: 's', type: 'series' }], history: [{ media_id: 'm', updated_at: '2026-10-20T10:00:00Z' }, { media_id: 's', updated_at: '2026-10-20T10:00:00Z' }] }), 7, 'movie', now);
  assert.equal(stats.rows.length, 1);
  assert.equal(stats.ranked.length, 1);
  assert.equal(stats.signups, 1);
});

test('monthly aggregation never mixes the same month in different years', () => {
  const stats = buildAnalytics(dataset({ history: [{ updated_at: '2025-10-10T12:00:00Z' }, { updated_at: '2026-10-10T12:00:00Z' }] }), 0, 'all', now);
  assert.deepEqual(stats.monthly.map(v => v.name), ['2025-10', '2026-10']);
});

test('daily audience deduplicates accounts and computes overlapping windows and returns', () => {
  const timeline = Array.from({ length: 7 }, (_, i) => ({ name: shiftDay('2026-10-14', i) }));
  const rows = [
    { user_id: 'a', activity_date: '2026-10-20' },
    { user_id: 'a', activity_date: '2026-10-20' },
    { user_id: 'b', activity_date: '2026-10-20' },
    { user_id: 'a', activity_date: '2026-10-19' },
    { user_id: 'c', activity_date: '2026-10-19' },
    { user_id: 'd', activity_date: '2026-10-01' },
    { user_id: 'future', activity_date: '2026-10-21' },
  ];
  const stats = buildConnections(rows, timeline, '2026-10-14', now);
  assert.equal(stats.today, 2);
  assert.equal(stats.yesterday, 2);
  assert.equal(stats.week, 3);
  assert.equal(stats.month, 4);
  assert.equal(stats.selected, 3);
  assert.equal(stats.returning, 1);
  assert.equal(stats.retention, 50);
  assert.equal(stats.stickiness, 50);
  assert.equal(stats.trend[6].connections, 2);
});

test('untracked days do not dilute daily averages', () => {
  const stats = buildConnections([{ user_id: 'a', activity_date: '2026-10-20' }], [{ name: '2026-10-19' }, { name: '2026-10-20' }], '2026-10-19', now);
  assert.equal(stats.average, 1);
  assert.equal(stats.firstDay, '2026-10-20');
});

test('VIP expiry matches the existing Admin VIP countdown and unknown plans', () => {
  const start = new Date('2026-01-31T12:00:00Z');
  start.setMonth(start.getMonth() + 3);
  assert.equal(vipExpiry({ id: 'u', vip_started_at: '2026-01-31T12:00:00Z', vip_duration: '3m' }), start.getTime());
  const leap = new Date('2024-02-29T12:00:00Z');
  leap.setFullYear(leap.getFullYear() + 1);
  assert.equal(vipExpiry({ id: 'u', vip_started_at: '2024-02-29T12:00:00Z', vip_duration: '1y' }), leap.getTime());
  assert.equal(vipExpiry({ id: 'u', vip_duration: 'unknown' }), null);
});

test('historical recovery deduplicates dated evidence and does not invent missing days', () => {
  const recovered = recoverHistoricalConnections([
    { user_id: 'a', created_at: '2024-01-01T12:00:00Z', updated_at: '2026-10-19T22:30:00Z' },
    { user_id: 'a', updated_at: '2026-10-20T10:00:00Z', watched_at: '2026-10-20T09:00:00Z' },
    { user_id: 'b', updated_at: '2026-10-20T10:00:00Z' },
    { user_id: 'future', updated_at: '2026-10-21T12:00:00Z' },
    { user_id: 'broken', updated_at: 'invalid' },
    { updated_at: '2025-01-01T10:00:00Z' },
  ], [
    { user_id: 'a', last_seen: '2026-10-20T11:00:00Z' },
    { user_id: 'c', last_seen: '2026-10-20T11:00:00Z' },
  ], now);
  assert.equal(recovered.firstDay, '2024-01-01');
  assert.equal(recovered.totalUsers, 3);
  assert.deepEqual(recovered.days, [{ name: '2024-01-01', connections: 1 }, { name: '2026-10-20', connections: 3 }]);
  assert.equal(recovered.days.some(day => day.name === '2026-10-19'), false);
});

test('empty historical recovery stays unknown instead of creating zero-valued dates', () => {
  const recovered = recoverHistoricalConnections([], [], now);
  assert.deepEqual(recovered, { days: [], firstDay: '', totalUsers: 0 });
});

test('one daily record plus three present accounts counts three, not one or four', () => {
  const daily = [{ user_id: 'a', activity_date: '2026-10-20', last_seen: '2026-10-20T11:00:00Z' }];
  const presence = ['a', 'b', 'c'].map(user_id => ({ user_id, last_seen: '2026-10-20T11:59:00Z' }));
  const merged = mergePresenceToday(daily, presence, now);
  const stats = buildConnections(merged, [{ name: '2026-10-20' }], '2026-10-20', now);
  assert.equal(stats.today, 3);
  assert.equal(stats.trend[0].connections, 3);
  assert.equal(merged.length, 3);
});

test('daily total retains disconnected accounts and unions distinct identities', () => {
  const daily = ['a', 'b'].map(user_id => ({ user_id, activity_date: '2026-10-20', last_seen: '2026-10-20T09:00:00Z' }));
  const observed = mergePresenceToday(daily, [{ user_id: 'c', last_seen: '2026-10-20T11:00:00Z' }], now);
  const later = mergePresenceToday(observed, [{ user_id: 'd', last_seen: '2026-10-20T11:30:00Z' }], now);
  assert.equal(buildConnections(later, [{ name: '2026-10-20' }], '2026-10-20', now).today, 4);
});

test('reconciliation excludes yesterday and invalid presence, tolerates small clock skew', () => {
  const merged = mergePresenceToday([], [
    { user_id: 'yesterday', last_seen: '2026-10-18T23:00:00Z' },
    { user_id: 'broken', last_seen: 'invalid' },
    { user_id: 'future', last_seen: '2026-10-20T13:00:00Z' },
    { user_id: 'skew', last_seen: '2026-10-20T12:00:30Z' },
  ], now);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].user_id, 'skew');
  assert.equal(merged[0].last_seen, new Date(now).toISOString());
});

test('today bucket changes at Paris midnight without moving yesterday records', () => {
  const midnight = Date.parse('2026-10-19T22:01:00Z');
  const merged = mergePresenceToday([{ user_id: 'a', activity_date: '2026-10-19', last_seen: '2026-10-19T21:59:00Z' }], [{ user_id: 'a', last_seen: '2026-10-19T22:00:30Z' }], midnight);
  assert.deepEqual(merged.map(r => r.activity_date).sort(), ['2026-10-19', '2026-10-20']);
});

test('registration summary uses fixed windows independent of the period filter', () => {
  const summary = registrationSummary([
    { registration_date: '2026-09-01', registrations: 4 },
    { registration_date: '2026-10-14', registrations: 2 },
    { registration_date: '2026-10-19', registrations: 1 },
    { registration_date: '2026-10-20', registrations: 3 },
  ], now);
  assert.deepEqual(summary, { today: 3, yesterday: 1, week: 6, month: 6, total: 10, first: '2026-09-01', last: '2026-10-20' });
});
