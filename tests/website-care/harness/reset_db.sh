#!/bin/bash
# Fresh local database: Supabase like baseline, every applied release migration,
# then the pending Website Care migration (twice, to prove it is re-runnable).
set -e
source "$(dirname "$0")/config.sh"
if [ ! -d "$PG_DIR/data" ]; then
  mkdir -p "$PG_DIR"; [ "$(id -u)" = 0 ] && chown postgres "$PG_DIR"
  pgrun "$PG_BIN/initdb -D $PG_DIR/data -U postgres --auth=trust" > "$CARE_TEST_WORK/initdb.log"
fi
pgrun "$PG_BIN/pg_ctl -D $PG_DIR/data status" >/dev/null 2>&1 || pgrun "$PG_BIN/pg_ctl -D $PG_DIR/data -o '-p $PG_PORT -k $PG_DIR' -l $PG_DIR/pg.log start" >/dev/null
sleep 1
PSQL="$PG_BIN/psql -h $PG_DIR -p $PG_PORT -U postgres -v ON_ERROR_STOP=1 -q"
pgrun "$PSQL -d postgres -c 'drop database if exists $CARE_TEST_DB with (force)' -c 'create database $CARE_TEST_DB'"
pgrun "$PSQL -d $CARE_TEST_DB" < "$CARE_TEST_ROOT/harness/baseline.sql" >/dev/null
for f in $(ls "$CARE_REPO"/supabase/migrations/*.sql | sort); do pgrun "$PSQL -d $CARE_TEST_DB" < "$f" >/dev/null 2>&1 || { echo "FAILED $f"; exit 1; }; done
for i in 1 2; do pgrun "$PSQL -d $CARE_TEST_DB" < "$CARE_REPO/supabase/pending/website-care/20261030_website_care.sql" 2>&1 | grep -v NOTICE || true; done
echo "db ready"
