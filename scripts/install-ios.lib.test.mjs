import test from 'node:test';
import assert from 'node:assert/strict';
import { checkAnonKey, nodeVersionOk, normalizeSupabaseUrl } from './install-ios.lib.mjs';

const jwt = (payload) => `${Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url')}.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.sig`;

test('a project URL is normalised: trailing slash and spaces are dropped', () => {
  assert.equal(normalizeSupabaseUrl('  https://abc.supabase.co/ '), 'https://abc.supabase.co');
});

test('a URL without https or without a host is rejected', () => {
  assert.throws(() => normalizeSupabaseUrl('http://abc.supabase.co'), /https/);
  assert.throws(() => normalizeSupabaseUrl('abc.supabase.co'), /https/);
  assert.throws(() => normalizeSupabaseUrl(''), /URL/);
});

test('the dashboard page URL is rejected with a helpful message', () => {
  assert.throws(() => normalizeSupabaseUrl('https://supabase.com/dashboard/project/abc'), /Project URL/);
});

test('an anon key is accepted', () => {
  const key = jwt({ role: 'anon', ref: 'abc' });
  assert.equal(checkAnonKey(key), key);
});

test('a service_role key is refused: it must never reach the app', () => {
  assert.throws(() => checkAnonKey(jwt({ role: 'service_role' })), /service_role/);
});

test('something that is not a JWT is refused', () => {
  assert.throws(() => checkAnonKey('hello'), /anon/);
  assert.throws(() => checkAnonKey(''), /anon/);
});

test('a JWT with an unreadable payload is refused', () => {
  assert.throws(() => checkAnonKey('aaa.@@@.ccc'), /anon/);
});

test('Node 20 and newer are accepted, older ones are not', () => {
  assert.equal(nodeVersionOk('v22.1.0'), true);
  assert.equal(nodeVersionOk('v20.0.0'), true);
  assert.equal(nodeVersionOk('v18.19.0'), false);
});
