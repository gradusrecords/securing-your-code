import { beforeEach, describe, expect, test, vi } from 'vitest';

const getSession = vi.fn();
const single = vi.fn();
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: { getSession: (...a: unknown[]) => getSession(...a), onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })) },
    from: () => ({ select: () => ({ eq: () => ({ single }) }) }),
  },
}));

import { resolveAdminState } from './useAdminSession';

beforeEach(() => { vi.clearAllMocks(); });
const session = { user: { id: 'u1', email: 'boss@zaya.uz' } };

describe('resolveAdminState', () => {
  test('no session means signedOut', async () => {
    getSession.mockResolvedValue({ data: { session: null }, error: null });
    expect(await resolveAdminState()).toEqual({ status: 'signedOut' });
  });
  test('a model account is forbidden', async () => {
    getSession.mockResolvedValue({ data: { session }, error: null });
    single.mockResolvedValue({ data: { role: 'model', is_blocked: false }, error: null });
    expect(await resolveAdminState()).toEqual({ status: 'forbidden' });
  });
  test('a blocked admin is forbidden', async () => {
    getSession.mockResolvedValue({ data: { session }, error: null });
    single.mockResolvedValue({ data: { role: 'admin', is_blocked: true }, error: null });
    expect(await resolveAdminState()).toEqual({ status: 'forbidden' });
  });
  test('an admin gets in', async () => {
    getSession.mockResolvedValue({ data: { session }, error: null });
    single.mockResolvedValue({ data: { role: 'admin', is_blocked: false }, error: null });
    expect(await resolveAdminState()).toEqual({ status: 'admin', email: 'boss@zaya.uz' });
  });
  test('a profile query error falls back to signedOut', async () => {
    getSession.mockResolvedValue({ data: { session }, error: null });
    single.mockResolvedValue({ data: null, error: { message: 'boom' } });
    expect(await resolveAdminState()).toEqual({ status: 'signedOut' });
  });
  test('a thrown error falls back to signedOut', async () => {
    getSession.mockRejectedValue(new Error('network'));
    expect(await resolveAdminState()).toEqual({ status: 'signedOut' });
  });
});
