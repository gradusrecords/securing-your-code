jest.mock('../src/lib/supabase', () => ({
  supabase: { auth: { signInWithIdToken: jest.fn() } },
}));
jest.mock('expo-apple-authentication', () => ({
  signInAsync: jest.fn(),
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
}));
jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: { configure: jest.fn(), hasPlayServices: jest.fn(), signIn: jest.fn() },
  statusCodes: { SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED' },
}));

import * as Apple from 'expo-apple-authentication';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { supabase } from '../src/lib/supabase';
import { signInWithApple, signInWithGoogle } from '../src/auth/authService';

const idTokenCall = supabase.auth.signInWithIdToken as jest.Mock;
const appleSignIn = Apple.signInAsync as jest.Mock;
const googleSignIn = GoogleSignin.signIn as jest.Mock;

beforeEach(() => jest.clearAllMocks());

test('signInWithGoogle exchanges the Google idToken with Supabase', async () => {
  googleSignIn.mockResolvedValue({ data: { idToken: 'g-token' } });
  idTokenCall.mockResolvedValue({ error: null });
  await signInWithGoogle();
  expect(idTokenCall).toHaveBeenCalledWith({ provider: 'google', token: 'g-token' });
});

test('signInWithApple exchanges the Apple identityToken with Supabase', async () => {
  appleSignIn.mockResolvedValue({ identityToken: 'a-token', email: null, fullName: null });
  idTokenCall.mockResolvedValue({ error: null });
  await signInWithApple();
  expect(idTokenCall).toHaveBeenCalledWith({ provider: 'apple', token: 'a-token' });
});

test('cancelling Apple sign-in resolves quietly without calling Supabase', async () => {
  appleSignIn.mockRejectedValue({ code: 'ERR_REQUEST_CANCELED' });
  await expect(signInWithApple()).resolves.toBeUndefined();
  expect(idTokenCall).not.toHaveBeenCalled();
});

test('cancelling Google sign-in resolves quietly without calling Supabase', async () => {
  googleSignIn.mockRejectedValue({ code: 'SIGN_IN_CANCELLED' });
  await expect(signInWithGoogle()).resolves.toBeUndefined();
  expect(idTokenCall).not.toHaveBeenCalled();
});

test('Apple repeat sign-in without email and name still succeeds', async () => {
  appleSignIn.mockResolvedValue({ identityToken: 'a-token-2' });
  idTokenCall.mockResolvedValue({ error: null });
  await expect(signInWithApple()).resolves.toBeUndefined();
  expect(idTokenCall).toHaveBeenCalledTimes(1);
});

test('a Supabase error is surfaced as an Error', async () => {
  googleSignIn.mockResolvedValue({ data: { idToken: 'g' } });
  idTokenCall.mockResolvedValue({ error: { message: 'provider disabled' } });
  await expect(signInWithGoogle()).rejects.toThrow('provider disabled');
});
