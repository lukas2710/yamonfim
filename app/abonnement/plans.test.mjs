import test from 'node:test';
import assert from 'node:assert/strict';
import { PLANS, checkoutUrl, expirationDate, formatEuro, nextSundayReset } from './plans.ts';

test('existing prices and Stripe destinations are preserved', () => {
  assert.deepEqual(PLANS.map(p => p.price), [3.99, 15, 50]);
  assert.deepEqual(PLANS.map(p => new URL(p.stripeLink).pathname), ['/aFa7sK2HT9tnfaD3qif3a0n', '/eVq6oGeqBbBvbYrbWOf3a0m', '/bJedR896h8pjbYrd0Sf3a0o']);
});
test('checkout encodes the exact account email and identifier without altering the selected offer', () => {
  const url = new URL(checkoutUrl(PLANS[1], 'account-123', 'cinema+vip@example.com'));
  assert.equal(url.origin + url.pathname, PLANS[1].stripeLink);
  assert.equal(url.searchParams.get('prefilled_email'), 'cinema+vip@example.com');
  assert.equal(url.searchParams.get('client_reference_id'), 'account-123');
});
test('checkout cannot proceed without a verifiable account or with an unexpected destination', () => {
  assert.throws(() => checkoutUrl(PLANS[0], '', 'test@example.com'));
  assert.throws(() => checkoutUrl(PLANS[0], 'account', ''));
  assert.throws(() => checkoutUrl({ ...PLANS[0], stripeLink: 'http://buy.stripe.com/test' }, 'account', 'test@example.com'));
  assert.throws(() => checkoutUrl({ ...PLANS[0], stripeLink: 'https://buy.stripe.com.example.com/test' }, 'account', 'test@example.com'));
});
test('missing or invalid VIP details produce an unknown expiry, not a false zero countdown', () => {
  assert.equal(expirationDate(), null);
  assert.equal(expirationDate('invalid', '3m'), null);
  assert.equal(expirationDate('2026-10-20', 'unknown'), null);
});
test('VIP expiry follows the existing administrator calendar rules', () => {
  const date = new Date('2026-10-20T12:00:00Z');
  date.setMonth(date.getMonth() + 3);
  assert.equal(expirationDate('2026-10-20T12:00:00Z', '3m'), date.getTime());
  assert.match(formatEuro(3.99), /3,99/);
});

test('weekly countdown targets Sunday midnight in Paris, including DST changes', () => {
  assert.equal(new Date(nextSundayReset(Date.parse('2026-10-20T12:00:00Z'))).toISOString(), '2026-10-24T22:00:00.000Z');
  assert.equal(new Date(nextSundayReset(Date.parse('2026-03-28T12:00:00Z'))).toISOString(), '2026-03-28T23:00:00.000Z');
  assert.equal(new Date(nextSundayReset(Date.parse('2026-10-25T02:00:00Z'))).toISOString(), '2026-10-31T23:00:00.000Z');
});
