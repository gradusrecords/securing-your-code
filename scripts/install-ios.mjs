#!/usr/bin/env node
// ZAYA iOS installer: builds the iPhone app in the Expo cloud and sends it to TestFlight.
// Works on Windows, macOS and Linux. Usage: node scripts/install-ios.mjs [--dry-run]
//   --dry-run  prints every command instead of running it (no accounts needed)
// SUPABASE_URL and SUPABASE_ANON_KEY may be set in the environment; otherwise they are asked for.
import { spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkAnonKey, nodeVersionOk, normalizeSupabaseUrl } from './install-ios.lib.mjs';

const DRY = process.argv.includes('--dry-run');
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const mobile = join(root, 'mobile');
const rl = createInterface({ input: process.stdin, output: process.stdout });
const lines = [];
let closed = false;
rl.on('line', (l) => lines.push(l));
rl.on('close', () => { closed = true; });

const waiters = [];
rl.on('line', () => { const w = waiters.shift(); if (w) w(); });
const ask = (q) => new Promise((resolve) => {
  process.stdout.write(q);
  const take = () => resolve((lines.shift() ?? '').trim());
  if (lines.length > 0) take();
  else if (closed) resolve('');
  else { waiters.push(take); rl.once('close', () => { const w = waiters.indexOf(take); if (w >= 0) { waiters.splice(w, 1); resolve(''); } }); }
});

const say = (s = '') => console.log(s);
const step = (n, s) => say(`\n=== Шаг ${n} из 7: ${s} ===`);
const fail = (msg) => { say(`\n✖ ${msg}`); rl.close(); process.exit(1); };

function run(cmd, args, opts = {}) {
  const shown = [cmd, ...args].join(' ');
  if (DRY) { say(`[dry-run] ${shown}`); return 0; }
  const r = spawnSync(cmd, args, { cwd: mobile, stdio: 'inherit', shell: process.platform === 'win32', ...opts });
  return r.status ?? 1;
}
const eas = (...args) => run('npx', ['--yes', 'eas-cli@latest', ...args]);
const ask_yes = async (q) => !/^(n|no|н|нет)/i.test(await ask(`${q} [Y/n] `));

async function value(name, envName, check) {
  const fromEnv = process.env[envName];
  if (fromEnv) { try { return check(fromEnv); } catch (e) { fail(`${envName}: ${e.message}`); } }
  for (let i = 0; i < 3; i++) {
    const answer = await ask(`${name}: `);
    try { return check(answer); } catch (e) { say(`✖ ${e.message}`); }
  }
  return fail('Слишком много неверных попыток. Запустите установщик снова.');
}

say('ZAYA — установка на iPhone');
say('Приложение соберётся в облаке Expo (Mac не нужен) и попадёт в TestFlight.');
if (DRY) say('(пробный режим: команды только показываются)');

step(1, 'проверка компьютера');
if (!nodeVersionOk(process.version)) fail(`Нужен Node.js 20 или новее, у вас ${process.version}. Скачайте LTS на https://nodejs.org и запустите установщик снова.`);
if (!existsSync(join(mobile, 'package.json'))) fail('Не найдена папка mobile/. Запускайте установщик из скачанного репозитория ZAYA.');
say(`Node.js ${process.version} — подходит.`);
say('Нужны: аккаунт Expo (expo.dev, бесплатно) и платный аккаунт Apple Developer.');
if (!(await ask_yes('Они у вас есть?'))) fail('Сначала создайте аккаунты (инструкция: ZAYA-README.pdf, раздел 4), затем запустите установщик снова.');

step(2, 'данные вашего проекта Supabase');
say('Они в панели Supabase: Project Settings → API.');
const url = await value('Project URL (https://<проект>.supabase.co)', 'SUPABASE_URL', normalizeSupabaseUrl);
say('Нужен ключ "anon public". Секретный ключ "service_role" вводить НЕЛЬЗЯ — установщик его не примет.');
const anon = await value('Ключ anon public', 'SUPABASE_ANON_KEY', checkAnonKey);

step(3, 'установка зависимостей приложения');
if (run('npm', ['ci', '--legacy-peer-deps']) !== 0) fail('Не удалось установить зависимости. Проверьте интернет и повторите.');

step(4, 'вход в Expo');
say('Если попросят — введите логин и пароль Expo.');
if (eas('whoami') !== 0 && eas('login') !== 0) fail('Не удалось войти в Expo.');

step(5, 'привязка проекта к Expo');
const appJson = readFileSync(join(mobile, 'app.json'), 'utf8');
if (/"projectId"/.test(appJson)) say('Проект уже привязан.');
else if (eas('init') !== 0) fail('Не удалось привязать проект к Expo.');

step(6, 'настройки сборки');
for (const [name, val] of [['EXPO_PUBLIC_SUPABASE_URL', url], ['EXPO_PUBLIC_SUPABASE_ANON_KEY', anon]]) {
  if (eas('env:create', '--name', name, '--value', val, '--environment', 'production', '--visibility', 'plaintext', '--non-interactive', '--force') !== 0) {
    fail(`Не удалось сохранить ${name} в Expo.`);
  }
}

step(7, 'сборка для iPhone и отправка в TestFlight');
say('Сборка идёт в облаке 10–30 минут. Expo попросит войти в аккаунт Apple и сам создаст сертификаты — соглашайтесь.');
if (!(await ask_yes('Начать сборку?'))) { say('Остановлено. Запустите установщик снова, когда будете готовы.'); rl.close(); process.exit(0); }
if (eas('build', '-p', 'ios', '--profile', 'production') !== 0) fail('Сборка не удалась. Скопируйте последние строки вывода выше и пришлите их разработчику.');
if (eas('submit', '-p', 'ios', '--latest') !== 0) fail('Сборка готова, но отправка в TestFlight не удалась. Повторите командой: cd mobile && npx eas-cli@latest submit -p ios --latest');

say('\n✔ Готово!');
say('Дальше: App Store Connect → TestFlight → добавьте тестировщиков и разошлите приглашение.');
say('Первая сборка для внешних тестировщиков проходит короткую проверку Apple (обычно 1–2 дня).');
rl.close();
