const auth = {
  signUp: jest.fn(),
  signInWithPassword: jest.fn(),
  signOut: jest.fn(),
  getUser: jest.fn(),
};
const rpc = jest.fn();
const single = jest.fn();
const from = jest.fn(() => ({ select: () => ({ eq: () => ({ single }) }) }));

jest.mock('../src/lib/supabase', () => ({
  supabase: { auth, rpc, from },
}));

import { getMyRole, setMyRole, signInWithEmail, signOut, signUpWithEmail } from '../src/auth/authService';

beforeEach(() => jest.clearAllMocks());

test('signUpWithEmail passes the chosen role as signup metadata', async () => {
  auth.signUp.mockResolvedValue({ error: null });
  await signUpWithEmail('a@x.uz', 'secret12', 'business');
  expect(auth.signUp).toHaveBeenCalledWith({
    email: 'a@x.uz',
    password: 'secret12',
    options: { data: { role: 'business' } },
  });
});

test('signInWithEmail throws an Error carrying the Supabase message', async () => {
  auth.signInWithPassword.mockResolvedValue({ error: { message: 'Invalid login credentials' } });
  await expect(signInWithEmail('a@x.uz', 'bad')).rejects.toThrow('Invalid login credentials');
});

test('getMyRole returns null when the profile has no role yet', async () => {
  auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
  single.mockResolvedValue({ data: { role: null }, error: null });
  await expect(getMyRole()).resolves.toBeNull();
});

test('getMyRole returns the stored role', async () => {
  auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
  single.mockResolvedValue({ data: { role: 'model' }, error: null });
  await expect(getMyRole()).resolves.toBe('model');
});

test('setMyRole calls the set_my_role RPC', async () => {
  rpc.mockResolvedValue({ error: null });
  await setMyRole('model');
  expect(rpc).toHaveBeenCalledWith('set_my_role', { new_role: 'model' });
});

test('signOut delegates to Supabase', async () => {
  auth.signOut.mockResolvedValue({ error: null });
  await signOut();
  expect(auth.signOut).toHaveBeenCalled();
});
