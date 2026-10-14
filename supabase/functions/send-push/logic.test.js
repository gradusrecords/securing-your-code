import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMessages, chunk, interpretTickets } from './logic.js';

const row = (id, user) => ({ id, user_id: user, title: `T${id}`, body: `B${id}`, data: { order_id: 'o1' } });

test('buildMessages makes an Expo message per row with a token', () => {
  const { messages, skipped } = buildMessages([row('n1', 'u1')], { u1: 'ExponentPushToken[abc]' });
  assert.equal(skipped.length, 0);
  assert.deepEqual(messages[0], {
    to: 'ExponentPushToken[abc]', title: 'Tn1', body: 'Bn1', sound: 'default',
    data: { order_id: 'o1', notification_id: 'n1' },
  });
});

test('rows without a token are skipped, not sent', () => {
  const { messages, skipped } = buildMessages([row('n1', 'u1'), row('n2', 'u2')], { u2: 'ExponentPushToken[x]' });
  assert.deepEqual(skipped, ['n1']);
  assert.equal(messages.length, 1);
});

test('an empty input gives empty output', () => {
  assert.deepEqual(buildMessages([], {}), { messages: [], skipped: [] });
});

test('chunk splits 250 items into 100/100/50', () => {
  const parts = chunk(Array.from({ length: 250 }, (_, i) => i), 100);
  assert.deepEqual(parts.map((p) => p.length), [100, 100, 50]);
});

test('chunk of nothing is nothing', () => {
  assert.deepEqual(chunk([], 100), []);
});

test('interpretTickets separates sent, failed and invalid tokens', () => {
  const r = interpretTickets(['n1', 'n2', 'n3'], [
    { status: 'ok' },
    { status: 'error', message: 'rate limited', details: { error: 'MessageRateExceeded' } },
    { status: 'error', message: 'not registered', details: { error: 'DeviceNotRegistered' } },
  ]);
  assert.deepEqual(r.sent, ['n1']);
  assert.deepEqual(r.failed.map((f) => f.id), ['n2', 'n3']);
  assert.equal(r.failed[0].error, 'rate limited');
  assert.deepEqual(r.invalidTokenIds, ['n3']);
});

test('a short ticket list marks the missing ones as failed instead of losing them', () => {
  const r = interpretTickets(['n1', 'n2'], [{ status: 'ok' }]);
  assert.deepEqual(r.sent, ['n1']);
  assert.deepEqual(r.failed.map((f) => f.id), ['n2']);
});
