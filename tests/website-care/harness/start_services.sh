#!/bin/bash
# PostgREST (real Postgres), the mock services (Supabase storage, Resend,
# Stripe, GitHub) and the fixture websites.
source "$(dirname "$0")/config.sh"
cat > "$CARE_TEST_WORK/postgrest.conf" <<CONF
db-uri = "postgres://authenticator:authpass@127.0.0.1:$PG_PORT/$CARE_TEST_DB"
db-schemas = "public"
db-anon-role = "anon"
jwt-secret = "$CARE_JWT_SECRET"
server-port = $POSTGREST_PORT
server-host = "127.0.0.1"
db-pool = 20
CONF
if [ ! -f "$CARE_TEST_WORK/fx.crt" ]; then
  openssl req -x509 -newkey rsa:2048 -nodes -days 30 -subj "/CN=tls.fixture.test" -keyout "$CARE_TEST_WORK/fx.key" -out "$CARE_TEST_WORK/fx.crt" >/dev/null 2>&1
fi
pkill -f "postgrest $CARE_TEST_WORK/postgrest.conf" 2>/dev/null; command -v fuser >/dev/null && fuser -k -n tcp $POSTGREST_PORT 4040 4500 4443 >/dev/null 2>&1; pkill -f care-mocks.mjs 2>/dev/null; pkill -f fixtures.mjs 2>/dev/null; sleep 0.5
(nohup "$POSTGREST_BIN" "$CARE_TEST_WORK/postgrest.conf" > "$CARE_TEST_WORK/postgrest.log" 2>&1 &)
(POSTGREST_PORT=$POSTGREST_PORT nohup node "$CARE_TEST_ROOT/harness/care-mocks.mjs" > "$CARE_TEST_WORK/mocks.log" 2>&1 &)
(CARE_FX_CERT_DIR="$CARE_TEST_WORK" nohup node "$CARE_TEST_ROOT/harness/fixtures.mjs" > "$CARE_TEST_WORK/fixtures.log" 2>&1 &)
sleep 1.5
curl -s -o /dev/null -w "postgrest %{http_code}\n" localhost:$POSTGREST_PORT/
curl -s -o /dev/null -w "mocks %{http_code}\n" localhost:4040/__emails
curl -s -o /dev/null -w "fixtures %{http_code}\n" localhost:4500/__log
