#!/usr/bin/env bash
# Linux / WSL / Git Bash: bash ZAYA-iOS-Install.sh
cd "$(dirname "$0")" || exit 1
command -v node >/dev/null 2>&1 || { echo "Не найден Node.js (нужна версия 20+): https://nodejs.org"; exit 1; }
exec node scripts/install-ios.mjs "$@"
