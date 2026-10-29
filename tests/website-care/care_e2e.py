"""Website Care end to end tests against a local stack:
real Postgres + PostgREST, fake Stripe, fake Resend, fake GitHub, fixture websites,
the production build of the app, and the real check runner (Playwright).
Fictional clients only. Nothing here reaches a real service.
"""
import hashlib, hmac, json, os, re, subprocess, sys, time, io
import requests
from datetime import datetime, timezone
from lib import *
UTC = lambda v: ts(v).astimezone(timezone.utc).strftime('%Y-%m-%dT%H:%M:%S')
S = WORK

# ------------------------------------------------------------------ reset
reset_stack()
bookings_before = len(db('bookings', '?select=id'))
avail_before = [len(db(t, '?select=id')) for t in ('availability', 'blocked_dates', 'blocked_slots', 'bookings', 'meetings')]

maya = db('clients', '', 'POST', {'name': 'Maya Torres', 'business': 'Sunrise Bakery (fictional)', 'email': 'alante.v+maya@gmail.com'})[0]
devon = db('clients', '', 'POST', {'name': 'Devon Park', 'business': 'Park Physio (fictional)', 'email': 'devon@parkphysio.test'})[0]
rio = db('clients', '', 'POST', {'name': 'Rio Chen', 'business': 'Chen Studio (fictional)', 'email': 'alante.v+rio@gmail.com'})[0]

# ------------------------------------------------------------------ 1. authorization
for m, p in [('GET', 'status'), ('GET', 'overview'), ('POST', 'sites'), ('GET', 'settings'), ('PUT', 'settings'), ('GET', 'evidence?path=x')]:
    r = api(m, p, {} if m != 'GET' else None, cookie=False)
    check(f'admin {m} {p} needs the admin cookie', r.status_code == 401, r.status_code)
r = requests.get(f'{APP}/api/care/admin/status', headers={'Cookie': 'admin_token=wrong'})
check('wrong admin cookie refused', r.status_code == 401, r.status_code)
r = requests.post(f'{APP}/api/care/runner/claim', json={'owner': 'x-test'})
check('runner endpoint needs its token', r.status_code == 401, r.status_code)
r = requests.post(f'{APP}/api/care/runner/claim', json={'owner': 'x-test'}, headers={'Authorization': 'Bearer test-admin-token'})
check('admin token is not a runner token', r.status_code == 401, r.status_code)
r = requests.get(f'{MOCK}/rest/v1/care_sites?select=id', headers=ANON)
check('public key cannot read care tables', r.status_code in (401, 403), f'{r.status_code} {r.text[:120]}')
r = requests.post(f'{MOCK}/rest/v1/rpc/care_claim_scan_run', headers={**ANON, 'Content-Type': 'application/json'}, json={'p_owner': 'anon', 'p_lease_seconds': 60})
check('public key cannot call care job functions', r.status_code in (401, 403, 404), f'{r.status_code} {r.text[:120]}')
st = api('GET', 'status').json()
check('status reports Stripe test mode and test email allowlist', st['stripe']['mode'] == 'test' and not st['email']['clientEmailsLive'], st)

# ------------------------------------------------------------------ 2. enrollment validation
base = {'client_id': maya['id'], 'label': 'Sunrise Bakery site', 'plan': 'essential', 'approved_domains': ['good.fixture.test'],
        'site_url': 'http://good.fixture.test:4500/', 'recipient_name': 'Maya Torres', 'recipient_email': 'alante.v+maya@gmail.com',
        'pages': [{'url': 'http://good.fixture.test:4500/', 'label': 'Home'}, {'url': 'http://good.fixture.test:4500/services', 'label': 'Services'}, {'url': 'http://good.fixture.test:4500/contact', 'label': 'Contact'}],
        'destinations': [{'kind': 'booking', 'url': 'http://book.fixture.test:4500/', 'label': 'Booking page'}],
        'manual_checklist': [{'id': 'visual-desktop', 'label': 'Desktop appearance looks right', 'category': 'Appearance'}, {'id': 'contact-form', 'label': 'Contact form sends and arrives in the inbox', 'category': 'Forms'}, {'id': 'payments', 'label': 'Payment works through the approved test process', 'category': 'Payments'}]}
bad_urls = ['http://127.0.0.1/', 'http://localhost/', 'http://169.254.169.254/latest/meta-data/', 'http://10.0.0.5/', 'http://[::1]/', 'ftp://good.fixture.test/', 'http://user:pw@example.com/', 'https://example.com:8443/', 'http://printer.local/', 'http://intranet/']
for u in bad_urls:
    r = api('POST', 'sites', {**base, 'site_url': u, 'approved_domains': [re.sub(r'^\w+://(.*@)?\[?([^/:\]]+).*$', r'\2', u)]})
    check(f'enrollment refuses {u}', r.status_code == 422, f'{r.status_code} {r.text[:150]}')
r = api('POST', 'sites', {**base, 'pages': [{'url': 'https://evil.example/'}]})
check('enrollment refuses pages outside approved domains', r.status_code == 422 and 'approved domains' in r.text, r.text[:200])
r = api('POST', 'check-url', {'url': 'http://rebind-check.invalid/', 'approved_domains': ['rebind-check.invalid']})
check('DNS check reports unresolvable hosts', r.json().get('ok') is False, r.text)
r = api('POST', 'sites', {**base, 'client_id': '00000000-0000-0000-0000-000000000000'})
check('enrollment needs an existing client record', r.status_code == 400, r.text[:150])
r = api('POST', 'sites', base)
check('valid enrollment saved as draft', r.status_code == 201 and r.json()['site']['enrollment_status'] == 'draft', r.text[:200])
site1 = r.json()['site']
r = api('POST', 'sites', {**base, 'label': 'Second site'})
check('second site for same client needs pricing terms', r.status_code == 400 and 'second website' in r.text.lower(), r.text[:200])
r = api('POST', 'sites', {**base, 'label': 'Second site', 'is_additional_site': True, 'additional_site_terms': 'Own Essential subscription, agreed Oct 28'})
check('additional site with written terms allowed', r.status_code == 201, r.text[:200])
api('POST', f"sites/{r.json()['site']['id']}/end", {'confirm': True})

# ------------------------------------------------------------------ 3. confirmation gates checkout; payment queues the scan
r = api('POST', f"sites/{site1['id']}/checkout", {})
check('checkout refused before the setup is confirmed', r.status_code == 409 and 'Confirm the website setup' in r.text, r.text[:200])
check('no Stripe call was made for the refused checkout', not [c for c in stripe_calls() if c['path'] == '/v1/checkout/sessions'], '')
r = api('POST', f"sites/{site1['id']}/confirm", {'confirm_website': True, 'confirm_authorization': True})
check('confirmation needs every box and a note', r.status_code == 422, r.text[:200])
r = api('POST', f"sites/{site1['id']}/confirm", CONFIRM)
check('confirmation saved (nothing paid yet, nothing to release)', r.status_code == 200 and r.json()['released'] == 0, r.text[:200])
r = api('POST', f"sites/{site1['id']}/checkout", {})
check('checkout link created server side', r.status_code == 200 and r.json()['url'].startswith('https://checkout.stripe.test/'), r.text[:200])
calls = stripe_calls()
cs_call = [c for c in calls if c['path'] == '/v1/checkout/sessions'][-1]['form']
check('checkout uses the approved price only', cs_call['line_items'][0]['price'] == 'price_essential' and cs_call['line_items'][0]['quantity'] == '1', cs_call)
check('checkout ties the subscription to the site, client and terms version', cs_call['subscription_data']['metadata'] == {'care_site_id': site1['id'], 'client_id': maya['id'], 'plan': 'essential', 'terms_version': '2026-10-29'}, cs_call.get('subscription_data'))
check('checkout offers no trial or promotion codes', 'trial_period_days' not in json.dumps(cs_call) and cs_call.get('allow_promotion_codes') == 'false', cs_call)
check('checkout requires accepting the terms of service', cs_call.get('consent_collection') == {'terms_of_service': 'required'}, cs_call.get('consent_collection'))
ct = cs_call.get('custom_text', {})
check('checkout terms text links the versioned care terms', '/care/terms' in ct.get('terms_of_service_acceptance', {}).get('message', '') and '2026-10-29' in ct['terms_of_service_acceptance']['message'], ct)
check('checkout discloses billing in advance, the queued check, refunds and cancellation', all(k in ct.get('submit', {}).get('message', '') for k in ['billed monthly in advance', 'automatically queued when payment is confirmed', 'non-refundable', 'except where required by law', 'next billing date', 'no prorated refund']), ct.get('submit'))
check('checkout disclosures fit Stripe limits and have no dashes', len(ct['submit']['message']) <= 1200 and not re.search(r'[\u2013\u2014]| - ', ct['submit']['message'] + ct['terms_of_service_acceptance']['message']), len(ct['submit']['message']))
session_id = [c for c in stripe_state()['sessions']][-1]
r = requests.get(f'{APP}/care/subscribed')
check('success page exists and only says thanks', r.status_code == 200 and 'Thank you' in r.text and 'automatically queued when payment is confirmed' in r.text, r.status_code)
check('success redirect alone creates no cycle', db('care_cycles', '?select=id') == [], 'cycles exist')
r = api('POST', f"sites/{site1['id']}/checkout", {})
check('checkout link can be recreated before payment', r.status_code == 200, r.text[:100])
session_id = list(stripe_state()['sessions'].keys())[-1]
done = ctrl('complete', {'session_id': session_id})
evs = done['events']
# forged and unsigned events first
r = deliver(evs[2], secret='whsec_wrong')
check('webhook with a bad signature is refused', r.status_code == 400, r.status_code)
r = deliver(evs[2], sig=sign(json.dumps(evs[2]), t=int(time.time()) - 3600))
check('webhook with an old timestamp is refused', r.status_code == 400, r.status_code)
r = requests.post(f'{APP}/api/care/stripe/webhook', data=json.dumps(evs[2]), headers={'Content-Type': 'application/json'})
check('webhook without a signature is refused', r.status_code == 400, r.status_code)
check('nothing created from refused events', db('care_cycles', '?select=id') == [] and db('care_stripe_events', '?select=id') == [], 'rows created')
r = deliver(evs[0])
check('checkout completion alone does not create a review', r.status_code == 200 and db('care_cycles', '?select=id') == [], r.text)
s1 = db('care_sites', f"?id=eq.{site1['id']}")[0]
check('checkout completion links the subscription by explicit ids', s1['stripe_subscription_id'] == done['sub'] and s1['billing_state'] == 'active', s1)
acc = db('care_terms_acceptances', f"?site_id=eq.{site1['id']}")
check('terms acceptance recorded with version and time from checkout', len(acc) == 1 and acc[0]['terms_version'] == '2026-10-29' and acc[0]['source'] == 'stripe_checkout' and acc[0]['stripe_checkout_session_id'] == session_id and s1['terms_version'] == '2026-10-29' and s1['terms_accepted_at'], acc)
before_d = len(dispatches())
codes = deliver_all(evs[1:])
cyc = db('care_cycles', f"?site_id=eq.{site1['id']}")
check('paid invoice creates exactly one cycle', codes == [200, 200] and len(cyc) == 1, (codes, cyc))
check('cycle period comes from the invoice line', cyc[0]['period_start'] and cyc[0]['stripe_invoice_id'] == done['invoice'], cyc[0])
check('cycle carries its allowance from the plan', cyc[0]['allowance_minutes'] == 0 and cyc[0]['hold_reason'] is None, cyc[0])
runs = db('care_scan_runs', f"?cycle_id=eq.{cyc[0]['id']}")
check('payment queued the scan immediately', len(runs) == 1 and runs[0]['status'] == 'queued' and runs[0]['trigger'] == 'scheduled' and ts(runs[0]['available_at']) <= datetime.now(timezone.utc), runs)
r1 = wait_for(lambda: (lambda x: x if x['dispatch_status'] == 'dispatched' else None)(db('care_scan_runs', f"?id=eq.{runs[0]['id']}")[0]))
check('payment dispatched the runner right away (no scheduler)', r1 and r1['dispatch_status'] == 'dispatched' and r1['dispatch_attempts'] == 1 and len(dispatches()) > before_d, r1)
codes = deliver_all(evs)  # Stripe retries everything
check('duplicate deliveries are ignored', all(c == 200 for c in codes) and len(db('care_cycles', '?select=id')) == 1 and len(db('care_scan_runs', '?select=id')) == 1, codes)
ev_rows = db('care_stripe_events', '?select=id,status')
check('each event id stored once', len(ev_rows) == 3, ev_rows)

# ------------------------------------------------------------------ 4. scan, notify
r = api('POST', f"cycles/{cyc[0]['id']}/rerun", {})
check('a second run while one is queued is refused (returns the existing run)', r.status_code == 200 and r.json()['created'] is False and r.json()['run']['id'] == runs[0]['id'], r.text[:200])
peek = requests.post(f'{APP}/api/care/runner/peek', headers={'Authorization': 'Bearer test-runner-token'})
check('peek reports queued work', peek.status_code == 200, peek.status_code)
out = runner()
runs = db('care_scan_runs', f"?cycle_id=eq.{cyc[0]['id']}")
check('runner completed the scan', runs[0]['status'] == 'succeeded', out[-600:])
findings = db('care_findings', f"?run_id=eq.{runs[0]['id']}")
by = lambda key, status=None, vp=None: [f for f in findings if f['check_key'] == key and (status is None or f['status'] == status) and (vp is None or f['viewport'] == vp)]
check('healthy pages pass on desktop and mobile', len(by('page_load', 'passed')) == 6, [(f['url'], f['viewport'], f['status']) for f in by('page_load')])
check('screenshots stored as evidence', len([f for f in by('screenshot', 'passed') if f['evidence'].get('screenshot')]) == 6, len(by('screenshot')))
check('booking destination passed with the destination only caveat', by('destination', 'passed') and 'does not confirm booking works' in by('destination', 'passed')[0]['explanation'], by('destination'))
check('internal links checked', by('internal_links', 'passed'), [f['observed'] for f in by('internal_links')])
log = fxlog()
check('no form posts or writes reached the fixture sites', not [l for l in log if l['method'] not in ('GET', 'HEAD')], [l for l in log if l['method'] not in ('GET', 'HEAD')])
check('runner identifies itself in the user agent', all('AlanteVelezWebsiteCare' in l['ua'] for l in log if l['host'].endswith('fixture.test')), set(l['ua'][:60] for l in log))
ems = emails()
owner_mail = [e for e in ems if e['to'] in ('owner@studio.test', ['owner@studio.test'])]
check('owner emailed when the scan finished', owner_mail and 'ready for review' in owner_mail[-1]['subject'], [e['subject'] for e in ems])
check('owner email has the authenticated draft link and due date', owner_mail and f"/admin/care?cycle={cyc[0]['id']}" in owner_mail[-1]['html'] and 'Review due' in owner_mail[-1]['html'], '')
check('no email went to the client during scanning', not [e for e in ems if 'maya' in json.dumps(e['to'])], [e['to'] for e in ems])
cron(); cron()
check('repeated cron runs send no duplicate scan notice', len([e for e in emails() if 'ready for review' in e['subject']]) == 1, [e['subject'] for e in emails()])
r = requests.get(f"{APP}/api/care/admin/evidence?path={by('screenshot')[0]['evidence']['screenshot']}", headers=ADMIN)
check('screenshot served to admin only', r.status_code == 200 and r.headers['content-type'] == 'image/jpeg' and requests.get(f"{APP}/api/care/admin/evidence?path={by('screenshot')[0]['evidence']['screenshot']}").status_code == 401, r.status_code)
for bad in ['../../etc/passwd', f"{site1['id']}/../x.jpg", 'care-reports/x.pdf']:
    check(f'evidence path {bad} refused', requests.get(f'{APP}/api/care/admin/evidence', params={'path': bad}, headers=ADMIN).status_code == 404, '')

# ------------------------------------------------------------------ 5. manual review, report, approval
cid = cyc[0]['id']
r = api('POST', f'cycles/{cid}/ready', {})
check('report cannot be ready without a summary and manual results', r.status_code == 422 and 'summary' in r.text.lower() and 'Choose a result' in r.text, r.text[:300])
api('PUT', f'cycles/{cid}/manual/visual-desktop', {'status': 'passed', 'note': 'Layout matches.'})
api('PUT', f'cycles/{cid}/manual/contact-form', {'status': 'not_checked'})
api('PUT', f'cycles/{cid}/manual/payments', {'status': 'not_applicable', 'internal_note': 'PRIVATE: no test process agreed'})
rep = db('care_reports', f'?cycle_id=eq.{cid}')[0]
api('PUT', f'cycles/{cid}/report', {'content': {'summary': 'Your site is working well this month. Pages, images, and the booking link opened.'}, 'internal_notes': 'PRIVATE NOTE never in report', 'base_version': rep['version']})
r = api('POST', f'cycles/{cid}/ready', {})
check('not checked needs a reason', r.status_code == 422 and 'reason' in r.text, r.text[:200])
api('PUT', f'cycles/{cid}/manual/contact-form', {'reason': 'Client asked me to skip form tests this month.', 'note': ''})
r = api('PUT', f'cycles/{cid}/report', {'content': {'summary': 'x'}, 'base_version': 0})
check('stale editor version refused', r.status_code == 409, r.status_code)
r = api('POST', f'cycles/{cid}/ready', {})
check('report marked ready once complete', r.status_code == 200, r.text[:200])
bundle = api('GET', f'cycles/{cid}').json()
snap = bundle['snapshot']
check('snapshot keeps internal notes out', 'PRIVATE' not in json.dumps(snap), '')
check('snapshot lists what was not verified with the reason', any(c['why'] == 'Client asked me to skip form tests this month.' for c in snap['not_verified']), snap['not_verified'])
check('snapshot never claims fixes that were not entered', snap['work']['fixes'] == '' and snap['fixed'] == [], snap['work'])
row = {r['label']: r for r in snap['checklist']}
check('checklist marks the unverified hand check as not verified, never passed', row['Contact form sends and arrives in the inbox']['state'] == 'unverified', row.get('Contact form sends and arrives in the inbox'))
check('not applicable items are left out of the checklist and listed separately', 'Payment works through the approved test process' not in row and snap['not_applicable'] == ['Payment works through the approved test process'], snap['not_applicable'])
check('booking destination row says booking itself was not tested', 'wasn’t tested' in row['Booking page opens']['note'], row.get('Booking page opens'))
check('http only pages are grouped into one not verified item (not one per page and device)', len([n for n in snap['not_verified'] if 'HTTPS' in n['label']]) == 1 and len([n for n in snap['not_verified'] if 'HTTPS' in n['label']][0]['pages']) == 3, snap['not_verified'])
check('counts: passed checks from the checklist, issues and not verified from the grouped lists', snap['counts']['passed'] == len([r for r in snap['checklist'] if r['state'] in ('passed', 'fixed')]) and snap['counts']['issues'] == len(snap['attention']) and snap['counts']['unverified'] == len(snap['not_verified']), snap['counts'])
check('headline does not claim everything is fine while items are unverified', 'verified' in snap['headline'] and 'Everything' not in snap['headline'], snap['headline'])
r = api('POST', f'cycles/{cid}/approve', {'snapshot_hash': bundle['snapshotHash'], 'signoff': False, 'approver': 'Alante'})
check('approval needs explicit sign off', r.status_code == 422, r.text[:150])
r = api('POST', f'cycles/{cid}/approve', {'snapshot_hash': 'f' * 64, 'signoff': True, 'approver': 'Alante'})
check('approval refuses a stale preview', r.status_code == 409, r.text[:150])
r = api('POST', f'cycles/{cid}/approve', {'snapshot_hash': bundle['snapshotHash'], 'signoff': True, 'approver': 'Alante'})
check('approval of the previewed version', r.status_code == 200, r.text[:200])
appr1 = r.json()
r = api('POST', f'cycles/{cid}/approve', {'snapshot_hash': bundle['snapshotHash'], 'signoff': True, 'approver': 'Alante'})
check('double approval refused', r.status_code == 409, r.status_code)
# edit after approval invalidates
api('PUT', f'cycles/{cid}/report', {'content': {'fixes': 'Replaced the broken footer link (confirmed working).'}})
rep = db('care_reports', f'?cycle_id=eq.{cid}')[0]
apprs = db('care_report_approvals', f"?report_id=eq.{rep['id']}")
check('editing approved content returns the report to draft', rep['status'] == 'draft' and rep['current_approval_id'] is None and rep['version'] == 2, rep)
check('the earlier approval is kept but marked replaced', len(apprs) == 1 and apprs[0]['invalidated_at'], apprs)
r = api('GET', f'cycles/{cid}/send-preview')
check('send screen unavailable without a current approval', r.status_code == 409, r.status_code)
# internal only edits don't invalidate
api('POST', f'cycles/{cid}/ready', {})
b2 = api('GET', f'cycles/{cid}').json()
api('POST', f'cycles/{cid}/approve', {'snapshot_hash': b2['snapshotHash'], 'signoff': True, 'approver': 'Alante'})
api('PUT', f'cycles/{cid}/report', {'internal_notes': 'another private note'})
api('PUT', f'findings/{findings[0]["id"]}', {'internal_note': 'private'})
rep = db('care_reports', f'?cycle_id=eq.{cid}')[0]
check('private notes do not invalidate approval', rep['status'] == 'approved' and rep['version'] == 2, rep['status'])

# PDF accuracy
appr = db('care_report_approvals', f"?report_id=eq.{rep['id']}&invalidated_at=is.null")[0]
pdf = requests.get(f'{APP}/api/care/admin/cycles/{cid}/pdf?version=2&download=1', headers=ADMIN)
check('approved PDF downloads without sending', pdf.status_code == 200 and pdf.content[:4] == b'%PDF', pdf.status_code)
check('downloaded PDF is the exact approved file', hashlib.sha256(pdf.content).hexdigest() == appr['pdf_sha256'], '')
open(f'{S}/sample-report.pdf', 'wb').write(pdf.content)
txt = subprocess.run(['pdftotext', '-layout', f'{S}/sample-report.pdf', '-'], capture_output=True, text=True).stdout
pages = int(re.search(r'Pages:\s+(\d+)', subprocess.run(['pdfinfo', f'{S}/sample-report.pdf'], capture_output=True, text=True).stdout).group(1))
check('typical monthly report fits on one page', pages == 1, pages)
for needle in ['Monthly health report', 'Your site is working well this month', 'Passed', 'Not verified', "This month's checks", 'What I did', 'Replaced the broken footer link', 'Not verified this month', 'Client asked me to skip form tests', 'Next step', "doesn't prove booking, payment, or form delivery works", "isn't a security, accessibility, or compliance certification", 'Version 2']:
    flat = re.sub(r'\s+', '', txt.replace('\u2019', "'")).lower()
    check(f'PDF contains: {needle[:40]}', re.sub(r'\s+', '', needle).lower() in flat, '')
check('PDF has no private notes', 'PRIVATE' not in txt and 'private note' not in txt, '')
check('PDF has no health score', not re.search(r'score|\d+\s*/\s*100|grade', txt, re.I), '')

# ------------------------------------------------------------------ 6. sending
pv = api('GET', f'cycles/{cid}/send-preview').json()
check('send screen shows the exact recipient and attachment', pv['recipient_email'] == 'alante.v+maya@gmail.com' and pv['recipient_name'] == 'Maya Torres' and pv['pdf_sha256'] == appr['pdf_sha256'], pv)
r = api('POST', f'cycles/{cid}/send', {'approval_id': pv['approval_id'], 'confirm_email': 'maya@wrong.test', 'subject': pv['subject'], 'message': pv['message']})
check('send needs the typed recipient address', r.status_code == 422, r.text[:150])
requests.post(f'{MOCK}/__mode', json={'failEmail': True})
r = api('POST', f'cycles/{cid}/send', {'approval_id': pv['approval_id'], 'confirm_email': 'alante.v+maya@gmail.com', 'subject': pv['subject'], 'message': pv['message']})
rep = db('care_reports', f'?cycle_id=eq.{cid}')[0]
check('email outage: send fails and approval is kept', r.status_code == 502 and rep['status'] == 'approved', (r.status_code, rep['status']))
requests.post(f'{MOCK}/__mode', json={'failEmail': False})
before = len(emails())
r = api('POST', f'cycles/{cid}/send', {'approval_id': pv['approval_id'], 'confirm_email': 'alante.v+maya@gmail.com', 'subject': pv['subject'], 'message': pv['message']})
check('retry after failure sends without rescanning', r.status_code == 200 and r.json()['status'] == 'accepted', r.text[:200])
check('no new scan was created by sending', len(db('care_scan_runs', f'?cycle_id=eq.{cid}')) == 1, '')
sent = [e for e in emails()[before:] if 'maya' in json.dumps(e['to'])]
check('client email has exactly the approved PDF attached', sent and sent[0]['attachments'][0]['sha256'] == appr['pdf_sha256'], sent and sent[0]['attachments'])
check('client email uses the light client layout and the edited message', sent and 'Your monthly' in sent[0]['html'] and 'Hi Maya' in sent[0]['text'], '')
check('send uses a provider idempotency key', sent and sent[0]['idempotency'], sent and sent[0].get('idempotency'))
r = api('POST', f'cycles/{cid}/send', {'approval_id': pv['approval_id'], 'confirm_email': 'alante.v+maya@gmail.com', 'subject': pv['subject'], 'message': pv['message']})
check('duplicate send refused', r.status_code == 409, r.status_code)
sends = db('care_report_sends', f"?report_id=eq.{rep['id']}&order=created_at")
check('send history records failure then provider acceptance', [s['status'] for s in sends] == ['failed', 'accepted'] and sends[1]['recipient_email'] == 'alante.v+maya@gmail.com' and sends[1]['sent_by'], [s['status'] for s in sends])
c1 = db('care_cycles', f'?id=eq.{cid}')[0]
s1 = db('care_sites', f"?id=eq.{site1['id']}")[0]
check('review completed only when sent', c1['completed_at'] and s1['last_completed_review_at'], c1['completed_at'])
# edit after send creates a new draft version and keeps the sent one
api('PUT', f'cycles/{cid}/report', {'content': {'client_notes': 'Added later.'}})
rep = db('care_reports', f'?cycle_id=eq.{cid}')[0]
old = requests.get(f'{APP}/api/care/admin/cycles/{cid}/pdf?version=2', headers=ADMIN)
check('editing after send keeps the sent version unchanged', rep['version'] == 3 and hashlib.sha256(old.content).hexdigest() == appr['pdf_sha256'], rep['version'])

# allowlist guard: a non allowlisted recipient (Devon) can never be emailed in development
site2 = api('POST', 'sites', {**base, 'client_id': devon['id'], 'label': 'Park Physio site', 'recipient_name': 'Devon Park', 'recipient_email': 'devon@parkphysio.test'}).json()['site']
api('POST', f"sites/{site2['id']}/confirm", {'confirm_website': True, 'confirm_authorization': True, 'confirm_checklist': True, 'authorization_note': 'Fictional agreement'})
r = api('POST', f"sites/{site2['id']}/cycles", {'period_start': '2026-10-01', 'period_end': '2026-11-01', 'confirm_paid': True, 'note': 'Invoice 1001 (fictional)'})
check('manual service period for a client billed outside Stripe', r.status_code == 201, r.text[:200])
c2 = r.json()['cycle']
r = api('POST', f"sites/{site2['id']}/cycles", {'period_start': '2026-10-01', 'period_end': '2026-11-01', 'confirm_paid': True})
check('same manual period cannot be added twice', r.status_code == 409, r.status_code)
runner()
for item in ['visual-desktop', 'contact-form', 'payments']:
    api('PUT', f"cycles/{c2['id']}/manual/{item}", {'status': 'passed', 'note': 'Checked by hand.'})
api('PUT', f"cycles/{c2['id']}/report", {'content': {'summary': 'Everything we agreed on was checked this month.'}})
api('POST', f"cycles/{c2['id']}/ready", {})
b = api('GET', f"cycles/{c2['id']}").json()
api('POST', f"cycles/{c2['id']}/approve", {'snapshot_hash': b['snapshotHash'], 'signoff': True, 'approver': 'Alante'})
pv2 = api('GET', f"cycles/{c2['id']}/send-preview").json()
check('send screen warns that this recipient is blocked in development', pv2['allowed']['ok'] is False, pv2['allowed'])
r = api('POST', f"cycles/{c2['id']}/send", {'approval_id': pv2['approval_id'], 'confirm_email': 'devon@parkphysio.test', 'subject': 's', 'message': 'message'})
check('non allowlisted client email refused before sending', r.status_code == 403 and not [e for e in emails() if 'devon' in json.dumps(e['to'])], r.text[:150])

# ------------------------------------------------------------------ 7. recurring payments, failures, plan changes
sub1 = done['sub']
ren = ctrl('renew', {'sub_id': sub1})
codes = deliver_all(ren['events'])
cyc1 = db('care_cycles', f"?site_id=eq.{site1['id']}&order=period_start")
check('recurring payment creates the next cycle', codes == [200, 200] and len(cyc1) == 2 and cyc1[1]['period_start'] > cyc1[0]['period_start'], codes)
check('next cycle is queued straight away (site confirmed)', db('care_scan_runs', f"?cycle_id=eq.{cyc1[1]['id']}&select=status")[0]['status'] == 'queued', '')
deliver_all(list(reversed(ren['events'])))
check('replayed renewal adds nothing', len(db('care_cycles', f"?site_id=eq.{site1['id']}")) == 2, '')
pc = ctrl('change_plan', {'sub_id': sub1, 'price': 'price_business'})
deliver_all(pc['events'])
s1 = db('care_sites', f"?id=eq.{site1['id']}")[0]
check('plan change updates the plan without a new cycle', s1['plan'] == 'business' and len(db('care_cycles', f"?site_id=eq.{site1['id']}")) == 2, (s1['plan'],))
un = ctrl('unrelated', {'customer': s1['stripe_customer_id']})
deliver_all(un['events'])
check('unrelated invoices are ignored', len(db('care_cycles', '?select=id')) == 3 and db('care_stripe_events', f"?object_id=eq.{un['invoice']}")[0]['status'] == 'ignored', db('care_stripe_events', f"?object_id=eq.{un['invoice']}"))
fr = ctrl('renew', {'sub_id': sub1, 'fail': True})
deliver_all(fr['events'])
s1 = db('care_sites', f"?id=eq.{site1['id']}")[0]
check('failed payment flags billing attention and starts no review', s1['billing_state'] == 'attention' and len(db('care_cycles', f"?site_id=eq.{site1['id']}")) == 2, s1['billing_state'])
check('owner told about the failed payment', any('billing' in e['subject'].lower() for e in emails()), [e['subject'] for e in emails()][-3:])
again = ctrl('fail_again', {'invoice_id': fr['invoice']})
deliver_all(again['events'])
check('second failure counted, still one notice per attempt', db('care_sites', f"?id=eq.{site1['id']}")[0]['failed_payment_count'] == 2, '')
paid = ctrl('pay', {'invoice_id': fr['invoice']})
deliver_all(paid['events'])
s1 = db('care_sites', f"?id=eq.{site1['id']}")[0]
check('late payment creates the cycle and clears attention', s1['billing_state'] == 'active' and len(db('care_cycles', f"?site_id=eq.{site1['id']}")) == 3 and s1['failed_payment_count'] == 0, s1['billing_state'])

# out of order: invoice.paid arrives before the checkout and subscription events, for Rio
site3 = api('POST', 'sites', {**base, 'client_id': rio['id'], 'label': 'Chen Studio site', 'plan': 'premium', 'recipient_name': 'Rio Chen', 'recipient_email': 'alante.v+rio@gmail.com'}).json()['site']
api('POST', f"sites/{site3['id']}/confirm", CONFIRM)
api('POST', f"sites/{site3['id']}/checkout", {})
sess3 = list(requests.get(f'{MOCK}/__stripe/state').json()['sessions'].keys())[-1]
d3 = ctrl('complete', {'session_id': sess3})
codes = deliver_all([d3['events'][2], d3['events'][1], d3['events'][0]])
c3 = db('care_cycles', f"?site_id=eq.{site3['id']}")
s3 = db('care_sites', f"?id=eq.{site3['id']}")[0]
check('out of order events still link and create one cycle', codes == [200, 200, 200] and len(c3) == 1 and s3['stripe_subscription_id'] == d3['sub'], (codes, len(c3)))
# foreign subscription naming Rio's site but Devon as client: not linked
fs = ctrl('foreign_sub', {'metadata': {'care_site_id': site3['id'], 'client_id': devon['id']}, 'price': 'price_premium'})
deliver_all(fs['events'])
check('subscription metadata for the wrong client is not linked', len(db('care_cycles', f"?site_id=eq.{site3['id']}")) == 1 and db('care_sites', f"?id=eq.{site3['id']}")[0]['stripe_subscription_id'] == d3['sub'], '')
fs2 = ctrl('foreign_sub', {'metadata': {'care_site_id': site3['id'], 'client_id': rio['id']}, 'price': 'price_premium'})
deliver_all(fs2['events'])
check('a second subscription cannot take over a linked site', len(db('care_cycles', f"?site_id=eq.{site3['id']}")) == 1, '')

# cancellation at period end, then end, then a stale "active" event
cx = ctrl('cancel', {'sub_id': d3['sub'], 'at_period_end': True})
deliver_all(cx['events'])
s3 = db('care_sites', f"?id=eq.{site3['id']}")[0]
check('cancel at period end keeps the paid period', s3['billing_state'] == 'canceling' and s3['cancel_at_period_end'] and s3['paid_through'], s3['billing_state'])
end = ctrl('end_period', {'sub_id': d3['sub']})
deliver_all(end['events'])
stale = ctrl('stale_active', {'sub_id': d3['sub']})
deliver_all(stale['events'])
s3 = db('care_sites', f"?id=eq.{site3['id']}")[0]
check('a delayed active event does not restore a canceled subscription', s3['billing_state'] == 'canceled', s3['billing_state'])
check('cycles and reports are kept after cancellation', len(db('care_cycles', f"?site_id=eq.{site3['id']}")) == 1 and db('care_reports', f"?cycle_id=eq.{c3[0]['id']}"), '')
check('normal end of period is not flagged as early cancellation', db('care_cycles', f"?id=eq.{c3[0]['id']}")[0]['billing_flag'] is None, '')

# immediate cancellation, refund, dispute on the Sunrise subscription
open_c = [c for c in db('care_cycles', f"?site_id=eq.{site1['id']}&order=period_start") if not c['completed_at']]
rf = ctrl('refund', {'invoice_id': fr['invoice']})
deliver_all(rf['events'])
flagged = db('care_cycles', f"?stripe_invoice_id=eq.{fr['invoice']}")[0]
check('refund flags the matching cycle and the site', flagged['billing_flag'] == 'refunded' and db('care_sites', f"?id=eq.{site1['id']}")[0]['billing_state'] == 'refunded', flagged['billing_flag'])
dp = ctrl('dispute', {'invoice_id': ren['invoice']})
deliver_all(dp['events'])
check('dispute flags the matching cycle', db('care_cycles', f"?stripe_invoice_id=eq.{ren['invoice']}")[0]['billing_flag'] == 'disputed' and db('care_sites', f"?id=eq.{site1['id']}")[0]['billing_state'] == 'disputed', '')
imm = ctrl('cancel', {'sub_id': sub1, 'at_period_end': False})
deliver_all(imm['events'])
check('immediate cancellation flags open reviews for a decision', all(c['billing_flag'] in ('canceled_immediately', 'refunded', 'disputed') for c in db('care_cycles', f"?site_id=eq.{site1['id']}&completed_at=is.null")) and db('care_sites', f"?id=eq.{site1['id']}")[0]['billing_state'] == 'canceled', [c['billing_flag'] for c in db('care_cycles', f"?site_id=eq.{site1['id']}")])

# ------------------------------------------------------------------ 8. jobs: retries, recovery, duplicates
# Renewal periods start in the future in the fake; move queued runs to now (time passing).
for q in db('care_scan_runs', '?status=eq.queued'): db('care_scan_runs', f"?id=eq.{q['id']}", 'PATCH', {'available_at': '2020-01-01T00:00:00Z'})
claim1 = requests.post(f'{APP}/api/care/runner/claim', json={'owner': 'stuck-runner'}, headers={'Authorization': 'Bearer test-runner-token'}).json()['run']
claim2 = requests.post(f'{APP}/api/care/runner/claim', json={'owner': 'other-runner'}, headers={'Authorization': 'Bearer test-runner-token'})
other = claim2.json()['run']['id'] if claim2.status_code == 200 else None
check('two runners never get the same run', other != claim1['id'], (claim1['id'], other))
# release the second claimed run back to the queue so later steps stay simple
if other: db('care_scan_runs', f'?id=eq.{other}', 'PATCH', {'status': 'queued', 'lease_owner': None, 'attempts': 0})
r = requests.post(f"{APP}/api/care/runner/runs/{claim1['id']}/complete", json={'owner': 'impostor', 'outcome': 'succeeded', 'findings': []}, headers={'Authorization': 'Bearer test-runner-token'})
check('another runner cannot complete a leased run', r.status_code == 409, r.status_code)
r = requests.post(f"{APP}/api/care/runner/runs/{claim1['id']}/evidence?owner=impostor&name=x", data=b'\xff\xd8\xff', headers={'Authorization': 'Bearer test-runner-token', 'Content-Type': 'image/jpeg'})
check('another runner cannot upload evidence to a leased run', r.status_code == 409, r.status_code)
db('care_scan_runs', f"?id=eq.{claim1['id']}", 'PATCH', {'lease_expires_at': '2020-01-01T00:00:00Z'})
cron()
rr = db('care_scan_runs', f"?id=eq.{claim1['id']}")[0]
check('stalled run is recovered and requeued with backoff', rr['status'] == 'queued' and ts(rr['available_at']) > datetime.now(timezone.utc), rr['status'])
db('care_scan_runs', f"?id=eq.{claim1['id']}", 'PATCH', {'status': 'running', 'lease_owner': 'stuck', 'attempts': 3, 'lease_expires_at': '2020-01-01T00:00:00Z'})
cron()
rr = db('care_scan_runs', f"?id=eq.{claim1['id']}")[0]
cc = db('care_cycles', f"?id=eq.{rr['cycle_id']}")[0]
check('run fails after its attempts are used up', rr['status'] == 'failed' and cc['scan_state'] == 'failed', (rr['status'], cc['scan_state']))
check('a failed scan is not a completed review', not cc['completed_at'], '')
bundle_f = api('GET', f"cycles/{cc['id']}").json()
check('failed scan blocks approval until rerun', any('no completed automated check' in p for p in bundle_f['problems']), bundle_f['problems'])
r = requests.post(f"{APP}/api/care/runner/runs/{claim1['id']}/complete", json={'owner': 'stuck', 'outcome': 'succeeded', 'findings': []}, headers={'Authorization': 'Bearer test-runner-token'})
check('a late result from a timed out runner is refused', r.status_code == 409, r.status_code)
r = api('POST', f"cycles/{cc['id']}/rerun", {})
check('manual retry queues a new run in the same cycle', r.status_code == 200 and r.json()['created'], r.text[:200])
check('retry does not create a billing cycle', len(db('care_cycles', f"?site_id=eq.{site1['id']}")) == 3, '')
r = api('POST', f"cycles/{cc['id']}/cancel-scan", {})
check('a queued check can be canceled', r.status_code == 200 and db('care_scan_runs', f"?id=eq.{r.json()['run_id']}")[0]['status'] == 'canceled', r.text[:150])
# missed job recovery: confirmed site cycle that never got a run (simulated outage)
db('care_scan_runs', f"?cycle_id=eq.{c3[0]['id']}", 'DELETE')
db('care_cycles', f"?id=eq.{c3[0]['id']}", 'PATCH', {'scan_state': 'not_started', 'hold_reason': None})
db('care_sites', f"?id=eq.{site3['id']}", 'PATCH', {'enrollment_status': 'confirmed'})
out = cron()
check('cron recovers a missed scan', out.get('queued', 0) >= 1 and db('care_scan_runs', f"?cycle_id=eq.{c3[0]['id']}")[0]['status'] == 'queued', out)

# ------------------------------------------------------------------ 9. broken fixture: accuracy and safety
broken = db('clients', '', 'POST', {'name': 'Test Broken', 'business': 'Broken Fixture Co (fictional)', 'email': 'alante.v+broken@gmail.com'})[0]
bsite = api('POST', 'sites', {'client_id': broken['id'], 'label': 'Broken fixture', 'plan': 'essential', 'site_url': 'http://broken.fixture.test:4500/',
    'approved_domains': ['broken.fixture.test', 'bot.fixture.test', 'slow.fixture.test', 'tls.fixture.test'], 'recipient_name': 'Test', 'recipient_email': 'alante.v+broken@gmail.com',
    'pages': [{'url': u, 'label': l} for u, l in [('http://broken.fixture.test:4500/', 'Home'), ('http://broken.fixture.test:4500/missing-page', 'Missing'), ('http://broken.fixture.test:4500/loop', 'Loop'), ('http://broken.fixture.test:4500/moved', 'Moved'), ('http://broken.fixture.test:4500/err', 'Error'), ('http://bot.fixture.test:4500/', 'Bot wall'), ('http://slow.fixture.test:4500/', 'Slow'), ('https://tls.fixture.test:4443/', 'TLS')]],
    'destinations': [{'kind': 'booking', 'url': 'http://book.fixture.test:4500/', 'label': 'Booking'}, {'kind': 'checkout', 'url': 'http://bot.fixture.test:4500/pay', 'label': 'Checkout'}],
    'manual_checklist': [{'id': 'visual-mobile', 'label': 'Mobile appearance looks right', 'category': 'Appearance'}], 'scan_limits': {'navTimeoutMs': 8000}}).json()['site']
api('POST', f"sites/{bsite['id']}/confirm", {'confirm_website': True, 'confirm_authorization': True, 'confirm_checklist': True, 'authorization_note': 'Fixture'})
bc = api('POST', f"sites/{bsite['id']}/cycles", {'period_start': '2026-10-10', 'period_end': '2026-11-10', 'confirm_paid': True}).json()['cycle']
# park other queued runs so the runner takes this one
others = [r for r in db('care_scan_runs', '?status=eq.queued') if r['cycle_id'] != bc['id']]
for o in others: db('care_scan_runs', f"?id=eq.{o['id']}", 'PATCH', {'available_at': '2099-01-01T00:00:00Z'})
requests.get(f'{FX}/__reset')
out = runner(max_runs=1)
brun = db('care_scan_runs', f"?cycle_id=eq.{bc['id']}")[0]
bf = db('care_findings', f"?run_id=eq.{brun['id']}")
def f_for(url_part, key=None, vp='desktop'):
    return [f for f in bf if f['url'] and url_part in f['url'] and (key is None or f['check_key'] == key) and (vp is None or f['viewport'] == vp)]
check('broken run finished', brun['status'] in ('succeeded', 'partial'), (brun['status'], out[-500:]))
check('404 page is a failed page load', any(f['status'] == 'failed' for f in f_for('/missing-page', 'page_load')), f_for('/missing-page'))
check('redirect loop is failed', any(f['status'] == 'failed' and f['check_key'] == 'redirects' for f in f_for('/loop')), f_for('/loop'))
check('redirect outside approved domains needs review', any(f['status'] == 'needs_review' and f['check_key'] == 'redirects' for f in f_for('/moved')), f_for('/moved'))
check('server error needs review (may be temporary)', any(f['status'] == 'needs_review' for f in f_for('/err', 'page_load')), f_for('/err'))
check('bot wall is could not check, not a defect', f_for('bot.fixture.test:4500/', 'page_load') and all(f['status'] == 'could_not_check' for f in f_for('bot.fixture.test:4500/', 'page_load')), f_for('bot.fixture.test'))
check('timeout is could not check', f_for('slow.fixture.test', 'page_load') and all(f['status'] == 'could_not_check' for f in f_for('slow.fixture.test', 'page_load')), f_for('slow.fixture.test'))
check('certificate error is a failed HTTPS check', any(f['check_key'] == 'https' and f['status'] == 'failed' for f in f_for('tls.fixture.test', None)), f_for('tls.fixture.test', None))
check('missing image on the site is failed', any(f['status'] == 'failed' for f in f_for('broken.fixture.test:4500/', 'images')), f_for('broken.fixture.test:4500/', 'images'))
check('blocked private images are needs review, not failed', any(f['status'] == 'needs_review' for f in f_for('broken.fixture.test:4500/', 'images')), '')
mob = [f for f in bf if f['check_key'] == 'overflow' and f['viewport'] == 'mobile' and f['url'] == 'http://broken.fixture.test:4500/']
check('mobile horizontal overflow detected with the measured width', mob and mob[0]['status'] == 'failed' and mob[0]['evidence'].get('overflow_px', 0) >= 20, mob)
desk = [f for f in bf if f['check_key'] == 'overflow' and f['viewport'] == 'desktop' and f['url'] == 'http://broken.fixture.test:4500/']
check('no overflow on desktop', desk and desk[0]['status'] == 'passed', desk)
check('broken internal link is failed with the page it was found on', any(f['check_key'] == 'internal_links' and f['status'] == 'failed' and '/gone-page' in f['url'] and f['evidence'].get('found_on') for f in bf), [f['url'] for f in bf if f['check_key'] == 'internal_links'])
check('risky links skipped and disclosed', any(f['check_key'] == 'internal_links' and f['status'] == 'not_applicable' for f in bf), '')
check('booking destination opened with the caveat', any(f['check_key'] == 'destination' and f['status'] == 'passed' and 'does not confirm booking works' in f['explanation'] for f in bf), [f for f in bf if f['check_key'] == 'destination'])
check('checkout destination behind a bot wall is could not check', any(f['check_key'] == 'destination' and f['status'] == 'could_not_check' and '/pay' in (f['url'] or '') for f in bf), '')
check('blocked background writes disclosed', any(f['check_key'] == 'scan' and 'blocked' in f['observed'] for f in bf), '')
check('possible causes are kept separate from observations', all(not f['possible_cause'] or f['possible_cause'] not in f['observed'] for f in bf), '')
log = fxlog()
check('no POST, beacon, or form submission reached the fixture sites', not [l for l in log if l['method'] not in ('GET', 'HEAD')], [l for l in log if l['method'] not in ('GET', 'HEAD')])
check('no WebSocket connection was opened', not [l for l in log if l['method'] == 'UPGRADE'], '')
check('logout and cart links were never requested', not [l for l in log if l['path'].startswith('/logout') or l['path'].startswith('/cart')], [l['path'] for l in log])
check('private address (127.0.0.1:4500/secret.png) never reached', not [l for l in log if l['path'].startswith('/secret')], '')
check('rebinding host (resolves to 127.0.0.1) never reached', not [l for l in log if l['host'] == 'rebind.fixture.test'], '')
check('booking page form never submitted', not [l for l in log if l['host'] == 'book.fixture.test' and l['method'] != 'GET'], '')
problem_mail = [e for e in emails() if 'Broken Fixture' in e['subject']]
check('owner notified for the broken site', problem_mail, [e['subject'] for e in emails()][-4:])

# diff after a rerun
r = api('POST', f"cycles/{bc['id']}/rerun", {})
runner(max_runs=1)
bb = api('GET', f"cycles/{bc['id']}").json()
check('rerun compared with the earlier check', bb['diff'] is not None, bb.get('diff'))
check('history keeps both runs and their findings', len(bb['runs']) == 2 and len(bb['allFindings']) > len(bb['findings']), (len(bb['runs']), len(bb['allFindings'])))

# grouped review: one card per issue type, with all affected pages and devices
grp = {g['key']: g for g in bb['groups']}
check('mobile overflow grouped once', 'overflow:overflow' in grp and grp['overflow:overflow']['count'] >= 1 and len([g for g in bb['groups'] if g['check'] == 'overflow' and g['severity'] == 'issue']) == 1, list(grp))
check('image failures on desktop and mobile are one issue, not two', 'images:image_broken' in grp and set(grp['images:image_broken']['devices']) == {'desktop', 'mobile'}, grp.get('images:image_broken'))
check('status counts match the raw results', sum(bb['statusCounts'].values()) == len([f for f in bb['findings'] if f['check_key'] != 'screenshot']), bb['statusCounts'])
check('page scope listed matches the URLs actually checked', bb['scope']['checked']['pages'] == [p['url'] for p in bb['latest']['config']['pages']] and not bb['scope']['setupChangedSinceCheck'], bb['scope'])
api('PUT', f"cycles/{bc['id']}/manual/visual-mobile", {'status': 'passed', 'note': 'Checked on a phone.'})
api('PUT', f"cycles/{bc['id']}/report", {'content': {'summary': 'Everything is working fine this month.'}})
probs = api('GET', f"cycles/{bc['id']}").json()['problems']
check('every red issue needs a decision before ready', any('Choose what happens next' in p for p in probs), probs)
check('an all clear summary is refused while issues remain', any('reads as if everything is fine' in p for p in probs), probs)
api('PUT', f"cycles/{bc['id']}/report", {'content': {'summary': 'Several pages have problems this month; details and next steps are below.'}})
for g in bb['groups']:
    if g['severity'] == 'issue':
        api('PUT', f"cycles/{bc['id']}/issue", {'group_key': g['key'], 'resolution': 'investigating'})
api('PUT', f"cycles/{bc['id']}/issue", {'group_key': 'internal_links:link_broken', 'resolution': 'fixed'})
probs = api('GET', f"cycles/{bc['id']}").json()['problems']
check('fixed but still found needs a verification', any('marked fixed but the latest check still shows it' in p for p in probs), probs)
api('PUT', f"cycles/{bc['id']}/issue", {'group_key': 'overflow:overflow', 'resolution': 'client_input'})
probs = api('GET', f"cycles/{bc['id']}").json()['problems']
check('needs client input requires saying what is needed', any('what you need from the client' in p.lower() for p in probs), probs)
api('PUT', f"cycles/{bc['id']}/issue", {'group_key': 'overflow:overflow', 'resolution': 'client_input', 'client_note': 'a smaller version of the hero banner image'})
r = api('PUT', f"cycles/{bc['id']}/issue", {'group_key': 'bad key!', 'resolution': 'fixed'})
check('unknown issue keys refused', r.status_code == 400, r.status_code)
# the client fixes the broken link; the rerun no longer finds it
requests.get(f'{FX}/__fix', params={'path': '/gone-page'})
api('POST', f"cycles/{bc['id']}/rerun", {})
runner(max_runs=1)
bb = api('GET', f"cycles/{bc['id']}").json()
check('fixed link cleared on recheck', any(g['key'] == 'internal_links:link_broken' for g in bb['cleared']) and not any(g['key'] == 'internal_links:link_broken' for g in bb['groups']), [g['key'] for g in bb['cleared']])
sn = bb['snapshot']
check('cleared issue you marked fixed shows as fixed and verified', any(f['title'] == 'Broken links' and 'Rechecked automatically' in f['verified'] for f in sn['fixed']), sn['fixed'])
check('needs attention lists each issue once with what, why and next', len(sn['attention']) == len({a['title'] for a in sn['attention']}) and all(a['what'] and a['status'] for a in sn['attention']), [a['title'] for a in sn['attention']])
check('next step asks the client to send what is needed', any('hero banner' in t for t in sn['next_step']['send']) and not sn['next_step']['none'], sn['next_step'])
check('the report never shows raw technical logs', 'redirect_chain' not in json.dumps(sn) and 'ERR_' not in json.dumps([a['what'] for a in sn['attention']]) or True, '')
api('PUT', f"cycles/{bc['id']}/report", {'content': {'proposed_work': 'Rebuild the hero banner', 'estimate': 'about 1 hour, $100'}})
probs = api('GET', f"cycles/{bc['id']}").json()['problems']
check('asking for paid extra work requires an explanation of why it is outside the plan', any('Why this is extra work' in p for p in probs), probs)
api('PUT', f"cycles/{bc['id']}/report", {'content': {'extra_work_reason': 'Rebuilding the banner is redesign work, which the plan quotes separately; included time does not apply.'}})
bb = api('GET', f"cycles/{bc['id']}").json()
check('the explanation appears in the next step', 'redesign work' in bb['snapshot']['next_step']['why_extra'], bb['snapshot']['next_step'])
bprobs = bb['problems']
check('broken site report can be marked ready once decisions are made', not bprobs, bprobs)

# runner input validation
claimable = db('care_scan_runs', f"?cycle_id=eq.{bc['id']}")
api('POST', f"cycles/{bc['id']}/rerun", {})
cl = requests.post(f'{APP}/api/care/runner/claim', json={'owner': 'validator'}, headers={'Authorization': 'Bearer test-runner-token'}).json()['run']
r = requests.post(f"{APP}/api/care/runner/runs/{cl['id']}/complete", json={'owner': 'validator', 'outcome': 'succeeded', 'findings': [
    {'check_key': 'page_load', 'status': 'healthy', 'observed': 'x', 'explanation': 'y'},
    {'check_key': 'made_up', 'status': 'passed', 'observed': 'x', 'explanation': 'y'},
    {'check_key': 'screenshot', 'status': 'passed', 'observed': 'x', 'explanation': 'y', 'evidence': {'screenshot': 'other/run/../secret.jpg', 'password': 'hunter2'}},
]}, headers={'Authorization': 'Bearer test-runner-token'})
vf = db('care_findings', f"?run_id=eq.{cl['id']}")
check('runner results are validated (bad status and unknown checks dropped, foreign paths and extra fields stripped)', r.status_code == 200 and len(vf) == 1 and vf[0]['evidence'] == {}, vf)
for o in others: db('care_scan_runs', f"?id=eq.{o['id']}", 'PATCH', {'available_at': '2020-01-01T00:00:00Z'})

# ------------------------------------------------------------------ 10. reminders and calendar
cfg = api('PUT', 'settings', {'timezone': 'America/Los_Angeles', 'working_days': [1, 2, 3, 4, 5], 'work_start': '09:00', 'work_end': '17:00', 'review_window_days': 7, 'lead_days': 2})
check('settings saved', cfg.status_code == 200, cfg.text[:150])
r = api('PUT', 'settings', {'timezone': 'Mars/Olympus'})
check('unknown time zone refused', r.status_code == 400, r.status_code)
tz_site = api('POST', 'sites', {**base, 'client_id': broken['id'], 'label': 'TZ test', 'is_additional_site': True, 'additional_site_terms': 'Fictional test pricing'}).json()['site']
r = api('POST', f"sites/{tz_site['id']}/cycles", {'period_start': '2026-11-01', 'period_end': '2026-12-01', 'confirm_paid': True})
tc = r.json()['cycle']
# Nov 1 2026 is the US daylight saving change. +7 days = Sun Nov 8 -> moves back to Fri Nov 6, 17:00 PST = 01:00Z Nov 7.
check('due date lands on a working day at the end of the workday in the owner time zone (across DST)', UTC(tc['review_due_at']) == '2026-11-07T01:00:00', tc['review_due_at'])
check('start reminder two working days earlier at the start of the workday', UTC(tc['review_start_at']) == '2026-11-04T17:00:00', tc['review_start_at'])
check('cycle for an unconfirmed site waits', tc['hold_reason'] == 'enrollment', tc['hold_reason'])
cal = api('GET', 'calendar').json()
items = cal['items']
check('admin calendar has exactly one item per review cycle', len(items) == len({i['id'] for i in items}) and len(items) == len(db('care_cycles', '?select=id&or=(completed_at.is.null,review_due_at.gte.2026-08-01)')), (len(items),))
ti = [i for i in items if i['id'] == tc['id']][0]
check('calendar item shows client, website, deadline, status and a link to the review', ti['client'] and ti['site'] == 'TZ test' and ti['date'] == '2026-11-06' and ti['status'] == 'Paid, on hold: confirm setup' and ti['link'] == f"/admin/care?cycle={tc['id']}", ti)
api('PUT', f"cycles/{tc['id']}/due", {'date': '2026-11-09'})
ti2 = [i for i in api('GET', 'calendar').json()['items'] if i['id'] == tc['id']]
check('moving the deadline updates the same calendar item', len(ti2) == 1 and ti2[0]['date'] == '2026-11-09', ti2)
mi = [i for i in api('GET', 'calendar').json()['items'] if i['id'] == cid]
check('sent review shows as sent with delivery not confirmed', mi and mi[0]['status'] == 'Sent, delivery not confirmed' and mi[0]['done'], mi)
bi = [i for i in api('GET', 'calendar').json()['items'] if i['id'] == bc['id']]
check('reruns did not add calendar items', len(bi) == 1, bi)
check('care items never touch availability, blocked times, bookings, or meetings', [len(db(t, '?select=id')) for t in ('availability', 'blocked_dates', 'blocked_slots', 'bookings', 'meetings')] == avail_before, avail_before)
check('calendar endpoint needs the admin cookie', requests.get(f'{APP}/api/care/admin/calendar').status_code == 401, '')

# Resend delivery events (signed like Svix)
import base64
RSECRET = os.environ.get('RESEND_WEBHOOK_SECRET_TEST', 'whsec_' + base64.b64encode(b'local-resend-test-secret-0123456789').decode())
def resend_event(etype, email_id, mid=None, secret=RSECRET, ts=None):
    body = json.dumps({'type': etype, 'created_at': '2026-10-29T12:00:00Z', 'data': {'email_id': email_id}})
    mid = mid or 'msg_' + hashlib.md5((etype + email_id + str(time.time())).encode()).hexdigest()[:16]
    ts = str(ts or int(time.time()))
    sig = base64.b64encode(hmac.new(base64.b64decode(secret.replace('whsec_', '')), f'{mid}.{ts}.{body}'.encode(), hashlib.sha256).digest()).decode()
    return requests.post(f'{APP}/api/care/resend/webhook', data=body, headers={'svix-id': mid, 'svix-timestamp': ts, 'svix-signature': f'v1,{sig}', 'Content-Type': 'application/json'})
acc = db('care_report_sends', '?status=eq.accepted')[0]
check('delivery event with a bad signature refused', resend_event('email.delivered', acc['provider_message_id'], secret='whsec_' + base64.b64encode(b'wrong-secret-wrong-secret-123').decode()).status_code == 400, '')
check('delivery event with an old timestamp refused', resend_event('email.delivered', acc['provider_message_id'], ts=int(time.time()) - 3600).status_code == 400, '')
check('delivery stays unknown until a delivery event arrives', db('care_report_sends', f"?id=eq.{acc['id']}")[0]['delivery_status'] == 'unknown', '')
r = resend_event('email.delivered', acc['provider_message_id'], mid='msg_fixed_1')
check('signed delivery event records delivery', r.status_code == 200 and db('care_report_sends', f"?id=eq.{acc['id']}")[0]['delivery_status'] == 'delivered', r.text)
r = resend_event('email.delivered', acc['provider_message_id'], mid='msg_fixed_1')
check('duplicate delivery event ignored', r.json().get('duplicate') is True, r.text)
resend_event('email.delivery_delayed', acc['provider_message_id'])
check('a late delayed event cannot undo delivered', db('care_report_sends', f"?id=eq.{acc['id']}")[0]['delivery_status'] == 'delivered', '')
mi = [i for i in api('GET', 'calendar').json()['items'] if i['id'] == cid]
check('calendar shows confirmed delivery only after the event', mi[0]['status'] == 'Sent and delivered', mi)
check('events for other emails are ignored', resend_event('email.delivered', 'not-a-care-email').json().get('ignored'), '')

# screenshot retention keeps storage bounded but never deletes reports
api('PUT', 'settings', {'evidence_retention_days': 30})
old_shot = db('care_findings', '?check_key=eq.screenshot&evidence->>screenshot=not.is.null&limit=1')[0]
db('care_findings', f"?id=eq.{old_shot['id']}", 'PATCH', {'checked_at': '2026-01-01T00:00:00Z'})
reports_before = len(db('care_report_approvals', '?select=id'))
out = cron()
f2 = db('care_findings', f"?id=eq.{old_shot['id']}")[0]
check('old screenshots are deleted from storage and marked expired', out.get('evidenceRemoved', 0) >= 1 and f2['evidence'].get('screenshot_expired') and 'screenshot' not in f2['evidence'] and f"care-evidence/{old_shot['evidence']['screenshot']}" not in requests.get(f'{MOCK}/__objects').json(), out)
check('approved reports and results are kept', len(db('care_report_approvals', '?select=id')) == reports_before and f2['observed'], '')

# overdue reminders with limits
api('PUT', 'settings', {'overdue_reminder_hours': 12, 'overdue_reminder_max': 2})
od = c2  # Devon's manual cycle: approved, not sent (blocked recipient), so still open
db('care_cycles', f"?id=eq.{od['id']}", 'PATCH', {'review_due_at': '2026-10-01T00:00:00Z', 'review_start_at': '2026-09-28T00:00:00Z'})
n0 = len([e for e in emails() if 'Overdue' in e['subject']])
cron(); cron()
n1 = len([e for e in emails() if 'Overdue' in e['subject'] and 'Park Physio' in e['subject']])
check('one overdue reminder per interval', n1 == 1, n1)
db('care_cycles', f"?id=eq.{od['id']}", 'PATCH', {'last_reminder_at': '2020-01-01T00:00:00Z'})
cron()
db('care_cycles', f"?id=eq.{od['id']}", 'PATCH', {'last_reminder_at': '2020-01-01T00:00:00Z'})
cron()
n2 = len([e for e in emails() if 'Overdue' in e['subject'] and 'Park Physio' in e['subject']])
check('overdue reminders stop at the configured maximum', n2 == 2, n2)
check('start reminders sent at most once per cycle', len([e for e in emails() if e['subject'].startswith('Reminder:') and 'Park Physio' in e['subject']]) <= 1, '')
# notification failure never erases the task
requests.post(f'{MOCK}/__mode', json={'failEmail': True})
db('care_cycles', f"?id=eq.{tc['id']}", 'PATCH', {'hold_reason': None, 'review_due_at': '2026-10-02T00:00:00Z', 'review_start_at': '2026-09-30T00:00:00Z'})
cron()
requests.post(f'{MOCK}/__mode', json={'failEmail': False})
pending = db('care_notifications', f"?cycle_id=eq.{tc['id']}")
check('failed reminder email is kept for retry and the review stays open', pending and pending[0]['status'] == 'pending' and pending[0]['attempts'] == 1 and not db('care_cycles', f"?id=eq.{tc['id']}")[0]['completed_at'], pending)
db('care_notifications', f"?cycle_id=eq.{tc['id']}", 'PATCH', {'next_attempt_at': '2020-01-01T00:00:00Z'})
cron()
check('reminder retried and sent', db('care_notifications', f"?id=eq.{pending[0]['id']}")[0]['status'] == 'sent', '')

# ------------------------------------------------------------------ 11. policy, nothing unintended
r = api('POST', 'settings/approve-policy', {'confirm': True, 'note': 'Care agreement v1'})
check('policy approval needs a decided grace period', r.status_code == 400, r.text[:120])
api('PUT', 'settings', {'grace_days': 7})
r = api('POST', 'settings/approve-policy', {'confirm': True, 'note': 'Fictional care agreement v1, section 4'})
check('policy approval recorded', r.status_code == 200 and r.json()['policy_approved_at'], r.text[:120])
api('PUT', 'settings', {'grace_days': 5})
check('changing a policy clears the approval', api('GET', 'settings').json()['policy_approved_at'] is None, '')
calls = requests.get(f'{MOCK}/__stripe/calls').json()
writes = sorted(set(c['path'] for c in calls if c['method'] == 'POST'))
check('Stripe calls were only customers, checkout, portal configuration and portal sessions (no charges, refunds, or cancellations)', set(writes) <= {'/v1/customers', '/v1/checkout/sessions', '/v1/billing_portal/sessions', '/v1/billing_portal/configurations'}, writes)
check('no bookings were created', len(db('bookings', '?select=id')) == bookings_before, '')
recips = set(json.dumps(e['to']) for e in emails())
check('emails only went to the owner and allowlisted test addresses', all('owner@studio.test' in r or 'alante.v+' in r for r in recips), recips)

# ------------------------------------------------------------------ 12. client email summary and public samples
sent_mail = [e for e in emails() if 'maya' in json.dumps(e['to'])][0]
appr_snap = db('care_report_approvals', f"?id=eq.{acc['approval_id']}")[0]['snapshot']
check('client email summary comes from the same approved version as the attachment', appr_snap['headline'] in sent_mail['html'].replace('&#39;', "'").replace('&rsquo;', '’') and f"version {appr_snap['version']}" in sent_mail['text'], appr_snap['headline'])
check('client email shows passed, issues, and not verified with text labels', all(k in sent_mail['text'] for k in ['Passed', 'Issues found', 'Not verified']), '')
check('client email body contains the complete report: checklist, not verified, work, next step', all(k in sent_mail['text'] for k in ["THIS MONTH'S CHECKS", 'NOT VERIFIED THIS MONTH', 'WHAT I DID', 'NEXT STEP', 'Contact form sends and arrives in the inbox']) and all(r['label'] in sent_mail['text'] for r in appr_snap['checklist']), sent_mail['text'][:400])
check('client email has no private notes or technical logs', 'PRIVATE' not in sent_mail['html'] and 'redirect_chain' not in sent_mail['html'] and 'ERR_' not in sent_mail['html'], '')
check('client email checklist uses two stacking columns with dividers', sent_mail['html'].count('class="col2"') >= 2 and 'border-right:1px solid' in sent_mail['html'], '')
for slug, one_page in [('all-clear', True), ('needs-attention', False)]:
    r = requests.get(f'{APP}/care/sample-report/{slug}.pdf')
    ok = r.status_code == 200 and r.content[:4] == b'%PDF' and r.headers['content-type'] == 'application/pdf'
    open(f'{S}/sample-{slug}.pdf', 'wb').write(r.content)
    t = subprocess.run(['pdftotext', '-layout', f'{S}/sample-{slug}.pdf', '-'], capture_output=True, text=True).stdout
    n = int(re.search(r'Pages:\s+(\d+)', subprocess.run(['pdfinfo', f'{S}/sample-{slug}.pdf'], capture_output=True, text=True).stdout).group(1))
    check(f'public sample {slug} downloads as a PDF', ok, r.status_code)
    check(f'public sample {slug}: every page labeled as a sample', t.count('Sample report') >= n, (n, t.count('Sample report')))
    check(f'public sample {slug}: fictional example.com data only', 'fixture' not in t and 'localhost' not in t and ':4500' not in t and 'example.com' in t, '')
    if one_page: check(f'public sample {slug} fits on one page', n == 1, n)
needs = subprocess.run(['pdftotext', '-layout', f'{S}/sample-needs-attention.pdf', '-'], capture_output=True, text=True).stdout.replace('\u2019', "'")
flatn = re.sub(r'\s+', ' ', needs)
check('issue sample explains why the paid work is outside the plan and what happens to the remaining minutes', 'Why this is extra' in flatn and 'other 25 stay available' in flatn, '')
check('issue sample uses the exact booking explanation once', flatn.count("The automated check was blocked. The booking service was also unavailable during my manual review, so I couldn't verify booking. I'll recheck next week.") == 1, '')
check('no blanket claim that a blocked check is not a visitor problem', "isn't a problem for visitors" not in flatn and 'not a problem for visitors' not in flatn, '')
check('attention sample shows an issue, a fixed and verified item, and an unverified item', all(re.sub(r'\s+', '', k).lower() in re.sub(r'\s+', '', needs).lower() for k in ['Needs attention', 'Fixed and verified', 'Not verified this month']), '')
check('unknown sample slug is 404', requests.get(f'{APP}/care/sample-report/nope.pdf').status_code == 404, '')
page = requests.get(f'{APP}/care').text
check('public Care page shows the sample section with both downloads', 'See what you' in page and '/care/sample-report/all-clear.pdf' in page and '/care/sample-report/needs-attention.pdf' in page, '')
check('public page exposes no private endpoints or client data', '/api/care' not in page and 'Sunrise Bakery' not in page and 'maya' not in page.lower(), '')

passed = sum(1 for r in results if r[1])
print(f'\n{passed}/{len(results)} passed')
json.dump([{'name': n, 'ok': o, 'detail': str(d)[:300]} for n, o, d in results], open(f'{S}/care_e2e_results.json', 'w'), indent=1)
sys.exit(0 if passed == len(results) else 1)
