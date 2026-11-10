/**
 * A client's document history is assembled by client id only. Older records
 * that match by email alone are flagged as unlinked with a reason, never
 * merged in. Covers every document type the history lists.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const ROOT = new URL('../..', import.meta.url).pathname
const { createJiti } = createRequire(import.meta.url)('jiti')
const jiti = createJiti(import.meta.url, { alias: { '@': ROOT + 'src' } })
const { assembleClientDocuments, DOC_KINDS } = await jiti.import(ROOT + 'src/app/admin/(dashboard)/_lib/client-docs.ts')

const C = 'c1'
const client = { id: C, email: 'Sam@Example.com' }
const input = {
  client,
  files: [{ id: 'f1', client_id: C, name: 'brief.pdf', type: 'other', storage_path: 'clients/brief.pdf', created_at: '2026-09-01' }, { id: 'f2', client_id: 'c2', name: 'not mine.pdf', created_at: '2026-09-02' }],
  proposals: [
    { id: 'p1', client_id: C, client_email: 'sam@example.com', project_title: 'Clinic site', status: 'accepted', created_at: '2026-09-03' },
    { id: 'p2', client_id: null, client_email: 'sam@example.com', project_title: 'Old idea', status: 'pending', created_at: '2026-01-01' },
    { id: 'p3', client_id: 'c2', client_email: 'sam@example.com', project_title: 'Someone else', created_at: '2026-01-02' },
  ],
  sows: [{ id: 's1', proposal_id: 'p1', client_email: 'x@x.com', project_title: 'Clinic site', status: 'sent', created_at: '2026-09-04' }, { id: 's2', proposal_id: null, client_email: 'SAM@example.com', project_title: 'Loose', created_at: '2026-02-01' }],
  contracts: [
    { id: 'k1', sow_id: 's1', proposal_id: null, client_email: 'x@x.com', project_title: 'Clinic site', status: 'signed', signed_at: '2026-09-05', created_at: '2026-09-04' },
    { id: 'k2', sow_id: 's2', proposal_id: null, client_email: 'sam@example.com', project_title: 'Loose', status: 'pending', created_at: '2026-02-02' },
    { id: 'k3', sow_id: null, proposal_id: null, client_email: 'nobody@example.com', created_at: '2026-02-03' },
  ],
  invoices: [{ id: 'i1', client_id: C, invoice_number: 'INV-7', service_desc: 'Build', status: 'pending', created_at: '2026-09-06' }, { id: 'i2', client_id: 'c2', invoice_number: 'INV-8', created_at: '2026-09-06' }],
  milestones: [{ id: 'm1', invoice_id: 'i1', status: 'paid' }, { id: 'm2', invoice_id: 'i1', status: 'pending' }],
  care: {
    documents: [
      { kind: 'care_agreement', id: 'a1', site_id: 'st1', site_label: 'Clinic', title: 'Website Care agreement care-agreement-2026-11', date: '2026-10-01', status: 'Signed by Sam', pdf: '/api/care/admin/sites/st1/agreements/a1/pdf' },
      { kind: 'care_report', id: 'r1', site_id: 'st1', site_label: 'Clinic', title: 'Website health report', date: '2026-10-20', status: 'Sent to sam@example.com', pdf: '/api/care/admin/cycles/y/pdf?version=1&download=1' },
    ],
    unlinked: [{ kind: 'care_agreement', id: 'a0', title: 'Website Care agreement', date: '2026-08-01', reason: 'no client id recorded' }],
  },
}

test('every document type is included when linked by id, newest first', () => {
  const { documents } = assembleClientDocuments(input)
  assert.deepEqual(documents.map((d) => d.id), ['r1', 'a1', 'i1', 'k1', 's1', 'p1', 'f1'])
  assert.deepEqual([...new Set(documents.map((d) => d.kind))].sort(), [...DOC_KINDS].sort(), 'files, proposals, SOWs, contracts, invoices, care agreements and care reports')
  const byId = Object.fromEntries(documents.map((d) => [d.id, d]))
  assert.equal(byId.a1.pdf, '/api/care/admin/sites/st1/agreements/a1/pdf', 'the signed agreement PDF downloads directly')
  assert.equal(byId.a1.open, '/admin/care?site=st1')
  assert.equal(byId.k1.status, 'Signed')
  assert.equal(byId.k1.open, '/contracts/k1')
  assert.match(byId.i1.status, /1 of 2 milestone payments received/)
  assert.deepEqual(byId.f1.download, { path: 'clients/brief.pdf', name: 'brief.pdf' })
})

test('records that only match by email are flagged with a reason, never attributed', () => {
  const { documents, unlinked } = assembleClientDocuments(input)
  for (const id of ['p2', 's2', 'k2', 'p3', 'k3', 'f2', 'i2']) assert.ok(!documents.some((d) => d.id === id), id)
  assert.deepEqual(unlinked.map((u) => u.id).sort(), ['a0', 'k2', 'p2', 's2'])
  assert.ok(unlinked.every((u) => u.reason.length > 10))
  assert.match(unlinked.find((u) => u.id === 's2').reason, /Has no proposal/)
  assert.ok(!unlinked.some((u) => u.id === 'p3'), 'linked to another client: not this client’s and not flagged here')
})

test('without care or an email, nothing is guessed', () => {
  const r = assembleClientDocuments({ ...input, client: { id: C, email: '' }, care: null })
  assert.deepEqual(r.unlinked, [])
  assert.ok(!r.documents.some((d) => d.kind.startsWith('care_')))
})
