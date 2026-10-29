#!/bin/bash
# Paths and ports for the local Website Care test stack. Override any of these
# in your environment. Nothing here talks to a real service.
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export CARE_TEST_ROOT="$(cd "$HERE/.." && pwd)"
export CARE_REPO="$(cd "$CARE_TEST_ROOT/../.." && pwd)"
export CARE_TEST_WORK="${CARE_TEST_WORK:-${TMPDIR:-/tmp}/website-care-tests}"
export PG_BIN="${PG_BIN:-/usr/lib/postgresql/16/bin}"
export PG_DIR="${PG_DIR:-/var/tmp/pgtest}"
export PG_PORT="${PG_PORT:-55432}"
export POSTGREST_BIN="${POSTGREST_BIN:-$(command -v postgrest || echo postgrest)}"
export POSTGREST_PORT="${POSTGREST_PORT:-55434}"
export CARE_TEST_DB="${CARE_TEST_DB:-care_test}"
export CARE_JWT_SECRET="local-test-jwt-secret-at-least-32-characters-long"
export CARE_APP_PORT="${CARE_APP_PORT:-3123}"
mkdir -p "$CARE_TEST_WORK"
# Run Postgres tools as the postgres user when we are root.
pgrun() { if [ "$(id -u)" = 0 ]; then su postgres -c "$*"; else bash -c "$*"; fi; }
