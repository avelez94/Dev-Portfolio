/**
 * The Website Care introduction offered when a project is marked complete in
 * Pipeline, on this machine only: the real routes on a throwaway PostgreSQL,
 * Resend pointed at a local fake, and the client email allowlist exactly as
 * in production (only test addresses allowed). No real client is contacted.
 */
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { available, one, rows, q, sql } from './pg.mjs'
import { startStack, stopStack, api } from './local-stack.mjs'
import { startFakeResend } from './fake-services.mjs'

const skip = available ? false : 'PostgreSQL server binaries not found (set PG_BIN to run these tests)'
let resend, testClient, project, realClient

before(async () => {
  if (skip) return
  resend = await startFakeResend(55996)
  await startStack({ env: { RESEND_API_KEY: 're_local', RESEND_BASE_URL: 'http://127.0.0.1:55996', CARE_EMAIL_ALLOWLIST: 'owner+care*@example.com' } })
  testClient = one(`insert into clients (name, email, business) values ('Alante Test', 'owner+care1@example.com', 'Practice Studio') returning id`).id
  project = one(`insert into projects (client_id, name, status) values (${q(testClient)}, 'Practice Studio website', 'active') returning id`).id
  realClient = one(`insert into clients (name, email, business) values ('Real Person', 'real.person@example.org', 'Real Business') returning id`).id
  sql(`insert into projects (client_id, name, status) values (${q(realClient)}, 'Real Business website', 'active')`)
}, { timeout: 240000 })
after(async () => { if (!skip) { await stopStack(); resend?.server.close() } })

const preview = async (c, p) => (await api(`clients/${c}/introduction${p ? `?project=${p}` : ''}`)).data
const send = (c, p) => api(`clients/${c}/introduction`, { method: 'POST', json: { project_id: p || null } })

test('the preview shows the recipient and the email, and sends nothing', { skip }, async () => {
  const p = await preview(testClient)
  assert.equal(p.can_send, true, p.skip)
  assert.deepEqual(p.recipient, { name: 'Alante Test', email: 'owner+care1@example.com' })
  assert.equal(p.project.id, project, 'the client’s active project is the one being completed')
  assert.equal(p.email.subject, 'Keeping Practice Studio running smoothly')
  for (const t of ['Essential Care', '$59 a month', 'Business Care', '$129 a month', 'Premium Care', '$249 a month', 'Includes 30 minutes a month', 'reply to this email with the one you choose', 'short online agreement']) assert.ok(p.email.text.includes(t), t)
  assert.match(p.email.text, /https:\/\/www\.alantevelez\.com\/care/)
  assert.doesNotMatch(p.email.text + p.email.subject, /[–—]| - /, 'no dashes in client text')
  assert.equal(resend.emails.length, 0)
})

test('a real client address is never emailed while client emails are limited to the allowlist', { skip }, async () => {
  const p = await preview(realClient)
  assert.equal(p.can_send, false)
  assert.match(p.skip, /allowlist|switched off/)
  const r = await send(realClient)
  assert.equal(r.status, 409)
  assert.equal(resend.emails.length, 0)
  assert.equal(rows(`select id from care_introductions where client_id = ${q(realClient)}`).length, 0)
})

test('sent once per project: recorded under the client; reopening and completing again doesn’t send a second one', { skip }, async () => {
  const r = await send(testClient, project)
  assert.equal(r.status, 201, JSON.stringify(r.data))
  assert.equal(resend.emails.length, 1)
  assert.equal(resend.emails[0].to, 'owner+care1@example.com')
  const rec = one(`select * from care_introductions where client_id = ${q(testClient)}`)
  assert.deepEqual([rec.status, rec.project_id, rec.dedupe_key], ['sent', project, `project:${project}`])
  const docs = (await api(`clients/${testClient}/documents`)).data.documents
  assert.ok(docs.some((d) => d.kind === 'care_intro' && /Sent to owner\+care1@example\.com/.test(d.status)), 'listed in the client’s documents')

  // Two quick clicks, then the project reopened and completed again.
  assert.equal((await send(testClient, project)).status, 409)
  // Reopened: the project is active again (Pipeline's stage lives on the client, which this test database doesn't model).
  sql(`update projects set status = 'active' where id = ${q(project)}`)
  const again = await preview(testClient)
  assert.equal(again.can_send, false)
  assert.match(again.skip, /Already sent for this project/)
  assert.equal((await send(testClient, project)).status, 409)
  assert.equal(resend.emails.length, 1, 'still exactly one email')

  // A new project for the same client is a new offer.
  const p2 = one(`insert into projects (client_id, name, status) values (${q(testClient)}, 'Practice Studio redesign', 'active') returning id`).id
  assert.equal((await preview(testClient, p2)).can_send, true)
})

test('a failed send is recorded and can be retried; a success is never resent', { skip }, async () => {
  const c = one(`insert into clients (name, email, business) values ('Retry Test', 'owner+care2@example.com', 'Retry Studio') returning id`).id
  resend.failNext = 1
  const r = await send(c)
  assert.equal(r.status, 502)
  assert.match(r.data.error, /wasn’t sent/)
  assert.equal(one(`select status from care_introductions where client_id = ${q(c)}`).status, 'failed')
  assert.equal((await preview(c)).can_send, true, 'a failed send can be tried again')
  const ok = await send(c)
  assert.equal(ok.status, 201)
  assert.equal(rows(`select id from care_introductions where client_id = ${q(c)}`).length, 1, 'one record, now sent')
  assert.equal(one(`select dedupe_key from care_introductions where client_id = ${q(c)}`).dedupe_key, `client:${c}`, 'a client with no project gets one introduction')
})

test('skipped when the client already has active Website Care', { skip }, async () => {
  const c = one(`insert into clients (name, email, business) values ('Care Client', 'owner+care3@example.com', 'Cared For') returning id`).id
  sql(`insert into care_sites (client_id, label, site_url, approved_domains, plan, enrollment_status, recipient_email, paid_through) values (${q(c)}, 'Cared For', 'https://cared.example.com/', '{cared.example.com}', 'business', 'confirmed', 'owner+care3@example.com', now() + interval '20 days')`)
  const p = await preview(c)
  assert.equal(p.can_send, false)
  assert.match(p.skip, /already has active Website Care \(Cared For\)/)
  assert.equal((await send(c)).status, 409)
})
