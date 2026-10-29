# Website Care tests

End to end tests for Website Care on a fully local stack. Nothing here reaches a
real service: Postgres and PostgREST run locally, and Stripe, Resend, GitHub
and Supabase storage are mocks (`harness/care-mocks.mjs`). Fixture websites run
on 127.0.0.1 (`harness/fixtures.mjs`). Clients are fictional.

| Suite | Covers |
| --- | --- |
| `payment_e2e.py` | Checkout gating and the invitation, initial payment, renewal, duplicate and out of order webhooks, scan dispatch failure, retry, recovery and blocking, setup holds (changed, paused, ended), failed and incomplete payments never scanning, cancellation at period end and the portal configuration, duplicate charges, unlinked payments, refunds, terms acceptance (checkout and recorded), approved policy settings, the public FAQ, terms and demo pages. |
| `care_e2e.py` | The whole system: enrollment validation, webhooks, runner, findings, reports, approval, PDFs, sending, delivery events, jobs, safety, reminders, the admin calendar and public samples. |

## Requirements

Postgres 16 (`PG_BIN`, default `/usr/lib/postgresql/16/bin`), the PostgREST
binary (`POSTGREST_BIN`), Node 22, Python 3 with `requests`, Chromium for the
check runner (`care-runner`), `openssl`, and `pdftotext`/`pdfinfo` (poppler).
Ports used: 55432 (Postgres), 55434 (PostgREST), 4040 (mocks), 4500 and 4443
(fixtures), 3123 (app). Override paths in `harness/config.sh`.

## Run

```bash
export POSTGREST_BIN=/path/to/postgrest
bash tests/website-care/harness/reset_db.sh        # fresh database + migrations
bash tests/website-care/harness/start_services.sh  # PostgREST, mocks, fixtures
bash tests/website-care/harness/run_app.sh build   # production build
bash tests/website-care/harness/run_app.sh on      # start with WEBSITE_CARE_ENABLED=true
cd tests/website-care
python3 payment_e2e.py
python3 care_e2e.py
python3 make_demo.py   # optional: refresh the preview demo timeline from the last payment run
```

Each suite resets the database and mocks itself, exits non zero on any
failure, and writes its results to `$CARE_TEST_WORK` (default
`$TMPDIR/website-care-tests`).
