jest.mock('../src/lib/supabase', () => ({
  supabase: { auth: { getSession: jest.fn(), onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })) } },
}));
jest.mock('../src/auth/authService', () => ({ getMyRole: jest.fn() }));

import { supabase } from '../src/lib/supabase';
import { getMyRole } from '../src/auth/authService';
import { loadSessionState, routeFor } from '../src/auth/sessionState';

const getSession = supabase.auth.getSession as jest.Mock;
const role = getMyRole as jest.Mock;
beforeEach(() => jest.clearAllMocks());

test('routeFor maps every state to its screen', () => {
  expect(routeFor({ status: 'loading' })).toBe('/splash');
  expect(routeFor({ status: 'signedOut' })).toBe('/(auth)/login');
  expect(routeFor({ status: 'needsRole' })).toBe('/(auth)/choose-role');
  expect(routeFor({ status: 'ready', role: 'model' })).toBe('/(model)/development');
  expect(routeFor({ status: 'ready', role: 'business' })).toBe('/(business)/orders');
  expect(routeFor({ status: 'ready', role: 'admin' })).toBe('/(auth)/admin-note');
});

test('no session means signedOut', async () => {
  getSession.mockResolvedValue({ data: { session: null }, error: null });
  await expect(loadSessionState()).resolves.toEqual({ status: 'signedOut' });
});

test('an expired or revoked session (refresh error) means signedOut', async () => {
  getSession.mockResolvedValue({ data: { session: null }, error: { message: 'Invalid Refresh Token' } });
  await expect(loadSessionState()).resolves.toEqual({ status: 'signedOut' });
});

test('a session without a role needs the role choice screen, not a crash', async () => {
  getSession.mockResolvedValue({ data: { session: { user: { id: 'u' } } }, error: null });
  role.mockResolvedValue(null);
  await expect(loadSessionState()).resolves.toEqual({ status: 'needsRole' });
});

test('a session with a role is ready', async () => {
  getSession.mockResolvedValue({ data: { session: { user: { id: 'u' } } }, error: null });
  role.mockResolvedValue('business');
  await expect(loadSessionState()).resolves.toEqual({ status: 'ready', role: 'business' });
});

test('a failure while loading the role falls back to signedOut', async () => {
  getSession.mockResolvedValue({ data: { session: { user: { id: 'u' } } }, error: null });
  role.mockRejectedValue(new Error('network'));
  await expect(loadSessionState()).resolves.toEqual({ status: 'signedOut' });
});
