"""Shared helpers for the Website Care end to end tests (local stack only:
real Postgres + PostgREST, fake Stripe, fake Resend, fake GitHub, fixture
websites, the production build of the app, and the real check runner).
Fictional clients only. Nothing here reaches a real service."""
import base64, hashlib, hmac, json, os, subprocess, time
from datetime import datetime, timezone
import requests

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..'))
WORK = os.environ.get('CARE_TEST_WORK') or os.path.join(os.environ.get('TMPDIR', '/tmp'), 'website-care-tests')
os.makedirs(WORK, exist_ok=True)
APP = f"http://localhost:{os.environ.get('CARE_APP_PORT', '3123')}"
MOCK = 'http://127.0.0.1:4040'
FX = 'http://127.0.0.1:4500'
ADMIN = {'Cookie': 'admin_token=test-admin-token'}
WHSEC = 'whsec_test_secret'
JWT_SECRET = 'local-test-jwt-secret-at-least-32-characters-long'

def _jwt(role):
    b = lambda o: base64.urlsafe_b64encode(json.dumps(o, separators=(',', ':')).encode()).rstrip(b'=').decode()
    h, p = b({'alg': 'HS256', 'typ': 'JWT'}), b({'role': role, 'iss': 'care-test', 'exp': 4102444800})
    sig = base64.urlsafe_b64encode(hmac.new(JWT_SECRET.encode(), f'{h}.{p}'.encode(), hashlib.sha256).digest()).rstrip(b'=').decode()
    return f'{h}.{p}.{sig}'

SERVICE_JWT, ANON_JWT = _jwt('service_role'), _jwt('anon')
SVC = {'apikey': SERVICE_JWT, 'Authorization': f'Bearer {SERVICE_JWT}', 'Content-Type': 'application/json', 'Prefer': 'return=representation'}
ANON = {'apikey': ANON_JWT, 'Authorization': f'Bearer {ANON_JWT}'}

def ts(v): return datetime.fromisoformat(v.replace('Z', '+00:00'))

results = []
def check(name, cond, detail=''):
    results.append((name, bool(cond), detail))
    print(('PASS ' if cond else 'FAIL ') + name + ('' if cond else f'  -> {detail}'), flush=True)

def finish(label):
    failed = [r for r in results if not r[1]]
    print(f'\n{label}: {len(results) - len(failed)}/{len(results)} passed')
    json.dump([{'name': n, 'ok': o, 'detail': str(d)[:300]} for n, o, d in results], open(os.path.join(WORK, f'{label}_results.json'), 'w'), indent=1)
    raise SystemExit(1 if failed else 0)

def api(method, path, json_body=None, cookie=True):
    return requests.request(method, f'{APP}/api/care/admin/{path}', json=json_body, headers=ADMIN if cookie else {}, timeout=90)

def db(table, query='', method='GET', body=None):
    r = requests.request(method, f'{MOCK}/rest/v1/{table}{query}', headers=SVC, data=json.dumps(body) if body is not None else None, timeout=30)
    if r.status_code >= 400: raise Exception(f'db {table} {r.status_code} {r.text}')
    return r.json() if r.text else None

def ctrl(name, body=None):
    r = requests.post(f'{MOCK}/__stripe/{name}', json=body or {}, timeout=10)
    r.raise_for_status()
    return r.json()

def mode(**kw): requests.post(f'{MOCK}/__mode', json=kw, timeout=10)

def sign(payload, secret=WHSEC, t=None):
    t = t or int(time.time())
    sig = hmac.new(secret.encode(), f'{t}.{payload}'.encode(), hashlib.sha256).hexdigest()
    return f't={t},v1={sig}'

def deliver(event, secret=WHSEC, sig=None):
    payload = json.dumps(event)
    return requests.post(f'{APP}/api/care/stripe/webhook', data=payload, headers={'Stripe-Signature': sig or sign(payload, secret), 'Content-Type': 'application/json'}, timeout=60)

def deliver_all(events):
    return [deliver(e).status_code for e in events]

def cron():
    return requests.get(f'{APP}/api/care/cron', headers={'Authorization': 'Bearer test-cron'}, timeout=90).json()

RUNNER_HOSTS = {h: '127.0.0.1' for h in ['good.fixture.test', 'broken.fixture.test', 'bot.fixture.test', 'slow.fixture.test', 'book.fixture.test', 'tls.fixture.test', 'elsewhere.fixture.test']}
RUNNER_HOSTS['rebind.fixture.test'] = 'dns:127.0.0.1'

def runner(max_runs=3, token='test-runner-token'):
    env = {**os.environ, 'CARE_APP_URL': APP, 'CARE_RUNNER_TOKEN': token, 'CARE_RUNNER_TEST_HOSTS': json.dumps(RUNNER_HOSTS), 'CARE_RUNNER_MAX_RUNS': str(max_runs)}
    env.pop('GITHUB_ACTIONS', None)
    p = subprocess.run(['node', 'run.mjs'], cwd=os.path.join(REPO, 'care-runner'), env=env, capture_output=True, text=True, timeout=600)
    return p.stdout + p.stderr

def emails(): return requests.get(f'{MOCK}/__emails').json()
def dispatches(): return requests.get(f'{MOCK}/__dispatches').json()
def fxlog(): return requests.get(f'{FX}/__log').json()
def stripe_calls(): return requests.get(f'{MOCK}/__stripe/calls').json()
def stripe_state(): return requests.get(f'{MOCK}/__stripe/state').json()

def reset_stack():
    subprocess.run(['bash', os.path.join(HERE, 'harness', 'reset_db.sh')], check=True, capture_output=True)
    subprocess.run(['bash', os.path.join(HERE, 'harness', 'start_services.sh')], check=True, capture_output=True)
    time.sleep(1)
    requests.post(f'{MOCK}/__reset'); requests.get(f'{FX}/__reset')

CONFIRM = {'confirm_website': True, 'confirm_authorization': True, 'confirm_checklist': True, 'authorization_note': 'Signed care agreement, Oct 28 (fictional)'}

def wait_for(fn, timeout=10, step=0.25):
    end = time.time() + timeout
    while time.time() < end:
        v = fn()
        if v: return v
        time.sleep(step)
    return fn()
