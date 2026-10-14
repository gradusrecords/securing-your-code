#!/usr/bin/env bash
# macOS: double-click this file in Finder (first time: right-click -> Open).
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo "Не найден Node.js. Скачайте версию LTS на https://nodejs.org , установите и запустите этот файл снова."
  open https://nodejs.org 2>/dev/null
  read -r -p "Нажмите Enter, чтобы закрыть..." _
  exit 1
fi
node scripts/install-ios.mjs "$@"
echo
read -r -p "Нажмите Enter, чтобы закрыть..." _
