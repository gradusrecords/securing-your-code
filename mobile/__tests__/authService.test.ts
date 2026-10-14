jest.mock('expo-apple-authentication', () => ({ signInAsync: jest.fn(), AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 } }));
jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: { configure: jest.fn(), hasPlayServices: jest.fn(), signIn: jest.fn() },
  statusCodes: { SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED' },
}));
jest.mock('../src/lib/supabase', () => {
  const single = jest.fn();
  return {
    supabase: {
      auth: { signUp: jest.fn(), signInWithPassword: jest.fn(), signOut: jest.fn(), getUser: jest.fn() },
      rpc: jest.fn(),
      from: jest.fn(() => ({ select: () => ({ eq: () => ({ single }) }) })),
      __single: single,
    },
  };
});

import { supabase } from '../src/lib/supabase';
import { getMyRole, setMyRole, signInWithEmail, signOut, signUpWithEmail } from '../src/auth/authService';

const mocked = supabase as any;
const mockAuth = mocked.auth;
const mockRpc = mocked.rpc;
const mockSingle = mocked.__single;

beforeEach(() => jest.clearAllMocks());

test('signUpWithEmail passes the chosen role as signup metadata', async () => {
  mockAuth.signUp.mockResolvedValue({ error: null });
  await signUpWithEmail('a@x.uz', 'secret12', 'business');
  expect(mockAuth.signUp).toHaveBeenCalledWith({
    email: 'a@x.uz',
    password: 'secret12',
    options: { data: { role: 'business' } },
  });
});

test('signInWithEmail throws an Error carrying the Supabase message', async () => {
  mockAuth.signInWithPassword.mockResolvedValue({ error: { message: 'Invalid login credentials' } });
  await expect(signInWithEmail('a@x.uz', 'bad')).rejects.toThrow('Invalid login credentials');
});

test('getMyRole returns null when the profile has no role yet', async () => {
  mockAuth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
  mockSingle.mockResolvedValue({ data: { role: null }, error: null });
  await expect(getMyRole()).resolves.toBeNull();
});

test('getMyRole returns the stored role', async () => {
  mockAuth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
  mockSingle.mockResolvedValue({ data: { role: 'model' }, error: null });
  await expect(getMyRole()).resolves.toBe('model');
});

test('setMyRole calls the set_my_role RPC', async () => {
  mockRpc.mockResolvedValue({ error: null });
  await setMyRole('model');
  expect(mockRpc).toHaveBeenCalledWith('set_my_role', { new_role: 'model' });
});

test('signOut delegates to Supabase', async () => {
  mockAuth.signOut.mockResolvedValue({ error: null });
  await signOut();
  expect(mockAuth.signOut).toHaveBeenCalled();
});
