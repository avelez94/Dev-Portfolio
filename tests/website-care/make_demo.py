"""Writes src/content/care-demo.ts from the timeline recorded by payment_e2e.py."""
import json, os, re
from datetime import datetime
from lib import WORK, REPO

r = json.load(open(os.path.join(WORK, 'demo_record.json')))
t = lambda v: datetime.fromisoformat(v.replace('Z', '+00:00'))
acts = {a['action']: a for a in r['acts']}
t0 = t(acts['payment_received']['created_at'])
off = lambda v: f'+{(t(v) - t0).total_seconds():.2f} s'
run, cyc = r['run'], r['cycle']
steps = [
    ('Payment confirmed by Stripe', acts['payment_received']['created_at'], 'A verified invoice.paid webhook (billing reason subscription_create). Stripe is re-read, not trusted from the event.'),
    ('Paid review created', acts['payment_received']['created_at'], f"One review for this paid period with its {cyc['allowance_minutes']} minute allowance, a draft report and the manual checklist. Added to the admin Schedule calendar."),
    ('Scan queued', run['created_at'], 'The period’s one initial scan, using the confirmed scope frozen at this moment.'),
    ('Runner started', run['dispatched_at'], 'GitHub workflow dispatch requested straight from the webhook, recorded on the run (attempt 1).'),
    ('Scan running', run['started_at'], 'The runner claimed the job with a lease. (Here the test started the runner itself; on GitHub Actions it takes longer to start.)'),
    ('Results ready', run['finished_at'], 'Findings saved, the owner emailed that results are ready, and the calendar item moved to Manual review due.'),
    ('Report waits for review', run['finished_at'], 'Nothing is sent to the client. The report is approved and sent by hand after the manual review.'),
]
ok = [s for s in r['scenarios'] if s['ok']]
src = open(os.path.join(REPO, 'src/content/care-demo.ts')).read()
recorded = t0.strftime('%b %-d, %Y')
src = re.sub(r"recordedAt: '[^']*'", f"recordedAt: '{recorded}'", src)
src = re.sub(r'checksPassed: \d+', f'checksPassed: {len(ok)}', src)
src = re.sub(r'checksTotal: \d+', f'checksTotal: {len(r["scenarios"])}', src)
body = ',\n'.join(f"    {{ label: {json.dumps(l)}, at: '{off(a)}', detail: {json.dumps(d, ensure_ascii=False)} }}" for l, a, d in steps)
src = re.sub(r'steps: \[[^\]]*\] as DemoStep\[\]', 'steps: [\n' + body + ',\n  ] as DemoStep[]', src)
open(os.path.join(REPO, 'src/content/care-demo.ts'), 'w').write(src)
print(src[:1600])
