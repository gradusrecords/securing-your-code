@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Не найден Node.js. Скачайте версию LTS на https://nodejs.org , установите и запустите этот файл снова.
  start https://nodejs.org
  pause
  exit /b 1
)
node scripts\install-ios.mjs %*
echo.
pause
