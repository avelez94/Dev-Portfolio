/**
 * Rates and payment terms: the $70 standard rate for new documents, the 50%
 * deposit plus milestones schedule (to the cent), the Booking & Payments
 * automation rule, and documents issued earlier keeping their exact wording.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const ROOT = new URL('../..', import.meta.url).pathname
const { createJiti } = createRequire(import.meta.url)('jiti')
const jiti = createJiti(import.meta.url, { alias: { '@': ROOT + 'src', 'server-only': ROOT + 'tests/care/empty.mjs' } })
const T = await jiti.import(ROOT + 'src/lib/terms.ts')
const P = await jiti.import(ROOT + 'src/lib/payment-schedule.ts')
const A = await jiti.import(ROOT + 'src/lib/automation.ts')
const { CARE_ADDITIONAL_PRICING } = await jiti.import(ROOT + 'src/content/care-terms.ts')

const latest = (o = {}) => ({ terms_version: T.TERMS_VERSION, hourly_rate: 70, payment_plan: 'milestone_balance', ...o })
const october = (o = {}) => ({ terms_version: '2026-10-standard-rate', hourly_rate: 100, payment_plan: 'standard', ...o })
const ms = (fee, name = 'Design approved', deliverables = 'Approval of the design', dueDate = '') => ({ name, deliverables, fee: String(fee), dueDate })

test('the standard rate for new hourly work is $70 with a one hour minimum or a fixed quote', () => {
  assert.equal(T.STANDARD_HOURLY_RATE, 70)
  assert.equal(T.additionalWorkSentence(), 'Additional work is billed at $70/hr with a one hour minimum, or at a fixed quote we agree on, and an estimate is approved before work begins.')
  assert.match(T.contractServicesClause(latest()), /billed at \$70\/hr with a one hour minimum, or at a fixed quote the parties agree on in writing\./)
  assert.match(T.proposalChangeOrderLine(latest()), /\$70\/hr with a one hour minimum, or at a fixed quote we agree on/)
  assert.match(CARE_ADDITIONAL_PRICING, /^Additional work is \$70 an hour with a one hour minimum, or a fixed quote we agree on\./)
})

test('an explicitly agreed rate on a document is kept', () => {
  assert.match(T.contractServicesClause(latest({ hourly_rate: 85 })), /\$85\/hr/)
  assert.match(T.sowRevisionsText(latest({ hourly_rate: 85 })), /\$85\/hr/)
})

test('documents issued earlier keep their original wording, rate, and payment plan', () => {
  // October 2026 terms, $100 stored, 50/50 at delivery: word for word as issued.
  assert.equal(T.contractServicesClause(october()), 'Alante Velez agrees to design and develop the project described above. Work outside the agreed scope requires a written estimate approved by Client before it begins, and is billed at $100/hr with a one hour minimum.')
  assert.equal(T.proposalChangeOrderLine(october()), 'Change orders and additional revisions are billed at $100/hr with a one hour minimum, after you approve an estimate.')
  assert.deepEqual(T.proposalPaymentLines(october({ deposit_pct: 50 }), 4200), ['Deposit (50% due upfront to reserve the project and begin work): $2,100', 'Remaining 50% ($2,100) is due at delivery, before public launch or final handoff.'])
  assert.equal(T.balanceLabel(october()), 'Remaining 50% due at delivery, before launch or handoff')
  assert.match(T.contractPaymentClausePage({ ...october(), total_fee: 4200, deposit: 2100, balance: 2100, payment_method: 'Zelle' }), /The remaining \$2,100 \(50%\) is due at delivery/)
  // October milestones plan.
  assert.equal(T.balanceLabel(october({ payment_plan: 'milestones' })), 'Balance paid across the milestones in your proposal')
  // Unstamped documents: the original $65 wording.
  assert.equal(T.proposalChangeOrderLine({}), 'Change orders billed at $65/hr.')
  assert.match(T.contractRevisionsClausePdf({}), /\$65\/hr\.$/)
})

test('the deposit is 50% of the total, to the cent, and the milestones must equal the rest', () => {
  assert.equal(P.depositCents(150001), 75001, 'an odd cent goes to the deposit')
  const ok = P.checkSchedule('1500.01', [ms(500), ms(250, 'Launch', 'Site live')])
  assert.equal(ok.ok, true)
  assert.equal(ok.schedule.deposit, 750.01)
  assert.equal(ok.schedule.balance, 750)
  assert.equal(Math.round((ok.schedule.deposit + ok.schedule.milestones.reduce((s, m) => s + m.fee, 0)) * 100), 150001, 'deposit plus milestones equals the total, nothing counted twice')

  const short = P.checkSchedule(3000, [ms(1000)])
  assert.equal(short.ok, false)
  assert.match(short.problems.join(' '), /need to equal the remaining 50%, \$1,500 \(\$500 still to assign\)/)
  assert.match(P.checkSchedule(3000, [ms(1600)]).problems.join(' '), /\$100 too much/)
  assert.match(P.checkSchedule(3000, []).problems.join(' '), /Add at least one milestone/)
  assert.match(P.checkSchedule(3000, [ms(1500, '', 'x')]).problems.join(' '), /Milestone 1 needs a name/)
  assert.match(P.checkSchedule(3000, [ms(1500, 'x', '')]).problems.join(' '), /deliverable or payment trigger/)
  assert.match(P.checkSchedule(3000, [ms('10.005')]).problems.join(' '), /whole cents/)
  assert.match(P.checkSchedule(3000, [ms(1500, 'x', 'y', '2026-13-40')]).problems.join(' '), /invalid due date/)
  assert.match(P.checkSchedule(0, [ms(1)]).problems.join(' '), /Enter the project total/)
  // A blank row (only the default name) is ignored, not counted as a milestone.
  assert.equal(P.checkSchedule(3000, [ms(1500), { name: 'Milestone 2', deliverables: '', fee: '', dueDate: '' }]).ok, true)
})

test('current documents describe the deposit and each milestone the same way everywhere', () => {
  assert.deepEqual(T.proposalPaymentLines(latest(), 3200), ['Deposit (50% due before work begins): $1,600', 'The remaining 50% ($1,600) is divided across the project milestones listed in this proposal and your agreement.'])
  const clause = T.contractPaymentClausePage({ ...latest(), total_fee: 3200, deposit: 1600, balance: 1600, payment_method: 'Zelle', line_items: [{ name: 'Design approved', deliverables: 'Approval of the design.', dueDate: '2026-11-20', fee: 1000 }, { name: 'Launch', deliverables: 'Site live', dueDate: null, fee: 600 }] })
  assert.match(clause, /A deposit of \$1,600 \(50%\) is due before work begins\. The remaining \$1,600 \(50%\) is divided across the project milestones/)
  assert.match(clause, /Milestone 1, Design approved: \$1,000, invoiced on Approval of the design \(target November 20, 2026\)\. Milestone 2, Launch: \$600, invoiced on Site live\./)
  assert.match(clause, /nothing is charged automatically/)
  assert.deepEqual(P.scheduleLines({ deposit: 1600, milestones: [{ name: 'Launch', deliverables: 'Site live', dueDate: null, fee: 1600 }] }), ['Deposit (50%), due before work begins: $1,600', 'Milestone 1, Launch: $1,600. Payment trigger: Site live.'])
  assert.equal(T.PROJECT_PAYMENT_POLICY, 'A 50% deposit is due before work begins. The remaining 50% is divided across the project milestones listed in your proposal and agreement.')
})

test('Booking & Payments never charges again for its included confirmations and reminders', () => {
  const lines = A.bookingAutomationLines([
    { description: 'Booking confirmation and reminder emails', price: '300' },
    { description: 'Custom AI follow up workflow for missed appointments', price: '900' },
    { description: 'Appointment reminders', price: '0' },
    { description: 'Design and build', price: '2400' },
  ])
  assert.deepEqual(lines.map((l) => l.description), ['Booking confirmation and reminder emails'])
})
