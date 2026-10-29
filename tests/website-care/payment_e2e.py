"""Website Care: payment to scan, holds, dispatch recovery, and the approved
billing policy (care terms 2026-10-29), end to end on the local stack.

  python3 tests/website-care/payment_e2e.py

Needs the app built and running with WEBSITE_CARE_ENABLED=true on the local
stack (see README.md). Fictional clients only; every service is a mock.
"""
import json, os, re, time
from datetime import datetime, timezone
import requests
from lib import *

reset_stack()
api('PUT', 'settings', {'timezone': 'America/New_York', 'notify_email': 'owner@studio.test'})
cl = lambda name, email: db('clients', '', 'POST', {'name': name, 'business': f'{name} (fictional)', 'email': email})[0]
ana, ben, cy, dee, eli = cl('Ana Ruiz', 'alante.v+ana@gmail.com'), cl('Ben Ito', 'alante.v+ben@gmail.com'), cl('Cy Moss', 'alante.v+cy@gmail.com'), cl('Dee Park', 'dee@notallowed.test'), cl('Eli Shaw', 'alante.v+eli@gmail.com')
CHECKLIST = [{'id': 'visual-desktop', 'label': 'Desktop appearance looks right', 'category': 'Appearance'}]
def site_for(c, label, plan='business', **kw):
    body = {'client_id': c['id'], 'label': label, 'plan': plan, 'approved_domains': ['good.fixture.test'], 'site_url': 'http://good.fixture.test:4500/',
            'recipient_name': c['name'], 'recipient_email': c['email'], 'pages': [{'url': 'http://good.fixture.test:4500/', 'label': 'Home'}], 'manual_checklist': CHECKLIST, **kw}
    r = api('POST', 'sites', body)
    assert r.status_code == 201, r.text
    return r.json()['site']
def owner_mail(sub): return [e for e in emails() if sub in e['subject']]
def run_of(cycle_id): return db('care_scan_runs', f'?cycle_id=eq.{cycle_id}&order=created_at')
def cycles_of(site_id): return db('care_cycles', f'?site_id=eq.{site_id}&order=period_start')
def due_now(run_id): db('care_scan_runs', f'?id=eq.{run_id}', 'PATCH', {'next_dispatch_at': '2020-01-01T00:00:00Z'})
def checkout_and_pay(site, **kw):
    r = api('POST', f"sites/{site['id']}/checkout", {})
    assert r.status_code == 200, r.text
    sess = list(stripe_state()['sessions'].keys())[-1]
    return sess, ctrl('complete', {'session_id': sess, **kw})

# ------------------------------------------------------------------ 1. checkout gating and the invitation
a = site_for(ana, 'Ruiz Studio')
r = api('POST', f"sites/{a['id']}/checkout", {})
check('gate: no checkout before setup confirmation', r.status_code == 409 and 'Confirm the website setup' in r.text, r.text[:160])
pv = api('POST', f"sites/{a['id']}/invite", {'preview': True}).json()
check('gate: invitation preview lists what is missing', any('Confirm the website setup' in p for p in pv['problems']), pv['problems'])
r = api('POST', f"sites/{a['id']}/invite", {'confirm_email': ana['email']})
check('gate: invitation cannot be sent before confirmation', r.status_code == 409 and not emails(), r.text[:160])
api('POST', f"sites/{a['id']}/confirm", CONFIRM)
api('PUT', f"sites/{a['id']}", {'pages': [{'url': 'http://good.fixture.test:4500/', 'label': 'Home'}, {'url': 'http://good.fixture.test:4500/contact', 'label': 'Contact'}]})
r = api('POST', f"sites/{a['id']}/checkout", {})
check('gate: a setup changed after confirmation blocks checkout until confirmed again', r.status_code == 409 and 'changed since it was confirmed' in r.text, r.text[:200])
api('POST', f"sites/{a['id']}/confirm", CONFIRM)
mode(tosMissing=True)
r = api('POST', f"sites/{a['id']}/checkout", {})
check('Stripe without a terms URL: clear instruction, nothing created', r.status_code == 503 and 'terms of service URL' in r.text, r.text[:200])
mode(tosMissing=False)
pv = api('POST', f"sites/{a['id']}/invite", {'preview': True}).json()
txt = re.sub(r'\s+', ' ', pv['text'].replace('’', "'"))
check('invitation: ready, allowed recipient, current terms version', pv['problems'] == [] and pv['allowed']['ok'] and pv['terms_version'] == '2026-10-29', pv['problems'])
for k in ['billed monthly in advance', 'Your monthly website check is automatically queued when payment is confirmed.', 'non-refundable once confirmed, except where required by law', 'before your next billing date', 'no prorated refund', 'duplicate or incorrect charge', 'To cancel, email me at alante@alantevelez.com', '/care/terms', 'version 2026-10-29']:
    check(f'invitation explains: {k[:50]}', k in txt, txt[:300])
check('invitation has no dashes and no instant completion promise', not re.search(r'[–—]', pv['html']) and 'instant' not in txt.lower().replace("isn't instant", ''), '')
r = api('POST', f"sites/{a['id']}/invite", {'confirm_email': 'wrong@x.test'})
check('invitation needs the typed recipient address', r.status_code == 422, r.status_code)
r = api('POST', f"sites/{a['id']}/invite", {'confirm_email': ana['email']})
sent = [e for e in emails() if ana['email'] in json.dumps(e['to'])]
check('invitation sent once with a secure Stripe link', r.status_code == 200 and len(sent) == 1 and 'https://checkout.stripe.test/pay/' in sent[0]['html'] and sent[0]['idempotency'], r.text[:200])
check('invitation sending recorded', db('care_sites', f"?id=eq.{a['id']}")[0]['invited_at'], '')
d = site_for(dee, 'Park Bakery')
api('POST', f"sites/{d['id']}/confirm", CONFIRM)
r = api('POST', f"sites/{d['id']}/invite", {'confirm_email': dee['email']})
check('invitation to a recipient outside the test allowlist is refused', r.status_code == 403 and not [e for e in emails() if 'dee@' in json.dumps(e['to'])], r.status_code)

# ------------------------------------------------------------------ 2. initial payment queues and dispatches the scan
sess, done = checkout_and_pay(a)
before = len(dispatches())
t0 = time.time()
codes = deliver_all(done['events'])
cyc = cycles_of(a['id'])
check('initial payment: exactly one cycle', codes == [200, 200, 200] and len(cyc) == 1, (codes, len(cyc)))
c1 = cyc[0]
check('initial payment: allowance created from the plan (Business, 30 minutes)', c1['allowance_minutes'] == 30 and c1['hold_reason'] is None and c1['paid_at'], c1)
runs = run_of(c1['id'])
check('initial payment: one initial scan queued now', len(runs) == 1 and runs[0]['trigger'] == 'scheduled' and runs[0]['status'] == 'queued' and ts(runs[0]['available_at']) <= datetime.now(timezone.utc), runs)
run1 = wait_for(lambda: (lambda x: x if x['dispatch_status'] == 'dispatched' else None)(run_of(c1['id'])[0]))
check('initial payment: runner dispatched immediately from the webhook', run1 and run1['dispatch_attempts'] == 1 and len(dispatches()) == before + 1 and time.time() - t0 < 15, (run1, len(dispatches()) - before))
acc = db('care_terms_acceptances', f"?site_id=eq.{a['id']}")
check('terms acceptance recorded from checkout (version and timestamp)', len(acc) == 1 and acc[0]['terms_version'] == '2026-10-29' and acc[0]['accepted_at'] and acc[0]['stripe_checkout_session_id'] == sess, acc)
cv = api('GET', f"cycles/{c1['id']}").json()
pipe = {s['key']: s for s in cv['pipeline']}
check('admin shows payment received and scan queued (runner started)', pipe['payment']['state'] == 'done' and pipe['queued']['state'] == 'active' and pipe['queued']['detail'] == 'runner started', cv['pipeline'])
items = api('GET', 'calendar').json()['items']
check('review is on the admin Schedule calendar as paid and queued', any(i['id'] == c1['id'] and i['status'] == 'Paid, check queued' for i in items), [i['status'] for i in items])
acts = [x['action'] for x in db('care_activity', f"?cycle_id=eq.{c1['id']}&order=created_at")]
check('activity: payment received, scan queued, scan dispatched in order', acts[:3] == ['payment_received', 'scan_queued', 'scan_dispatched'], acts)
# duplicate and out of order deliveries
codes = deliver_all(list(reversed(done['events'])) + done['events'])
check('duplicates: replays in any order add no cycle, run or dispatch', all(c == 200 for c in codes) and len(cycles_of(a['id'])) == 1 and len(run_of(c1['id'])) == 1 and len(dispatches()) == before + 1, codes)
out = runner()
r1 = run_of(c1['id'])[0]
check('scan completed by the runner', r1['status'] == 'succeeded' and r1['dispatch_status'] == 'dispatched', out[-400:])
cv = api('GET', f"cycles/{c1['id']}").json()
pipe = {s['key']: s for s in cv['pipeline']}
check('admin shows running then completed', pipe['running']['state'] == 'done' and pipe['result']['label'] == 'Completed' and pipe['result']['state'] == 'done', cv['pipeline'])
check('owner notified that results are ready', len(owner_mail('is ready for review')) == 1, [e['subject'] for e in emails()])
items = api('GET', 'calendar').json()['items']
check('calendar item updated to manual review due', any(i['id'] == c1['id'] and i['status'] == 'Manual review due' for i in items), '')
check('nothing sent to the client: report stays a draft until approved and sent by hand', db('care_reports', f"?cycle_id=eq.{c1['id']}")[0]['status'] == 'draft' and len([e for e in emails() if ana['email'] in json.dumps(e['to'])]) == 1, '')
# record the demo timeline from this real run
record = {'acts': db('care_activity', f"?cycle_id=eq.{c1['id']}&order=created_at"), 'pipeline': cv['pipeline'], 'run': r1, 'cycle': c1}

# out of order for a new client: invoice.paid arrives first
b = site_for(ben, 'Ito Repairs', plan='essential')
api('POST', f"sites/{b['id']}/confirm", CONFIRM)
sess_b, done_b = checkout_and_pay(b)
codes = deliver_all([done_b['events'][2], done_b['events'][1], done_b['events'][0]])
cb = cycles_of(b['id'])
check('out of order: payment first still links, creates one cycle and queues one scan', codes == [200, 200, 200] and len(cb) == 1 and len(run_of(cb[0]['id'])) == 1 and cb[0]['allowance_minutes'] == 0, (codes, len(cb)))
check('out of order: terms still recorded once', len(db('care_terms_acceptances', f"?site_id=eq.{b['id']}")) == 1, '')

# ------------------------------------------------------------------ 3. renewal
ren = ctrl('renew', {'sub_id': done['sub']})
before = len(dispatches())
deliver_all(ren['events'])
cyc = cycles_of(a['id'])
c2 = cyc[-1]
check('renewal: one new cycle with its own allowance', len(cyc) == 2 and c2['stripe_invoice_id'] == ren['invoice'] and c2['allowance_minutes'] == 30, len(cyc))
rr = wait_for(lambda: (lambda x: x if x and x[0]['dispatch_status'] == 'dispatched' else None)(run_of(c2['id'])))
check('renewal: scan queued and dispatched immediately', rr and rr[0]['status'] == 'queued' and len(dispatches()) == before + 1, rr)
deliver_all(ren['events'] + list(reversed(ren['events'])))
check('renewal replayed: nothing duplicated', len(cycles_of(a['id'])) == 2 and len(run_of(c2['id'])) == 1 and len(dispatches()) == before + 1, '')
check('owner email for every payment is not needed: no hold or dispatch notices', not owner_mail('on hold') and not owner_mail('couldn’t be started'), '')
dup = ctrl('duplicate_invoice', {'invoice_id': ren['invoice']})
deliver_all(dup['events'])
check('duplicate charge: no second review, owner told to check and correct it', len(cycles_of(a['id'])) == 2 and any('Possible duplicate charge' in e['html'] for e in owner_mail('billing')), [e['subject'] for e in emails()][-3:])
runner()

# ------------------------------------------------------------------ 4. dispatch failure, retry, recovery
mode(failDispatchTimes=2)
ren2 = ctrl('renew', {'sub_id': done['sub']})
deliver_all(ren2['events'])
c3 = cycles_of(a['id'])[-1]
r3 = wait_for(lambda: (lambda x: x if x and x[0]['dispatch_attempts'] >= 1 and x[0]['dispatch_status'] != 'pending' else None)(run_of(c3['id'])))[0]
check('dispatch failure: the paid review and its queued scan are kept', r3['status'] == 'queued' and r3['dispatch_status'] == 'failed' and r3['dispatch_error'] and c3['paid_at'], r3)
check('dispatch failure: retry is scheduled with backoff, not immediate', ts(r3['next_dispatch_at']) > datetime.now(timezone.utc), r3['next_dispatch_at'])
out = cron()
check('cron does not retry before the backoff is due', run_of(c3['id'])[0]['dispatch_attempts'] == 1, out.get('dispatch'))
due_now(r3['id']); cron()
check('cron retries a due dispatch (second attempt fails too)', run_of(c3['id'])[0]['dispatch_attempts'] == 2 and run_of(c3['id'])[0]['dispatch_status'] == 'failed', run_of(c3['id'])[0])
due_now(r3['id']); out = cron()
r3 = run_of(c3['id'])[0]
check('cron recovery: third attempt dispatches the scan', r3['dispatch_status'] == 'dispatched' and r3['dispatch_attempts'] == 3, (r3['dispatch_status'], out.get('dispatch')))
check('no blocked notice when a retry succeeds', not owner_mail('couldn’t be started'), '')
cv = api('GET', f"cycles/{c3['id']}").json()
check('admin pipeline shows the queued scan and runner start', {s['key']: s for s in cv['pipeline']}['queued']['detail'] == 'runner started', cv['pipeline'])
# dispatched but never picked up: dispatched again after the stale window
db('care_scan_runs', f"?id=eq.{r3['id']}", 'PATCH', {'dispatched_at': '2020-01-01T00:00:00Z'})
cron()
check('a dispatch nobody picked up is dispatched again', run_of(c3['id'])[0]['dispatch_attempts'] == 4, run_of(c3['id'])[0]['dispatch_attempts'])
runner()
check('the recovered scan completes', run_of(c3['id'])[0]['status'] == 'succeeded', '')
# blocked: every attempt fails
mode(failDispatch=True)
ren3 = ctrl('renew', {'sub_id': done['sub']})
deliver_all(ren3['events'])
c4 = cycles_of(a['id'])[-1]
r4 = wait_for(lambda: (lambda x: x if x and x[0]['dispatch_status'] == 'failed' else None)(run_of(c4['id'])))[0]
for _ in range(6):
    due_now(r4['id']); cron()
r4 = run_of(c4['id'])[0]
check('bounded retries: blocked after 5 attempts', r4['dispatch_status'] == 'blocked' and r4['dispatch_attempts'] == 5 and r4['status'] == 'queued', (r4['dispatch_status'], r4['dispatch_attempts']))
check('owner notified once that the check could not start', len(owner_mail('couldn’t be started')) == 1, [e['subject'] for e in emails()][-4:])
due_now(r4['id']); cron(); cron()
check('blocked dispatch stops retrying', run_of(c4['id'])[0]['dispatch_attempts'] == 5 and len(owner_mail('couldn’t be started')) == 1, '')
ov = api('GET', 'overview').json()
check('overview lists the blocked check for attention', any(x['id'] == r4['id'] for x in ov['blockedRuns']), ov.get('blockedRuns'))
mode(failDispatch=False)
r = api('POST', f"cycles/{c4['id']}/dispatch", {})
check('owner can retry a blocked start', r.status_code == 200 and r.json()['result'] == 'dispatched' and run_of(c4['id'])[0]['dispatch_status'] == 'dispatched', r.text[:200])
runner()
check('only one initial scan per paid period, ever', all(len([x for x in run_of(c['id']) if x['trigger'] == 'scheduled']) == 1 for c in cycles_of(a['id'])), '')

# ------------------------------------------------------------------ 5. setup holds
api('PUT', f"sites/{a['id']}", {'pages': [{'url': 'http://good.fixture.test:4500/', 'label': 'Home'}, {'url': 'http://good.fixture.test:4500/services', 'label': 'Services'}]})
check('editing the scope returns the site to draft', db('care_sites', f"?id=eq.{a['id']}")[0]['enrollment_status'] == 'draft', '')
ren4 = ctrl('renew', {'sub_id': done['sub']})
deliver_all(ren4['events'])
c5 = cycles_of(a['id'])[-1]
check('setup changed: renewal kept as a paid review, held, nothing scanned', c5['stripe_invoice_id'] == ren4['invoice'] and c5['hold_reason'] == 'setup_changed' and run_of(c5['id']) == [], c5['hold_reason'])
check('setup changed: owner flagged immediately', len(owner_mail('is on hold')) == 1 and 'changed' in owner_mail('is on hold')[0]['html'], [e['subject'] for e in emails()][-3:])
check('hold visible in admin (overview, pipeline, calendar)', any(x['id'] == c5['id'] for x in api('GET', 'overview').json()['heldCycles'])
      and api('GET', f"cycles/{c5['id']}").json()['pipeline'][1]['state'] == 'problem'
      and any(i['id'] == c5['id'] and i['status'] == 'Paid, on hold: confirm setup' for i in api('GET', 'calendar').json()['items']), '')
check('held review cannot be scanned by hand either', api('POST', f"cycles/{c5['id']}/rerun", {}).status_code == 409, '')
deliver_all(ren4['events'])
check('replayed renewal for a held site: still one cycle, one notice', len(cycles_of(a['id'])) == 5 and len(owner_mail('is on hold')) == 1, '')
r = api('POST', f"sites/{a['id']}/confirm", CONFIRM)
r5 = wait_for(lambda: (lambda x: x if x and x[0]['dispatch_status'] == 'dispatched' else None)(run_of(c5['id'])))
check('confirming the setup releases the held review and dispatches its scan', r.json()['released'] == 1 and r5 and cycles_of(a['id'])[-1]['hold_reason'] is None, r.text[:200])
runner()
api('POST', f"sites/{a['id']}/pause", {})
ren5 = ctrl('renew', {'sub_id': done['sub']})
deliver_all(ren5['events'])
c6 = cycles_of(a['id'])[-1]
check('paused: renewal held and flagged, not scanned', c6['hold_reason'] == 'paused' and run_of(c6['id']) == [] and len(owner_mail('is on hold')) == 2, c6['hold_reason'])
cron()
check('cron never scans a held review', run_of(c6['id']) == [], '')
api('POST', f"sites/{a['id']}/resume", {})
check('resuming queues the held review', wait_for(lambda: run_of(c6['id'])) and run_of(c6['id'])[0]['trigger'] == 'scheduled', '')
runner()

# ------------------------------------------------------------------ 6. failed and incomplete payments never scan
c = site_for(cy, 'Moss Plumbing', plan='premium')
api('POST', f"sites/{c['id']}/confirm", CONFIRM)
before = len(dispatches())
sess_c, fail = checkout_and_pay(c, fail=True)
deliver_all(fail['events'])
check('failed first payment: no cycle, no scan, no dispatch', cycles_of(c['id']) == [] and len(dispatches()) == before, '')
check('failed first payment: billing shows it unpaid (awaiting payment or attention)', db('care_sites', f"?id=eq.{c['id']}")[0]['billing_state'] in ('awaiting_payment', 'attention'), db('care_sites', f"?id=eq.{c['id']}")[0]['billing_state'])
fake = ctrl('emit', {'type': 'invoice.paid', 'id': fail['invoice']})
deliver_all(fake['events'])
check('an invoice.paid event for an unpaid invoice is ignored (Stripe re-fetch)', cycles_of(c['id']) == [] and db('care_stripe_events', f"?id=eq.{fake['events'][0]['id']}")[0]['status'] == 'ignored', '')
exp = ctrl('expire_incomplete', {'sub_id': fail['sub']})
deliver_all(exp['events'])
check('expired incomplete checkout: still no cycle', cycles_of(c['id']) == [] and db('care_sites', f"?id=eq.{c['id']}")[0]['billing_state'] == 'expired', '')
n_a = len(cycles_of(a['id']))
fr = ctrl('renew', {'sub_id': done['sub'], 'fail': True})
deliver_all(fr['events'])
check('failed renewal: no new cycle or scan', len(cycles_of(a['id'])) == n_a and len(db('care_scan_runs', f"?site_id=eq.{a['id']}&status=eq.queued")) == 0, len(cycles_of(a['id'])))

# ------------------------------------------------------------------ 7. cancellation at the end of the paid period
cx = ctrl('cancel', {'sub_id': done_b['sub'], 'at_period_end': True})
deliver_all(cx['events'])
sb = db('care_sites', f"?id=eq.{b['id']}")[0]
check('cancel at period end: canceling, paid period kept', sb['billing_state'] == 'canceling' and sb['cancel_at_period_end'] and sb['paid_through'], sb['billing_state'])
note = [e for e in owner_mail('billing') if 'canceled future renewals' in e['html']]
check('owner told the plan stays available until the period ends, no prorated refund', note and 'no prorated refund' in note[0]['html'], '')
open_b = cycles_of(b['id'])[0]
check('the paid review stays open and workable after cancelling', not open_b['completed_at'] and open_b['billing_flag'] is None, open_b)
end = ctrl('end_period', {'sub_id': done_b['sub']})
deliver_all(end['events'])
sb = db('care_sites', f"?id=eq.{b['id']}")[0]
check('period ends: canceled, not flagged as early, no new review', sb['billing_state'] == 'canceled' and cycles_of(b['id'])[0]['billing_flag'] is None and len(cycles_of(b['id'])) == 1, sb['billing_state'])
r = api('POST', f"sites/{a['id']}/portal", {})
cfg = [x for x in stripe_calls() if x['path'] == '/v1/billing_portal/configurations']
ps = [x for x in stripe_calls() if x['path'] == '/v1/billing_portal/sessions'][-1]['form']
check('billing portal cancels at period end with no proration', r.status_code == 200 and len(cfg) == 1 and cfg[0]['form']['features']['subscription_cancel'] == {'enabled': 'true', 'mode': 'at_period_end', 'proration_behavior': 'none', 'cancellation_reason': cfg[0]['form']['features']['subscription_cancel']['cancellation_reason']} and cfg[0]['form']['features']['subscription_update']['enabled'] == 'false' and ps.get('configuration'), cfg and cfg[0]['form'].get('features'))
api('POST', f"sites/{a['id']}/portal", {})
check('portal configuration created once and reused', len([x for x in stripe_calls() if x['path'] == '/v1/billing_portal/configurations']) == 1, '')
imm = ctrl('cancel', {'sub_id': done['sub'], 'at_period_end': False})
deliver_all(imm['events'])
flag = [e for e in owner_mail('billing') if 'ended before the end of the paid period' in e['html']]
check('early cancellation by Stripe: open reviews flagged for review, nothing refunded', flag and all(x['billing_flag'] == 'canceled_immediately' for x in cycles_of(a['id']) if not x['completed_at']), '')

# ------------------------------------------------------------------ 8. ended site, unlinked payments, refunds, terms for existing subscribers
e = site_for(eli, 'Shaw Studio')
api('POST', f"sites/{e['id']}/confirm", CONFIRM)
sess_e, done_e = checkout_and_pay(e, no_consent=True)
deliver_all(done_e['events'])
check('checkout without recorded terms consent: owner flagged, scan not blocked', any('Terms acceptance missing' in m['html'] for m in owner_mail('billing')) and len(cycles_of(e['id'])) == 1 and wait_for(lambda: run_of(cycles_of(e['id'])[0]['id'])), '')
site_e = api('GET', f"sites/{e['id']}").json()
check('existing subscriber without current terms is flagged, not moved silently', site_e['terms']['state'] == 'acceptance_needed' and e['id'] in api('GET', 'overview').json()['termsNeeded'], site_e['terms'])
r = api('POST', f"sites/{e['id']}/terms", {'confirm': True, 'evidence': 'short'})
check('recording acceptance needs evidence', r.status_code == 422, r.status_code)
r = api('POST', f"sites/{e['id']}/terms", {'confirm': True, 'evidence': 'Replied yes to the terms email (fictional)', 'accepted_on': '2026-10-28'})
site_e = api('GET', f"sites/{e['id']}").json()
check('owner recorded acceptance: version, date, evidence kept', r.status_code == 200 and site_e['terms']['state'] == 'current' and site_e['acceptances'][0]['source'] == 'recorded_by_owner', site_e['terms'])
fs = ctrl('foreign_sub', {'metadata': {'care_site_id': e['id'], 'client_id': eli['id']}, 'price': 'price_business'})
deliver_all(fs['events'])
check('second subscription for a linked site: no review, owner told the payment is not linked', len(cycles_of(e['id'])) == 1 and any('Payment not linked to a review' in m['html'] for m in owner_mail('billing')), '')
rf = ctrl('refund', {'invoice_id': done_e['invoice']})
deliver_all(rf['events'])
check('refund made in Stripe is flagged with the approved policy, never automated', any('non-refundable except where required by law' in m['html'] for m in owner_mail('billing')) and cycles_of(e['id'])[0]['billing_flag'] == 'refunded', '')
api('POST', f"sites/{e['id']}/end", {'confirm': True})
ren_e = ctrl('renew', {'sub_id': done_e['sub']})
deliver_all(ren_e['events'])
ce = cycles_of(e['id'])
check('payment after care ended: kept as a held review and flagged, never scanned', len(ce) == 2 and ce[-1]['hold_reason'] == 'ended' and run_of(ce[-1]['id']) == [] and any('Shaw' in m['subject'] for m in owner_mail('is on hold')), ce[-1]['hold_reason'])
cron()
check('ended hold is never released automatically', run_of(ce[-1]['id']) == [], '')
writes = {x['path'] for x in stripe_calls() if x['method'] == 'POST'}
check('no refunds, charges or cancellations were made through Stripe', writes <= {'/v1/customers', '/v1/checkout/sessions', '/v1/billing_portal/sessions', '/v1/billing_portal/configurations'}, writes)
check('no unreviewed report was sent to any client', not db('care_report_sends', '?select=id'), '')

# ------------------------------------------------------------------ 9. settings and public wording
st = api('GET', 'settings').json()
check('settings: refunds, cancellation and billing errors approved', st['refund_policy_approved_at'] and st['refund_handling'] == 'non_refundable_except_law' and st['cancellation_handling'] == 'end_of_paid_period_no_proration' and st['billing_error_handling'] == 'investigate_and_correct', st)
check('settings: grace period and disputes still unapproved', st['policy_approved_at'] is None and st['grace_days'] is None and st['dispute_handling'] == 'flag_for_review', '')
r = api('PUT', 'settings', {'refund_handling': 'full_refund'})
check('approved refund policy cannot be edited in settings', r.status_code == 409, r.status_code)
FAQ_A = 'Care plans are billed monthly in advance. Once payment is confirmed, your monthly website check is automatically queued and that period’s payment is non-refundable, except where required by law. You can cancel before your next billing date to stop future renewals. Your current plan remains available until the end of the period you’ve paid for, and unused time doesn’t roll over. If you notice a duplicate or incorrect charge, contact me so I can investigate and correct it.'
page = requests.get(f'{APP}/care').text.replace('&#x27;', "'").replace('&rsquo;', '’')
check('public FAQ question and answer published exactly', 'Can I cancel my care plan or get a refund?' in page and FAQ_A in page and 'id="questions"' in page, '')
check('care page links the terms and states the queued line', '/care/terms' in page and 'Your monthly website check is automatically queued when payment is confirmed.' in page, '')
terms = requests.get(f'{APP}/care/terms')
tt = re.sub(r'<[^>]+>', ' ', terms.text).replace('&#x27;', "'")
check('terms page published with version and every policy section', terms.status_code == 200 and '2026-10-29' in tt and all(k in tt for k in ['Billing and your monthly check', 'Refunds', 'Cancelling', 'Duplicate or incorrect charges', 'non-refundable after successful payment, except where required by law', 'doesn’t create a prorated refund']), terms.status_code)
body = re.search(r'<main[\s\S]*</main>', terms.text)
check('terms page has no dashes', body and not re.search(r'[–—]', body.group(0)), '')
demo = requests.get(f'{APP}/care/demo/payment-to-scan')
check('payment to scan demo available outside production, not indexed', demo.status_code == 200 and 'noindex' in demo.text and 'Scan queued' in demo.text and 'Runner started' in demo.text, demo.status_code)

record['scenarios'] = [{'name': n, 'ok': o} for n, o, _ in results]
json.dump(record, open(os.path.join(WORK, 'demo_record.json'), 'w'), indent=1, default=str)
finish('payment_e2e')
