#!/usr/bin/env bash
# Builds the ZAYA iPhone app in the Expo cloud and sends it to TestFlight.
# Run on YOUR computer (needs Node.js 20+ and your Expo + Apple Developer accounts).
#
#   export SUPABASE_URL=https://<project>.supabase.co
#   export SUPABASE_ANON_KEY=<anon public key>
#   bash scripts/release-ios.sh
set -euo pipefail

: "${SUPABASE_URL:?set SUPABASE_URL to your Supabase project URL}"
: "${SUPABASE_ANON_KEY:?set SUPABASE_ANON_KEY to the anon (public) key, never the service-role key}"

cd "$(dirname "$0")/../mobile"
EAS="npx --yes eas-cli@latest"

echo "== 1/6 Dependencies"
npm ci --legacy-peer-deps

echo "== 2/6 Expo login (use your Expo account)"
$EAS whoami >/dev/null 2>&1 || $EAS login

echo "== 3/6 Link the project to Expo (writes extra.eas.projectId into app.json)"
grep -q '"projectId"' app.json || $EAS init

echo "== 4/6 Build variables (public values only)"
for pair in "EXPO_PUBLIC_SUPABASE_URL=$SUPABASE_URL" "EXPO_PUBLIC_SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY"; do
  name="${pair%%=*}"; value="${pair#*=}"
  $EAS env:create --name "$name" --value "$value" --environment production --visibility plaintext --non-interactive --force || true
done

echo "== 5/6 Build for iPhone (EAS asks to sign in to Apple and creates certificates for you)"
$EAS build -p ios --profile production

echo "== 6/6 Send the build to TestFlight"
$EAS submit -p ios --latest

echo
echo "Done. Open App Store Connect -> TestFlight, add testers, and share the invitation link."
