#!/usr/bin/env node
// Kept for compatibility: the installer is scripts/install-app.mjs.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const app = fileURLToPath(new URL('./install-app.mjs', import.meta.url));
process.exit(spawnSync(process.execPath, [app, '--platform=ios', ...process.argv.slice(2)], { stdio: 'inherit' }).status ?? 1);
