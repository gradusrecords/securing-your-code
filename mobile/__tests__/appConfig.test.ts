import fs from 'fs';
import path from 'path';

const root = path.join(__dirname, '..');
const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8')).expo;
const easPath = path.join(root, 'eas.json');
const pluginName = (p: unknown) => (Array.isArray(p) ? p[0] : p);

test('identity and version', () => {
  expect(app.name).toBe('ZAYA');
  expect(app.version).toBe('1.0.0');
  expect(app.ios.bundleIdentifier).toBe('uz.zaya.app');
  expect(app.android.package).toBe('uz.zaya.app');
  expect(app.ios.buildNumber).toBe('1');
  expect(app.android.versionCode).toBe(1);
});

test('Sign in with Apple is enabled', () => {
  expect(app.ios.usesAppleSignIn).toBe(true);
});

test('all native plugins from stages 1-3 and 5 are present', () => {
  const names = (app.plugins as unknown[]).map(pluginName);
  for (const p of ['expo-router', 'expo-apple-authentication', '@react-native-google-signin/google-signin', 'expo-image-picker', 'expo-notifications']) {
    expect(names).toContain(p);
  }
});

test('the brand icons exist and the app is dark on black', () => {
  for (const f of [app.icon, app.android.adaptiveIcon.foregroundImage, app.android.adaptiveIcon.backgroundImage, app.android.adaptiveIcon.monochromeImage]) {
    expect(fs.existsSync(path.join(root, f))).toBe(true);
  }
  expect(app.android.adaptiveIcon.backgroundColor).toBe('#050505');
  expect(app.userInterfaceStyle).toBe('dark');
  const splash = (app.plugins as unknown[]).find((p) => pluginName(p) === 'expo-splash-screen') as [string, { backgroundColor: string; image: string }] | undefined;
  expect(splash?.[1].backgroundColor).toBe('#050505');
  expect(fs.existsSync(path.join(root, splash![1].image))).toBe(true);
});

test('the photo permission text is customised', () => {
  const picker = (app.plugins as unknown[]).find((p) => pluginName(p) === 'expo-image-picker') as [string, { photosPermission: string }] | undefined;
  expect(picker?.[1].photosPermission).toMatch(/ZAYA/);
});

test('unused Android permissions are blocked', () => {
  expect(app.android.blockedPermissions).toEqual(expect.arrayContaining(['android.permission.RECORD_AUDIO', 'android.permission.SYSTEM_ALERT_WINDOW']));
});

test('the app asks for no microphone or camera permission it does not use', () => {
  const picker = (app.plugins as unknown[]).find((p) => pluginName(p) === 'expo-image-picker') as [string, Record<string, unknown>];
  expect(picker[1].microphonePermission).toBe(false);
  expect(picker[1].cameraPermission).toBe(false);
});

describe('eas.json', () => {
  const eas = () => JSON.parse(fs.readFileSync(easPath, 'utf8'));
  test('has development, preview and production profiles', () => {
    const b = eas().build;
    expect(Object.keys(b)).toEqual(expect.arrayContaining(['development', 'preview', 'production']));
  });
  test('preview builds an installable Android apk for internal distribution', () => {
    const p = eas().build.preview;
    expect(p.distribution).toBe('internal');
    expect(p.android.buildType).toBe('apk');
  });
  test('production builds an Android app bundle', () => {
    expect(eas().build.production.android.buildType).toBe('app-bundle');
  });
  test('contains no secrets', () => {
    const raw = fs.readFileSync(easPath, 'utf8');
    expect(raw).not.toMatch(/sk_|secret|password|eyJ[A-Za-z0-9_-]{20,}|[A-Za-z0-9_-]{40,}/i);
  });
});
