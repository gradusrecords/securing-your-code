import * as AppleAuthentication from 'expo-apple-authentication';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { supabase } from '../lib/supabase';

export type Role = 'model' | 'business' | 'admin';

export async function signUpWithEmail(
  email: string,
  password: string,
  role: 'model' | 'business',
): Promise<void> {
  const { error } = await supabase.auth.signUp({ email, password, options: { data: { role } } });
  if (error) throw new Error(error.message);
}

export async function signInWithEmail(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(error.message);
}

export async function getMyRole(): Promise<Role | null> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return null;
  const { data, error } = await supabase.from('profiles').select('role').eq('id', userId).single();
  if (error) throw new Error(error.message);
  return (data?.role as Role | null) ?? null;
}

export async function setMyRole(role: 'model' | 'business'): Promise<void> {
  const { error } = await supabase.rpc('set_my_role', { new_role: role });
  if (error) throw new Error(error.message);
}

const isCancelled = (e: unknown, ...codes: string[]) =>
  typeof e === 'object' && e !== null && codes.includes((e as { code?: string }).code ?? '');

async function exchangeIdToken(provider: 'google' | 'apple', token: string): Promise<void> {
  const { error } = await supabase.auth.signInWithIdToken({ provider, token });
  if (error) throw new Error(error.message);
}

export async function signInWithGoogle(): Promise<void> {
  GoogleSignin.configure({
    webClientId: process.env.GOOGLE_WEB_CLIENT_ID,
    iosClientId: process.env.GOOGLE_IOS_CLIENT_ID,
  });
  try {
    await GoogleSignin.hasPlayServices();
    const res = (await GoogleSignin.signIn()) as {
      type?: string;
      data?: { idToken?: string | null };
      idToken?: string | null;
    };
    if (res.type === 'cancelled') return;
    const token = res.data?.idToken ?? res.idToken;
    if (!token) throw new Error('Google did not return an idToken');
    await exchangeIdToken('google', token);
  } catch (e) {
    if (isCancelled(e, statusCodes.SIGN_IN_CANCELLED)) return;
    throw e;
  }
}

export async function signInWithApple(): Promise<void> {
  try {
    const cred = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
    if (!cred.identityToken) throw new Error('Apple did not return an identityToken');
    await exchangeIdToken('apple', cred.identityToken);
  } catch (e) {
    if (isCancelled(e, 'ERR_REQUEST_CANCELED')) return;
    throw e;
  }
}
