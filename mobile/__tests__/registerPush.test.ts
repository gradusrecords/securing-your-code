jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
  setNotificationHandler: jest.fn(),
}));
jest.mock('expo-device', () => ({ isDevice: true }));
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { extra: { eas: { projectId: 'p1' } } } } }));
jest.mock('../src/lib/supabase', () => {
  const eq = jest.fn();
  const update = jest.fn(() => ({ eq }));
  return { supabase: { auth: { getUser: jest.fn() }, from: jest.fn(() => ({ update })), __update: update, __eq: eq } };
});

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { supabase } from '../src/lib/supabase';
import { registerForPush } from '../src/notifications/registerPush';

const N = Notifications as unknown as Record<string, jest.Mock>;
const m = supabase as any;

beforeEach(() => {
  jest.clearAllMocks();
  (Device as any).isDevice = true;
  m.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
  N.getPermissionsAsync.mockResolvedValue({ status: 'granted' });
  N.getExpoPushTokenAsync.mockResolvedValue({ data: 'ExponentPushToken[abc]' });
  m.__eq.mockResolvedValue({ error: null });
});

test('on a real device with permission the token is saved for the current user and returned', async () => {
  await expect(registerForPush()).resolves.toBe('ExponentPushToken[abc]');
  expect(m.__update).toHaveBeenCalledWith({ push_token: 'ExponentPushToken[abc]' });
  expect(m.__eq).toHaveBeenCalledWith('id', 'u1');
});

test('permission is requested when it was not granted yet', async () => {
  N.getPermissionsAsync.mockResolvedValue({ status: 'undetermined' });
  N.requestPermissionsAsync.mockResolvedValue({ status: 'granted' });
  await expect(registerForPush()).resolves.toBe('ExponentPushToken[abc]');
  expect(N.requestPermissionsAsync).toHaveBeenCalled();
});

test('a refusal returns null and saves nothing', async () => {
  N.getPermissionsAsync.mockResolvedValue({ status: 'undetermined' });
  N.requestPermissionsAsync.mockResolvedValue({ status: 'denied' });
  await expect(registerForPush()).resolves.toBeNull();
  expect(m.__update).not.toHaveBeenCalled();
});

test('a simulator returns null', async () => {
  (Device as any).isDevice = false;
  await expect(registerForPush()).resolves.toBeNull();
  expect(N.getExpoPushTokenAsync).not.toHaveBeenCalled();
});

test('an error while getting the token returns null without throwing', async () => {
  N.getExpoPushTokenAsync.mockRejectedValue(new Error('no network'));
  await expect(registerForPush()).resolves.toBeNull();
});

test('a failed database write returns null without throwing', async () => {
  m.__eq.mockResolvedValue({ error: { message: 'denied' } });
  await expect(registerForPush()).resolves.toBeNull();
});
