import test from 'node:test';
import assert from 'node:assert/strict';
import { readConsent, contactable, unsubscribeToken, verifyUnsubscribeToken, unsubscribeUrl, toCsv } from './marketing.ts';

test('consent is read strictly from metadata', () => {
  assert.equal(readConsent({ marketing_consent: true }), true);
  assert.equal(readConsent({ marketing_consent: false }), false);
  assert.equal(readConsent({ marketing_consent: 'true' }), null);
  assert.equal(readConsent(null), null);
});

test('free members need consent; paying customers may be contacted unless they refused', () => {
  assert.equal(contactable(null, false).ok, false);
  assert.equal(contactable(true, false).ok, true);
  assert.equal(contactable(null, true).ok, true);
  assert.equal(contactable(false, true).ok, false);
});

test('unsubscribe tokens are bound to the email and the secret', () => {
  const token = unsubscribeToken('Jean@Mail.fr ', 'secret');
  assert.ok(verifyUnsubscribeToken('jean@mail.fr', token, 'secret'));
  assert.equal(verifyUnsubscribeToken('autre@mail.fr', token, 'secret'), false);
  assert.equal(verifyUnsubscribeToken('jean@mail.fr', token, 'autre-secret'), false);
  assert.equal(verifyUnsubscribeToken('jean@mail.fr', 'court', 'secret'), false);
  assert.equal(unsubscribeUrl('https://site.fr/', 'Jean@Mail.fr', 'secret'), `https://site.fr/desinscription?e=jean%40mail.fr&t=${token}`);
});

test('CSV escapes quotes and neutralises spreadsheet formulas', () => {
  assert.equal(toCsv([['a"b', '=SUM(A1)', 3]]), '﻿"a""b";"\'=SUM(A1)";"3"');
});
