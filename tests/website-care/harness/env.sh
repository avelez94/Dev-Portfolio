#!/bin/bash
# App environment for the local stack. Test keys only; every external service is a mock.
source "$(dirname "${BASH_SOURCE[0]}")/config.sh"
jwt() { node -e "const c=require('crypto');const b=(o)=>Buffer.from(JSON.stringify(o)).toString('base64url');const h=b({alg:'HS256',typ:'JWT'}),p=b({role:process.argv[1],iss:'care-test',exp:4102444800});console.log(h+'.'+p+'.'+c.createHmac('sha256',process.argv[2]).update(h+'.'+p).digest('base64url'))" "$1" "$CARE_JWT_SECRET"; }
export ANON_JWT=$(jwt anon) SERVICE_JWT=$(jwt service_role)
export NEXT_TELEMETRY_DISABLED=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:4040 NEXT_PUBLIC_SUPABASE_ANON_KEY=$ANON_JWT SUPABASE_SERVICE_ROLE_KEY=$SERVICE_JWT
export RESEND_API_KEY=re_mock RESEND_BASE_URL=http://127.0.0.1:4040 ADMIN_SECRET_TOKEN=test-admin-token ADMIN_PASSWORD=test-password CRON_SECRET=test-cron
export CARE_RUNNER_TOKEN=test-runner-token STRIPE_SECRET_KEY=sk_test_fake STRIPE_API_BASE=http://127.0.0.1:4040 STRIPE_WEBHOOK_SECRET=whsec_test_secret
export STRIPE_PRICE_CARE_ESSENTIAL=price_essential STRIPE_PRICE_CARE_BUSINESS=price_business STRIPE_PRICE_CARE_PREMIUM=price_premium
export CARE_GITHUB_DISPATCH_TOKEN=gh_fake CARE_GITHUB_REPO=avelez94/dev-portfolio CARE_GITHUB_API_BASE=http://127.0.0.1:4040
export CARE_EMAIL_ALLOWLIST='alante.v+*@gmail.com' CARE_APP_URL=http://localhost:$CARE_APP_PORT CARE_NOTIFY_EMAIL=owner@studio.test
export CARE_TEST_HOSTS='{"good.fixture.test":"127.0.0.1","broken.fixture.test":"127.0.0.1","bot.fixture.test":"127.0.0.1","slow.fixture.test":"127.0.0.1","book.fixture.test":"127.0.0.1","tls.fixture.test":"127.0.0.1","elsewhere.fixture.test":"127.0.0.1"}'
unset NEXT_PUBLIC_SITE_URL VERCEL_ENV STRIPE_CARE_PORTAL_CONFIGURATION
export RESEND_WEBHOOK_SECRET=whsec_$(printf 'local-resend-test-secret-0123456789' | base64)
