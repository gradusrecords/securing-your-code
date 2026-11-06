#!/usr/bin/env bash
# Thin wrapper kept for compatibility: the installer itself is scripts/install-ios.mjs.
#   export SUPABASE_URL=https://<project>.supabase.co
#   export SUPABASE_ANON_KEY=<anon public key>
#   bash scripts/release-ios.sh
exec node "$(dirname "$0")/install-ios.mjs" "$@"
