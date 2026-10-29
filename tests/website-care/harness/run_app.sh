#!/bin/bash
# usage: run_app.sh build|on|off   (on = WEBSITE_CARE_ENABLED=true)
source "$(dirname "$0")/env.sh"
cd "$CARE_REPO"
if [ "$1" = build ]; then npx next build > "$CARE_TEST_WORK/build.log" 2>&1 || { tail -40 "$CARE_TEST_WORK/build.log"; exit 1; }; echo "built"; exit 0; fi
for p in $(ps -eo pid,args | awk '/next-server|next start/ && !/awk/ {print $1}'); do kill $p 2>/dev/null; done; sleep 1
if [ "$1" = on ]; then export WEBSITE_CARE_ENABLED=true; else unset WEBSITE_CARE_ENABLED; fi
(nohup npx next start -p $CARE_APP_PORT > "$CARE_TEST_WORK/server.log" 2>&1 &)
for i in $(seq 1 40); do curl -s -o /dev/null localhost:$CARE_APP_PORT/ && break; sleep 1; done
echo "app up (care $1)"
