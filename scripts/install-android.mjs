#!/usr/bin/env node
// Android installer: builds an installable .apk in the Expo cloud (no Apple account needed).
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const app = fileURLToPath(new URL('./install-app.mjs', import.meta.url));
process.exit(spawnSync(process.execPath, [app, '--platform=android', ...process.argv.slice(2)], { stdio: 'inherit' }).status ?? 1);
