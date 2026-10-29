/**
 * Fictional data for the admin demo. Every person, business, address, and
 * email here is made up (example.com addresses only). IDs are fixed so links
 * to a demo client, website, or review open the same record in every demo
 * session; each session still has its own separate copy of the data.
 */
import 'server-only'
import { TERMS_VERSION } from '@/lib/terms'
import { seedSubscription } from './stripe-sim'

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

export const DEMO_IDS = {
  clients: { physio: id(101), bakery: id(102), dental: id(103), studio: id(104), garden: id(105), tutor: id(106) },
  sites: { physio: id(201), bakery: id(202), dental: id(203) },
  cycles: { physio: id(301), bakery: id(302), dental: id(303) },
  estimates: { physioTeam: id(401) },
  leads: { booked: id(501), pending: id(502), inquiry: id(503) },
  bookings: { booked: id(511) },
  documents: { pendingProposal: id(933), acceptedProposal: id(934), legacyProposal: id(932), signedContract: id(943), unsignedContract: id(944), legacyContract: id(941), scheduleInvoice: id(805), unsignedInvoice: id(806) },
} as const

const DAY = 86_400_000
const at = (days: number, hour = 15) => {
  const d = new Date(Date.now() + days * DAY)
  d.setUTCHours(hour, 0, 0, 0)
  return d.toISOString()
}
const day = (days: number) => at(days).slice(0, 10)
const startOfDay = (days: number) => at(days, 0)

/** A tiny valid PDF, so downloads in the demo open as a real file. */
export function samplePdf(title: string) {
  const text = `BT /F1 18 Tf 72 720 Td (${title.replace(/[()\\]/g, '')}) Tj 0 -28 Td /F1 11 Tf (Demo file with fictional content.) Tj ET`
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${text.length} >>\nstream\n${text}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]
  let out = '%PDF-1.4\n'
  const offsets: number[] = []
  objs.forEach((o, i) => { offsets.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n` })
  const xref = out.length
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => String(o).padStart(10, '0') + ' 00000 n \n').join('')}`
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
  return Buffer.from(out)
}

type Rows = Record<string, Record<string, unknown>[]>

export function adminRows(): Rows {
  const C = DEMO_IDS.clients
  const L = DEMO_IDS.leads
  const D = DEMO_IDS.documents
  return {
    intake_submissions: [
      { id: L.booked, name: 'Dana Brooks', email: 'dana@example.com', business: 'Brooks Bike Repair', project_type: 'Business Website', description: 'A five page site with online repair booking.', budget: '$3k to $5k', timeline: 'Next two months', heard_from: 'Google', status: 'booked', submitted_at: at(-3), stage: 'details', source: 'questionnaire', interest: 'business-website' },
      { id: L.pending, name: 'Lee Morgan', email: 'lee@example.com', business: 'Morgan Tutoring', project_type: 'Landing Page', description: 'One page for summer tutoring sign ups.', budget: 'Under $2k', timeline: 'Within a month', heard_from: 'Referral', status: 'pending', submitted_at: at(-1), stage: 'details', source: 'questionnaire', interest: 'landing-page' },
      { id: L.inquiry, name: 'Riley Chen', email: 'riley@example.com', business: null, project_type: 'Website Care', description: 'Looking for someone to look after an existing site.', budget: null, timeline: null, heard_from: 'Homepage', status: 'pending', submitted_at: at(0, 12), stage: 'inquiry', source: 'homepage', interest: 'care', inquiry_note: 'Our current developer moved on. Can you take over updates?' },
    ],
    bookings: [
      { id: DEMO_IDS.bookings.booked, intake_id: L.booked, scheduled_at: at(2, 17), zoom_join_url: 'https://demo.invalid/zoom/join/brooks', zoom_host_url: 'https://demo.invalid/zoom/host/brooks', status: 'scheduled', created_at: at(-3) },
    ],
    clients: [
      { id: C.physio, name: 'Sam Patel', email: 'frontdesk@example.com', business: 'Northside Physio', pipeline_stage: 'closed', created_at: at(-120), notes: 'On Business Care since launch.', platform: 'direct' },
      { id: C.bakery, name: 'Jordan Reyes', email: 'owner@example.com', business: 'Harbor Street Bakery', pipeline_stage: 'closed', created_at: at(-200), notes: 'Premium Care. Agreement predates the flexible plan time terms.', platform: 'referral' },
      { id: C.dental, name: 'Avery Kim', email: 'office@example.com', business: 'Lakeside Dental', pipeline_stage: 'closed', created_at: at(-60), notes: null, platform: 'direct' },
      { id: C.studio, name: 'Morgan Ellis', email: 'morgan@example.com', business: 'Ellis Yoga Studio', pipeline_stage: 'proposal_sent', created_at: at(-9), notes: 'Wants class schedule embedded.', platform: 'direct' },
      { id: C.garden, name: 'Casey Rivera', email: 'casey@example.com', business: 'Rivera Garden Design', pipeline_stage: 'active_project', created_at: at(-30), notes: null, platform: 'referral' },
      { id: C.tutor, name: 'Taylor Brooks', email: 'taylor@example.com', business: 'Brooks Tutoring', pipeline_stage: 'proposal_sent', created_at: at(-2), notes: 'Met at the small business fair.', platform: 'direct' },
    ],
    availability: [0, 1, 2, 3, 4, 5, 6].map((d) => ({ id: id(600 + d), day_of_week: d, start_time: '09:00:00', end_time: '17:00:00', is_active: d > 0 && d < 6 })),
    blocked_dates: [{ id: id(611), blocked_date: day(12), reason: 'Conference (demo)' }],
    blocked_slots: [],
    projects: [
      { id: id(701), client_id: C.garden, name: 'Rivera Garden Design website', type: 'Business Website', status: 'active', value: 4200, platform: 'referral', start_date: day(-20), end_date: day(25), notes: 'Gallery and quote request form.', created_at: at(-20) },
      { id: id(702), client_id: C.dental, name: 'Lakeside Dental launch', type: 'Business Website', status: 'completed', value: 5200, platform: 'direct', start_date: day(-110), end_date: day(-60), notes: null, created_at: at(-110) },
    ],
    invoices: [
      { id: id(801), project_id: id(701), client_id: C.garden, invoice_number: 'INV-DEMO-101', amount: 2100, status: 'paid', invoice_type: 'fixed_fee', total_fee: 4200, deposit_amount: 2100, deposit_paid_date: day(-19), hours: 0, hourly_rate: 100, service_desc: 'Website build, 50% deposit', due_date: day(-19), paid_date: day(-19), created_at: at(-20) },
      { id: id(802), project_id: id(701), client_id: C.garden, invoice_number: 'INV-DEMO-102', amount: 2100, status: 'pending', invoice_type: 'fixed_fee', total_fee: 4200, deposit_amount: 2100, hours: 0, hourly_rate: 100, service_desc: 'Website build, balance on launch', due_date: day(26), created_at: at(-20) },
      { id: id(803), project_id: null, client_id: C.dental, invoice_number: 'INV-DEMO-095', amount: 150, status: 'pending', invoice_type: 'hourly', total_fee: 150, deposit_amount: 0, hours: 1.5, hourly_rate: 100, service_desc: 'Occasional support: insurance page update (1.5 hours)', due_date: day(-4), created_at: at(-18) },
      { id: DEMO_IDS.documents.scheduleInvoice, project_id: null, client_id: C.dental, invoice_number: 'INV-DEMO-110', amount: 1800, status: 'deposit_paid', invoice_type: 'milestone', total_fee: 1800, deposit_amount: 900, deposit_paid_date: day(-11), hours: 0, hourly_rate: 70, service_desc: 'Online booking add on', due_date: day(-12), notes: `contract_id:${DEMO_IDS.documents.signedContract}`, created_at: at(-14) },
      { id: DEMO_IDS.documents.unsignedInvoice, project_id: null, client_id: C.tutor, invoice_number: 'INV-DEMO-120', amount: 6000, status: 'awaiting_signature', invoice_type: 'milestone', total_fee: 6000, deposit_amount: 3000, hours: 0, hourly_rate: 70, service_desc: 'Tutoring portal: deposit to begin', due_date: day(7), notes: `contract_id:${DEMO_IDS.documents.unsignedContract}`, created_at: at(-1) },
      { id: id(804), project_id: id(702), client_id: C.dental, invoice_number: 'INV-DEMO-080', amount: 5200, status: 'paid', invoice_type: 'fixed_fee', total_fee: 5200, deposit_amount: 2600, deposit_paid_date: day(-108), hours: 0, hourly_rate: 100, service_desc: 'Website build', due_date: day(-60), paid_date: day(-58), created_at: at(-110) },
    ],
    invoice_milestones: [
      // Lakeside Dental's add-on project on the current terms: deposit paid, first milestone invoiced.
      { id: id(851), invoice_id: id(805), name: 'Deposit (50%)', deliverables: 'Due before work begins', due_date: day(-12), fee: 900, status: 'paid', paid_date: day(-11), created_at: at(-14, 10) },
      { id: id(852), invoice_id: id(805), name: 'Booking flow design approved', deliverables: 'Approval of the booking flow design', due_date: day(-2), fee: 450, status: 'invoiced', created_at: at(-14, 11) },
      { id: id(853), invoice_id: id(805), name: 'Launch', deliverables: 'Online booking live on the site', due_date: day(14), fee: 450, status: 'pending', created_at: at(-14, 12) },
      // Taylor Brooks's contract, waiting for signature: the deposit is invoiced when they sign.
      { id: id(861), invoice_id: id(806), name: 'Deposit (50%)', deliverables: 'Due before work begins', due_date: day(7), fee: 3000, status: 'pending', created_at: at(-1, 10) },
      { id: id(862), invoice_id: id(806), name: 'Design approved', deliverables: 'Approval of the portal screens', due_date: null, fee: 1000, status: 'pending', created_at: at(-1, 11) },
      { id: id(863), invoice_id: id(806), name: 'Portal ready for testing', deliverables: 'Booking and progress notes working on the preview site', due_date: null, fee: 1250, status: 'pending', created_at: at(-1, 12) },
      { id: id(864), invoice_id: id(806), name: 'Launch', deliverables: 'Portal live for your families', due_date: null, fee: 750, status: 'pending', created_at: at(-1, 13) },
    ],
    documents: [{ id: id(901), client_id: C.garden, name: 'garden-brief.pdf', type: 'other', storage_path: 'clients/demo/garden-brief.pdf', created_at: at(-19) }],
    // Titles as stored before the November rename; the admin shows the new titles.
    pricing: [
      { id: id(911), name: 'Landing Page', price: 'From $1,500', description: 'A focused business website: up to five pages.', updated_at: at(-50) },
      { id: id(912), name: 'Booking + Payments', price: 'From $2,500', description: 'Online booking and one payment flow, with the service’s standard confirmations and reminders.', updated_at: at(-50) },
      { id: id(913), name: 'Web Application', price: 'From $5,000', description: 'Accounts, dashboards, stores, portals.', updated_at: at(-50) },
      { id: id(914), name: 'AI Workflow', price: 'Quoted', description: 'Custom automations and AI integrations, scoped separately.', updated_at: at(-50) },
      { id: id(915), name: 'Deposit', price: '50%', description: '50% deposit before work begins; remaining 50% across the milestones in the proposal.', updated_at: at(-50) },
    ],
    meetings: [{ id: id(921), client_id: C.garden, scheduled_at: at(4, 18), zoom_join_url: 'https://demo.invalid/zoom/join/rivera', zoom_host_url: 'https://demo.invalid/zoom/host/rivera', title: 'Design review', status: 'scheduled', created_at: at(-5) }],
    proposals: [
      // Current terms: 50% deposit, remaining 50% across milestones (in the linked SOW). Waiting for the client.
      { id: D.pendingProposal, client_id: C.studio, client_name: 'Morgan Ellis', client_email: 'morgan@example.com', client_business: 'Ellis Yoga Studio', project_title: 'Ellis Yoga Studio website', project_type: 'Booking & Payments', understood: 'A calm site with the class schedule, online class booking, and a drop in class payment.', line_items: [{ description: 'Design and build, five pages', price: 2400 }, { description: 'Class booking and drop in payment setup', price: 800 }], total: 3200, deposit_pct: 50, timeline: '5 to 6 weeks from the deposit', next_steps: 'Once you accept, I’ll send the contract. Your deposit invoice follows the signature.', status: 'pending', terms_version: TERMS_VERSION, hourly_rate: 70, payment_plan: 'milestone_balance', created_at: at(-2) },
      // Current terms, accepted: ready for a contract.
      { id: D.acceptedProposal, client_id: C.tutor, client_name: 'Taylor Brooks', client_email: 'taylor@example.com', client_business: 'Brooks Tutoring', project_title: 'Tutoring portal', project_type: 'Custom Website or Application', understood: 'A portal where families book sessions and see progress notes.', line_items: [{ description: 'Discovery and design', price: 1500 }, { description: 'Portal build', price: 4500 }], total: 6000, deposit_pct: 50, status: 'accepted', responded_at: at(-1), terms_version: TERMS_VERSION, hourly_rate: 70, payment_plan: 'milestone_balance', created_at: at(-3) },
      // Issued under the October terms: kept exactly as issued (50% at delivery, $100 an hour).
      { id: D.legacyProposal, client_id: C.garden, client_name: 'Casey Rivera', client_email: 'casey@example.com', client_business: 'Rivera Garden Design', project_title: 'Rivera Garden Design website', project_type: 'Landing Page', line_items: [{ description: 'Design and build', price: 4200 }], total: 4200, deposit_pct: 50, status: 'accepted', responded_at: at(-21), terms_version: '2026-10-standard-rate', hourly_rate: 100, payment_plan: 'standard', created_at: at(-24) },
    ],
    sows: [
      { id: id(961), proposal_id: D.pendingProposal, client_name: 'Morgan Ellis', client_email: 'morgan@example.com', client_business: 'Ellis Yoga Studio', project_title: 'Ellis Yoga Studio website', project_type: 'Booking & Payments', line_items: [{ name: 'Design approved', deliverables: 'Approval of the homepage and class schedule designs', dueDate: day(14), fee: 800 }, { name: 'Booking ready for testing', deliverables: 'Class booking and payment working on the preview site', dueDate: day(28), fee: 500 }, { name: 'Launch', deliverables: 'Site live on your domain', dueDate: null, fee: 300 }], total: 3200, deposit: 1600, balance: 1600, deposit_pct: 50, revisions: '2', hourly_rate: 70, payment_method: 'Stripe, PayPal, Zelle, or Wise', status: 'pending', terms_version: TERMS_VERSION, payment_plan: 'milestone_balance', created_at: at(-2) },
      { id: id(962), proposal_id: D.acceptedProposal, client_name: 'Taylor Brooks', client_email: 'taylor@example.com', client_business: 'Brooks Tutoring', project_title: 'Tutoring portal', project_type: 'Custom Website or Application', line_items: [{ name: 'Design approved', deliverables: 'Approval of the portal screens', dueDate: null, fee: 1000 }, { name: 'Portal ready for testing', deliverables: 'Booking and progress notes working on the preview site', dueDate: null, fee: 1250 }, { name: 'Launch', deliverables: 'Portal live for your families', dueDate: null, fee: 750 }], total: 6000, deposit: 3000, balance: 3000, deposit_pct: 50, revisions: '2', hourly_rate: 70, payment_method: 'Stripe, PayPal, Zelle, or Wise', status: 'accepted', terms_version: TERMS_VERSION, payment_plan: 'milestone_balance', created_at: at(-3) },
    ],
    contracts: [
      { id: D.legacyContract, client_name: 'Casey Rivera', client_email: 'casey@example.com', client_business: 'Rivera Garden Design', project_title: 'Rivera Garden Design website', project_type: 'Landing Page', status: 'signed', signed_at: at(-20), total_fee: 4200, deposit: 2100, balance: 2100, kill_fee_pct: 25, payment_method: 'Stripe, PayPal, Zelle, or Wise', line_items: [], terms_version: '2026-10-standard-rate', hourly_rate: 100, payment_plan: 'standard', created_at: at(-21) },
      { id: D.unsignedContract, client_name: 'Taylor Brooks', client_email: 'taylor@example.com', client_business: 'Brooks Tutoring', project_title: 'Tutoring portal', project_type: 'Custom Website or Application', status: 'pending', total_fee: 6000, deposit: 3000, balance: 3000, kill_fee_pct: 25, payment_method: 'Stripe, PayPal, Zelle, or Wise', line_items: [{ name: 'Design approved', deliverables: 'Approval of the portal screens', dueDate: null, fee: 1000 }, { name: 'Portal ready for testing', deliverables: 'Booking and progress notes working on the preview site', dueDate: null, fee: 1250 }, { name: 'Launch', deliverables: 'Portal live for your families', dueDate: null, fee: 750 }], terms_version: TERMS_VERSION, hourly_rate: 70, payment_plan: 'milestone_balance', created_at: at(-1) },
      { id: D.signedContract, client_name: 'Avery Kim', client_email: 'office@example.com', client_business: 'Lakeside Dental', project_title: 'Online booking add on', project_type: 'Booking & Payments', status: 'signed', signed_at: at(-13), total_fee: 1800, deposit: 900, balance: 900, kill_fee_pct: 25, payment_method: 'Stripe, PayPal, Zelle, or Wise', line_items: [{ name: 'Booking flow design approved', deliverables: 'Approval of the booking flow design', dueDate: day(-2), fee: 450 }, { name: 'Launch', deliverables: 'Online booking live on the site', dueDate: day(14), fee: 450 }], terms_version: TERMS_VERSION, hourly_rate: 70, payment_plan: 'milestone_balance', created_at: at(-14) },
    ],
    debt_payoff: [
      { id: id(951), creditor: 'Demo Card A', promo_name: '0% balance transfer', original_balance: 2400, current_balance: 1350, promo_deadline: day(90), deadline_is_estimated: false, priority: 1, completed: false, created_at: at(-200), updated_at: at(-10) },
      { id: id(952), creditor: 'Demo Laptop Plan', promo_name: null, original_balance: 900, current_balance: 0, promo_deadline: null, deadline_is_estimated: false, priority: 2, completed: true, completed_at: at(-40), created_at: at(-300), updated_at: at(-40) },
    ],
  }
}

export const DEMO_FILES: Record<string, { type: string; data: () => Buffer }> = {
  'freelance-docs/clients/demo/garden-brief.pdf': { type: 'application/pdf', data: () => samplePdf('Rivera Garden Design brief') },
}

const physioPages = [{ label: 'Home', url: 'https://physio.example.com/' }, { label: 'Team', url: 'https://physio.example.com/team' }, { label: 'Book', url: 'https://physio.example.com/book' }]
const physioDest = [{ label: 'Online booking', url: 'https://booking.example.com/northside', kind: 'booking' }]
const dentalPages = [{ label: 'Home', url: 'https://dental.example.com/' }, { label: 'Insurance', url: 'https://dental.example.com/insurance' }]

export function careRows(): Rows {
  const C = DEMO_IDS.clients
  const S = DEMO_IDS.sites
  const Y = DEMO_IDS.cycles
  const checklist = [
    { id: 'visual', label: 'Desktop appearance looks right', category: 'Visual' },
    { id: 'phone', label: 'Phone layout looks right', category: 'Visual' },
    { id: 'form', label: 'Contact form sends a test message', category: 'Forms' },
  ]
  // Northside Physio and Harbor Street Bakery are billed by hand (paid periods added under
  // "Billed outside Stripe?"); Lakeside Dental pays through a (simulated) Stripe subscription.
  const site = (o: Record<string, unknown>) => ({ enrollment_status: 'confirmed', manual_checklist: checklist, confirmed_at: at(-90), authorization_note: 'Signed care agreement (demo)', billing_state: 'not_started', ...o })
  return {
    care_sites: [
      site({ id: S.physio, client_id: C.physio, label: 'Northside Physio', site_url: 'https://physio.example.com/', approved_domains: ['physio.example.com'], plan: 'business', agreed_monthly_price: 129, pages: physioPages, destinations: physioDest, recipient_name: 'Sam Patel', recipient_email: 'frontdesk@example.com', care_terms_version: 'care-flex-2026-11', care_terms_note: 'Signed the current care agreement (demo)', care_terms_reviewed_at: at(-30), next_review_due: at(3), created_at: at(-100) }),
      site({ id: S.bakery, client_id: C.bakery, label: 'Harbor Street Bakery', site_url: 'https://bakery.example.com/', approved_domains: ['bakery.example.com'], plan: 'premium', agreed_monthly_price: 239, pages: [{ label: 'Home', url: 'https://bakery.example.com/' }, { label: 'Menu', url: 'https://bakery.example.com/menu' }], destinations: [{ label: 'Order online', url: 'https://orders.example.com/harbor', kind: 'checkout' }], recipient_name: 'Jordan Reyes', recipient_email: 'owner@example.com', care_terms_version: 'care-2026-06', care_terms_note: 'Original care agreement (demo)', next_review_due: at(-1), created_at: at(-190) }),
      site({ id: S.dental, client_id: C.dental, label: 'Lakeside Dental', site_url: 'https://dental.example.com/', approved_domains: ['dental.example.com'], plan: 'premium', agreed_monthly_price: 249, pages: dentalPages, destinations: [], recipient_name: 'Avery Kim', recipient_email: 'office@example.com', care_terms_version: 'care-flex-2026-11', care_terms_note: 'Signed at launch (demo)', care_terms_reviewed_at: at(-55), next_review_due: at(8), created_at: at(-58),
        stripe_customer_id: 'cus_demo_000203', stripe_subscription_id: 'sub_demo_000203', subscription_status: 'active', billing_state: 'active', stripe_synced_at: at(-1),
        current_period_start: startOfDay(-1), current_period_end: startOfDay(29), paid_through: startOfDay(29) }),
    ],
    // The simulated Stripe's side of Lakeside Dental's subscription, so the practice scenarios can renew, fail, or cancel it.
    demo_stripe: seedSubscription({ siteId: S.dental, clientId: C.dental, plan: 'premium', customer: 'cus_demo_000203', sub: 'sub_demo_000203', invoice: 'in_demo_000203_first', start: Math.floor(Date.parse(startOfDay(-1)) / 1000), end: Math.floor(Date.parse(startOfDay(29)) / 1000) }),
    care_cycles: [
      { id: Y.physio, site_id: S.physio, source: 'manual', period_start: startOfDay(-4), period_end: startOfDay(26), plan: 'business', review_due_at: at(3), included_minutes: 30, agreed_price: 129, paid_at: at(-4), scan_state: 'queued' },
      { id: Y.bakery, site_id: S.bakery, source: 'manual', period_start: startOfDay(-10), period_end: startOfDay(20), plan: 'premium', review_due_at: at(-1), included_minutes: 90, agreed_price: 239, paid_at: at(-10), scan_state: 'queued' },
      { id: Y.dental, site_id: S.dental, source: 'stripe', stripe_invoice_id: 'in_demo_000203_first', stripe_subscription_id: 'sub_demo_000203', amount_paid: 24900, currency: 'usd', period_start: startOfDay(-1), period_end: startOfDay(29), plan: 'premium', review_due_at: at(8), included_minutes: 90, agreed_price: 249, paid_at: at(-1), scan_state: 'not_started' },
    ],
    care_scan_runs: [
      { id: id(321), cycle_id: Y.physio, site_id: S.physio, trigger: 'scheduled', status: 'queued', config: { pages: physioPages, destinations: physioDest }, available_at: at(-1) },
      { id: id(322), cycle_id: Y.bakery, site_id: S.bakery, trigger: 'scheduled', status: 'queued', config: { pages: [{ label: 'Home', url: 'https://bakery.example.com/' }, { label: 'Menu', url: 'https://bakery.example.com/menu' }], destinations: [{ label: 'Order online', url: 'https://orders.example.com/harbor', kind: 'checkout' }] }, available_at: at(-1) },
    ],
    care_reports: [
      { cycle_id: Y.physio, content: { summary: 'One issue needs your approval: the team page doesn’t fit phone screens.' } },
      { cycle_id: Y.bakery, content: {} },
      { cycle_id: Y.dental, content: {} },
    ],
    care_manual_results: [
      { cycle_id: Y.physio, item_id: 'visual', label: 'Desktop appearance looks right', category: 'Visual', status: 'passed', note: 'Checked on a laptop.', confirmed_at: at(-1) },
    ],
    care_issue_notes: [
      { cycle_id: Y.physio, group_key: 'overflow:overflow', resolution: 'approval', client_note: 'the team section rebuild (estimate below)' },
    ],
    care_estimates: [
      { id: DEMO_IDS.estimates.physioTeam, site_id: S.physio, cycle_id: Y.physio, title: 'Team section rebuild', scope: 'Rebuild the team section so the photos and bios resize on phones.', deliverables: 'A responsive team section, tested on desktop and phone.', schedule: 'Within a week of approval', standard_minutes: 82, included_minutes: 17, additional_price_cents: 11000, price_explanation: 'A fixed quote for the work beyond your included time.', status: 'draft' },
    ],
  }
}

/** Presets left as proposals so confirming one can be tried; the rest start confirmed. */
export const UNCONFIRMED_PRESETS = ['link-change', 'price-update']

/** What the simulated check runner reports for each agreed page and destination. */
export function simulatedFindings(config: { pages?: { url: string }[]; destinations?: { url: string; kind?: string }[] }) {
  const out: Record<string, unknown>[] = []
  const now = new Date().toISOString()
  for (const [i, p] of (config.pages || []).entries()) {
    for (const k of ['page_load', 'https', 'images']) out.push({ check_key: k, code: 'ok', url: p.url, viewport: 'desktop', status: 'passed', observed: 'Simulated check: passed.', explanation: 'Simulated in the demo.', checked_at: now, evidence: { http_status: 200, load_ms: 900 } })
    // The second agreed page is always reported too wide for phones, so every demo review has an issue to handle.
    const wide = i === 1
    out.push(wide
      ? { check_key: 'overflow', code: 'overflow', url: p.url, viewport: 'mobile', status: 'failed', observed: 'The page is 212 pixels wider than a phone screen (simulated).', explanation: 'Part of the page is cut off on phones.', next_action: 'Rebuild the section so it fits phone screens.', checked_at: now, evidence: { overflow_px: 212 } }
      : { check_key: 'overflow', code: 'ok', url: p.url, viewport: 'mobile', status: 'passed', observed: 'Simulated check: fits the screen.', explanation: 'Simulated in the demo.', checked_at: now })
  }
  if (config.pages?.[0]) out.push({ check_key: 'internal_links', code: 'ok', url: config.pages[0].url, status: 'passed', observed: 'Simulated check: links work.', explanation: 'Simulated in the demo.', checked_at: now })
  for (const d of config.destinations || []) {
    out.push(d.kind === 'booking'
      ? { check_key: 'destination', code: 'blocked_by_site', url: d.url, viewport: 'desktop', status: 'could_not_check', observed: 'The booking service showed a robot check page (simulated).', explanation: 'Blocking automated checkers is common.', checked_at: now, evidence: { http_status: 403 } }
      : { check_key: 'destination', code: 'ok', url: d.url, viewport: 'desktop', status: 'passed', observed: 'Simulated check: page opens.', explanation: 'Simulated in the demo.', checked_at: now, evidence: { http_status: 200 } })
  }
  return out
}
