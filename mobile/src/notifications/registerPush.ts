import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { supabase } from '../lib/supabase';

// Registers this device for push and stores the token on the user's profile.
// Never throws: a refusal or any failure just means no push on this device.
export async function registerForPush(): Promise<string | null> {
  try {
    if (!Device.isDevice) return null;

    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      ({ status } = await Notifications.requestPermissionsAsync());
    }
    if (status !== 'granted') return null;

    const projectId = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);

    const { data } = await supabase.auth.getUser();
    const id = data.user?.id;
    if (!id) return null;
    const { error } = await supabase.from('profiles').update({ push_token: token }).eq('id', id);
    if (error) return null;
    return token;
  } catch {
    return null;
  }
}
