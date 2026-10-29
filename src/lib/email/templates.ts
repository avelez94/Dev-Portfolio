/**
 * Every email this application sends, in one place, on the shared branded layout.
 * Facts, amounts, terms, and links are passed in by the routes; payment and
 * terms wording comes from src/lib/terms.ts so document versions stay intact.
 * Copy rule: no dashes in client facing text.
 */
import { BRAND } from '@/lib/brand'
import { esc, escLines, renderEmail, usd, type Block } from './layout'
import { formatDue, money, type Milestone } from '@/lib/payment-schedule'

export type Email = { subject: string; html: string; text: string }

const first = (name: string) => String(name || '').trim().split(/\s+/)[0] || 'there'
const oneLine = (s: unknown) => String(s ?? '').replace(/[\r\n]+/g, ' ').trim()
const done = (subject: string, r: { html: string; text: string }): Email => ({ subject: oneLine(subject), ...r })
const val = (v: unknown, fallback = 'Not provided') => (v === null || v === undefined || String(v).trim() === '' ? esc(fallback) : escLines(v))

/* ================================================================== */
/* Intake and discovery calls                                          */
/* ================================================================== */

export function inquiryReceived(p: { name: string; continueUrl: string }): Email {
  return done(
    'Got your note. Here’s an optional next step.',
    renderEmail({
      preheader: 'Your note is saved. Share your project details whenever you’re ready.',
      eyebrow: 'Note received',
      title: 'Thanks for reaching out,',
      titleAccent: `${first(p.name)}.`,
      blocks: [
        { type: 'p', html: 'Your note came through and it’s saved. I’ll read it and reply by email, so if that’s all you need, you’re all set.' },
        {
          type: 'p',
          html: 'If you’d like to move faster, the project questionnaire takes about five minutes. It covers your goals, content, features, and timing, and when you finish you can book a short discovery call right away.',
        },
        { type: 'buttons', items: [{ label: 'Complete My Project Details', href: p.continueUrl }] },
        { type: 'note', html: 'I already have what you sent, so you’ll see it filled in and can edit anything.' },
      ],
    })
  )
}

export function detailsReceived(p: { name: string; bookingUrl: string }): Email {
  return done(
    'Project details received. Pick a time for your discovery call.',
    renderEmail({
      preheader: 'Your project details are saved. Choose a time for a 20 minute discovery call.',
      eyebrow: 'Project details received',
      title: 'Got your',
      titleAccent: 'details.',
      blocks: [
        { type: 'p', html: `Hi ${esc(first(p.name))}, your project details came through and I have everything I need to prepare for our conversation.` },
        {
          type: 'p',
          html: 'Your next step is a <strong>20 minute discovery call</strong> on Zoom. We’ll talk through your goals, confirm scope and timing, and make sure we’re a good fit. I’ll have read your answers before we meet.',
        },
        { type: 'buttons', items: [{ label: 'Choose a Call Time', href: p.bookingUrl }] },
        { type: 'note', html: 'Already booked? You can ignore this. Your confirmation has the Zoom link.' },
      ],
    })
  )
}

type LeadFields = {
  name: string
  email: string
  business?: string | null
  type: string
  description: string
  budget?: string | null
  timeline?: string | null
  heard?: string | null
  priority?: string | null
  notes?: string | null
}

const DETAIL_LABELS: Record<string, string> = {
  website: 'Current website',
  existing: 'Has a website now',
  platform: 'Site platform',
  assets: 'Assets ready',
  integrations: 'Integrations needed',
  references: 'Sites they like',
  interest: 'Interest selected on site',
}

function leadRows(l: LeadFields, details?: Record<string, unknown> | null): [string, string][] {
  const rows: [string, string][] = [
    ['Name', esc(l.name)],
    ['Email', `<a href="mailto:${esc(l.email)}">${esc(l.email)}</a>`],
    ['Business', val(l.business)],
    ['Looking for', val(l.type)],
    ['Project description', val(l.description)],
    ['Budget', val(l.budget)],
    ['Timeline', val(l.timeline)],
  ]
  if (l.heard) rows.push(['How they found you', val(l.heard)])
  if (l.priority) rows.push(['What matters most', val(l.priority)])
  for (const [k, label] of Object.entries(DETAIL_LABELS)) {
    const v = details?.[k]
    if (v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)) continue
    rows.push([label, Array.isArray(v) ? esc(v.join(', ')) : escLines(v)])
  }
  if (l.notes) rows.push(['Anything else', val(l.notes)])
  return rows
}

export function inquiryAdmin(p: LeadFields & { website?: string | null; adminUrl: string }): Email {
  return done(
    `New note from ${p.name}`,
    renderEmail({
      audience: 'admin',
      preheader: `${p.name} sent a short note about ${p.type}.`,
      eyebrow: 'Short inquiry received',
      title: 'New note from',
      titleAccent: `${p.name}.`,
      blocks: [
        { type: 'p', html: 'They’ve been invited to complete the project questionnaire, which leads to booking a call. Reply directly to this email to answer them.' },
        { type: 'details', rows: leadRows({ ...p, heard: null }, p.website ? { website: p.website } : null) },
        { type: 'buttons', items: [{ label: 'Open Admin Dashboard', href: p.adminUrl }], fallbackLink: false },
      ],
    })
  )
}

export function detailsAdmin(
  p: LeadFields & {
    details?: Record<string, unknown> | null
    adminUrl: string
    /** Set when this questionnaire completed an earlier short note. */
    continuedFrom?: { note: string; sentAt: string } | null
    /** Set when the same address sent a note earlier but this questionnaire didn't use its link. Unverified, admin only. */
    relatedNote?: { note: string; sentAt: string } | null
  }
): Email {
  const continued = !!p.continuedFrom
  const blocks: Block[] = [
    {
      type: 'p',
      html: continued
        ? 'They completed the questionnaire from the link in their confirmation email. This updates their existing lead, so there’s no second lead to merge. No call is booked yet.'
        : 'They filled in the full questionnaire. No call is booked yet. You’ll get another note when they choose a time.',
    },
  ]
  const earlier = p.continuedFrom || p.relatedNote
  if (earlier) {
    blocks.push({
      type: 'callout',
      tone: 'coral',
      title: continued ? `Their original note, ${earlier.sentAt}` : `Same email sent a short note, ${earlier.sentAt}`,
      html: continued
        ? escLines(earlier.note)
        : `${escLines(earlier.note)}<br><br><em>Not verified: this questionnaire didn’t use their private link, so both are kept as separate leads. Confirm with them before treating these as the same person.</em>`,
    })
  }
  blocks.push({ type: 'details', title: 'Project details', rows: leadRows(p, p.details) })
  blocks.push({ type: 'buttons', items: [{ label: 'Open Admin Dashboard', href: p.adminUrl }], fallbackLink: false })
  return done(
    continued ? `Project details completed by ${p.name}` : `New project questionnaire from ${p.name}`,
    renderEmail({
      audience: 'admin',
      preheader: `${p.name} completed their project details.`,
      eyebrow: 'Detailed intake completed',
      title: continued ? 'Details completed by' : 'New questionnaire from',
      titleAccent: `${p.name}.`,
      blocks,
    })
  )
}

export function callConfirmed(p: { name: string; date: string; time: string; joinUrl: string }): Email {
  return done(
    `Your discovery call is confirmed for ${p.date}`,
    renderEmail({
      preheader: `${p.date} at ${p.time}. Your Zoom link is inside.`,
      eyebrow: 'Discovery call booked',
      title: 'Call',
      titleAccent: 'confirmed.',
      blocks: [
        { type: 'p', html: `Hi ${esc(first(p.name))}, your discovery call is booked. I’ll have reviewed your project details before we get on the call, so we can get straight to it.` },
        {
          type: 'details',
          rows: [
            ['Date', esc(p.date)],
            ['Time', esc(p.time)],
            ['Duration', '20 minutes'],
            ['Format', 'Zoom video call'],
          ],
        },
        { type: 'buttons', items: [{ label: 'Join Zoom Call', href: p.joinUrl }] },
        { type: 'p', html: 'Have any references, logins you’re comfortable discussing, or questions ready. Need a different time? Just reply to this email.' },
      ],
    })
  )
}

export function callAdmin(p: LeadFields & { date: string; time: string; hostUrl: string; joinUrl: string; details?: Record<string, unknown> | null; adminUrl: string }): Email {
  return done(
    `Discovery call booked with ${p.name} on ${p.date}`,
    renderEmail({
      audience: 'admin',
      preheader: `${p.date} at ${p.time}`,
      eyebrow: 'Discovery call booked',
      title: 'Call booked with',
      titleAccent: `${p.name}.`,
      blocks: [
        {
          type: 'details',
          title: 'The call',
          rows: [
            ['Date and time', `${esc(p.date)} at ${esc(p.time)}`],
            ['Zoom host link', `<a href="${esc(p.hostUrl)}">Start the meeting</a>`],
            ['Client join link', `<a href="${esc(p.joinUrl)}">${esc(p.joinUrl)}</a>`],
          ],
        },
        { type: 'p', html: 'Review their answers below before the call.' },
        { type: 'details', title: 'Project details', rows: leadRows(p, p.details) },
        { type: 'buttons', items: [{ label: 'Start Zoom as Host', href: p.hostUrl }, { label: 'Open Admin', href: p.adminUrl, variant: 'secondary' }], fallbackLink: false },
      ],
    })
  )
}

export function callReminder(p: { name: string; date: string; time: string; joinUrl: string }): Email {
  return done(
    'Reminder: your discovery call is coming up',
    renderEmail({
      preheader: `${p.date} at ${p.time}. Here’s your Zoom link.`,
      eyebrow: 'Call reminder',
      title: 'See you',
      titleAccent: 'soon.',
      blocks: [
        { type: 'p', html: `Hi ${esc(first(p.name))}, just a reminder that your discovery call is coming up. I’ve reviewed your project details and I’m ready to dive in.` },
        {
          type: 'details',
          rows: [
            ['Date', esc(p.date)],
            ['Time', esc(p.time)],
            ['Duration', '20 minutes'],
          ],
        },
        { type: 'buttons', items: [{ label: 'Join Zoom Call', href: p.joinUrl }] },
        { type: 'p', html: 'If you need to reschedule, just reply to this email.' },
      ],
    })
  )
}

export function meetingScheduled(p: { name: string; title: string; date: string; time: string; joinUrl: string }): Email {
  return done(
    `Meeting scheduled for ${p.date}`,
    renderEmail({
      preheader: `${p.title}, ${p.date} at ${p.time}`,
      eyebrow: 'Project meeting',
      title: 'Meeting',
      titleAccent: 'scheduled.',
      blocks: [
        { type: 'p', html: `Hi ${esc(first(p.name))}, a project meeting is on the calendar. Here are the details and your Zoom link.` },
        {
          type: 'details',
          rows: [
            ['Meeting', esc(p.title)],
            ['Date', esc(p.date)],
            ['Time', esc(p.time)],
            ['Duration', '30 minutes'],
          ],
        },
        { type: 'buttons', items: [{ label: 'Join Zoom Meeting', href: p.joinUrl }] },
      ],
    })
  )
}

/* ================================================================== */
/* Proposals and statements of work                                    */
/* ================================================================== */

export function proposalSent(p: { clientName: string; projectTitle: string; message?: string | null; url: string }): Email {
  return done(
    `Your project proposal: ${p.projectTitle}`,
    renderEmail({
      preheader: `Your proposal for ${p.projectTitle} is ready to review.`,
      eyebrow: 'Proposal ready',
      title: 'Your proposal is',
      titleAccent: 'ready.',
      blocks: [
        { type: 'p', html: p.message ? escLines(p.message) : `Hi ${esc(p.clientName)}, your project proposal for <strong>${esc(p.projectTitle)}</strong> is ready for your review.` },
        { type: 'p', html: 'It covers what I understood about your project, the scope, the investment, and the payment schedule. You can accept or decline right from the page.' },
        { type: 'buttons', items: [{ label: 'Review Your Proposal', href: p.url }] },
      ],
    })
  )
}

type ProposalLike = {
  client_name: string
  client_email: string
  client_business?: string | null
  project_title: string
  project_type: string
  understood?: string | null
  line_items?: { description: string; price: string | number }[]
  total: number
  timeline?: string | null
  out_of_scope?: string | null
  payment_method?: string | null
  next_steps?: string | null
  responded_at?: string | null
}

export function proposalAcceptedClient(p: { proposal: ProposalLike }): Email {
  return done(
    `Proposal accepted: next steps for ${p.proposal.project_title}`,
    renderEmail({
      preheader: 'Thank you! Your contract is on its way.',
      eyebrow: 'Proposal accepted',
      title: 'Thank you,',
      titleAccent: `${first(p.proposal.client_name)}.`,
      blocks: [
        { type: 'p', html: `Thank you for accepting the proposal for <strong>${esc(p.proposal.project_title)}</strong>.` },
        { type: 'p', html: 'Your contract will arrive shortly for your review and signature. Once it’s signed, your deposit invoice will follow to officially kick off the project.' },
        { type: 'note', html: 'A full copy of your accepted proposal is in a separate email for your records.' },
      ],
    })
  )
}

/** Copy of the accepted proposal. Payment lines come from terms.ts so issued wording stays intact. */
export function proposalCopy(p: { proposal: ProposalLike; paymentTitle: string; paymentLines: string[] }): Email {
  const pr = p.proposal
  const items = (pr.line_items || []).map((i) => [esc(i.description), usd(i.price)] as [string, string])
  const blocks: Block[] = [
    {
      type: 'details',
      rows: [
        ['Client', [pr.client_name, pr.client_email, pr.client_business].filter(Boolean).map(esc).join('<br>')],
        ['Project', `${esc(pr.project_title)} &middot; ${esc(pr.project_type)}`],
        ...(pr.responded_at ? ([['Accepted', esc(new Date(pr.responded_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }))]] as [string, string][]) : []),
      ],
    },
  ]
  if (pr.understood) blocks.push({ type: 'callout', title: 'What I understood', html: escLines(pr.understood) })
  blocks.push({ type: 'p', html: '<strong style="color:#2A1F1B;">Scope of work</strong>' })
  blocks.push({ type: 'lineItems', rows: items, total: ['Total', usd(pr.total)] })
  blocks.push({ type: 'callout', title: p.paymentTitle, html: p.paymentLines.map(esc).join('<br>') })
  const extra: [string, string][] = []
  if (pr.timeline) extra.push(['Timeline', escLines(pr.timeline)])
  if (pr.out_of_scope) extra.push(['Out of scope', escLines(pr.out_of_scope)])
  if (pr.payment_method) extra.push(['Payment', escLines(pr.payment_method)])
  if (pr.next_steps) extra.push(['Next steps', escLines(pr.next_steps)])
  if (extra.length) blocks.push({ type: 'details', rows: extra })
  return done(
    `Your proposal: ${pr.project_title}`,
    renderEmail({ preheader: `Accepted proposal for ${pr.project_title}, for your records.`, eyebrow: 'Accepted proposal copy', title: pr.project_title, blocks })
  )
}

export function responseAdmin(p: {
  kind: 'Proposal' | 'SOW'
  action: string
  clientName: string
  clientEmail?: string | null
  projectTitle: string
  total: number
  declineReason?: string | null
  adminUrl: string
}): Email {
  const accepted = p.action === 'accepted'
  return done(
    `${p.kind} ${p.action}: ${p.clientName}`,
    renderEmail({
      audience: 'admin',
      preheader: `${p.clientName} ${p.action} the ${p.kind.toLowerCase()} for ${p.projectTitle}.`,
      eyebrow: `${p.kind} ${p.action}`,
      title: `${p.kind} ${p.action} by`,
      titleAccent: `${p.clientName}.`,
      blocks: [
        {
          type: 'details',
          rows: [
            ['Client', `${esc(p.clientName)}${p.clientEmail ? ` &middot; ${esc(p.clientEmail)}` : ''}`],
            ['Project', esc(p.projectTitle)],
            ['Total', usd(p.total)],
            ...(p.declineReason ? ([['Decline reason', escLines(p.declineReason)]] as [string, string][]) : []),
          ],
        },
        ...(accepted ? ([{ type: 'callout', title: 'Next step', html: 'Send the contract next.' }] as Block[]) : []),
        { type: 'buttons', items: [{ label: 'Open Admin Dashboard', href: p.adminUrl }], fallbackLink: false },
      ],
    })
  )
}

export function sowSent(p: { clientName: string; projectTitle: string; url: string }): Email {
  return done(
    `Statement of Work: ${p.projectTitle}`,
    renderEmail({
      preheader: `Your Statement of Work for ${p.projectTitle} is ready.`,
      eyebrow: 'Statement of Work',
      title: 'Your Statement',
      titleAccent: 'of Work.',
      blocks: [
        { type: 'p', html: `Hi ${esc(p.clientName)}, your Statement of Work for <strong>${esc(p.projectTitle)}</strong> is ready for your review.` },
        { type: 'p', html: 'Please review the full scope, deliverables, milestone schedule, and payment details. You can accept or decline directly from the page.' },
        { type: 'buttons', items: [{ label: 'Review Statement of Work', href: p.url }] },
      ],
    })
  )
}

export function sowAcceptedClient(p: { clientName: string; projectTitle: string }): Email {
  return done(
    `Statement of Work accepted: ${p.projectTitle}`,
    renderEmail({
      preheader: 'Thank you! Your contract is on its way.',
      eyebrow: 'Statement of Work accepted',
      title: 'Thank you,',
      titleAccent: `${first(p.clientName)}.`,
      blocks: [
        { type: 'p', html: `Thank you for accepting the Statement of Work for <strong>${esc(p.projectTitle)}</strong>.` },
        { type: 'p', html: 'Your contract will arrive shortly for your review and signature. Once it’s signed, your deposit invoice will follow to officially kick off the project.' },
      ],
    })
  )
}

/* ================================================================== */
/* Contracts                                                           */
/* ================================================================== */

/** schedule: the milestones for the remaining 50%, on documents issued under the current terms. */
type Money = { totalFee: number; deposit: number; balance: number; depositLabel: string; balanceLabel: string; schedule?: Milestone[] }

const milestoneRows = (schedule: Milestone[] | undefined): [string, string][] =>
  (schedule || []).map((m, i) => [`Milestone ${i + 1}: ${esc(m.name)}`, `${money(m.fee)}<br><span style="color:#5C4A42;">${escLines(m.deliverables)}${m.dueDate ? `<br>Target ${esc(formatDue(m.dueDate))}` : ''}</span>`])

const moneyRows = (m: Money): [string, string][] => [
  ['Total fee', m.schedule ? money(m.totalFee) : usd(m.totalFee)],
  [m.depositLabel, m.schedule ? money(m.deposit) : usd(m.deposit)],
  [m.balanceLabel, m.schedule ? money(m.balance) : usd(m.balance)],
  ...milestoneRows(m.schedule),
]

export function contractReady(p: Money & { clientName: string; projectTitle: string; url: string }): Email {
  return done(
    `Contract ready for signature: ${p.projectTitle}`,
    renderEmail({
      preheader: `Your contract for ${p.projectTitle} is ready to review and sign.`,
      eyebrow: 'Contract ready',
      title: 'Your contract',
      titleAccent: 'is ready.',
      blocks: [
        { type: 'p', html: `Hi ${esc(p.clientName)}, your contract for <strong>${esc(p.projectTitle)}</strong> is ready for your review and signature.` },
        { type: 'p', html: 'Please review all terms carefully. You’ll draw your signature directly on the page. Once signed, your deposit invoice is sent automatically.' },
        { type: 'details', rows: [['Project', esc(p.projectTitle)], ...moneyRows(p)] },
        { type: 'buttons', items: [{ label: 'Review and Sign Contract', href: p.url }] },
      ],
    })
  )
}

export function contractSignedClient(p: Money & { clientName: string; projectTitle: string; signerName: string; signedDate: string }): Email {
  return done(
    `Contract signed: ${p.projectTitle}`,
    renderEmail({
      preheader: 'Your contract is signed. Here’s a summary for your records.',
      eyebrow: 'Contract signed',
      title: 'Contract',
      titleAccent: 'signed.',
      blocks: [
        { type: 'p', html: `Hi ${esc(p.clientName)}, your contract for <strong>${esc(p.projectTitle)}</strong> has been signed. Here’s a summary for your records.` },
        {
          type: 'details',
          rows: [['Project', esc(p.projectTitle)], ['Signed by', esc(p.signerName)], ['Signed on', esc(p.signedDate)], ...moneyRows(p)],
        },
        { type: 'p', html: 'Your deposit invoice is in a separate email. Once payment is received, the project officially begins.' },
      ],
    })
  )
}

export function contractSignedAdmin(p: {
  clientName: string
  projectTitle: string
  signerName: string
  signedDate: string
  ip: string
  totalFee: number
  deposit: number
  invoiceNumber?: string | null
  adminUrl: string
}): Email {
  return done(
    `Contract signed: ${p.clientName}`,
    renderEmail({
      audience: 'admin',
      preheader: `${p.signerName} signed the contract for ${p.projectTitle}.`,
      eyebrow: 'Contract signed',
      title: 'Contract signed by',
      titleAccent: `${p.clientName}.`,
      blocks: [
        {
          type: 'details',
          rows: [
            ['Project', esc(p.projectTitle)],
            ['Signed by', esc(p.signerName)],
            ['Signed on', esc(p.signedDate)],
            ['IP address', esc(p.ip)],
            ['Total fee', usd(p.totalFee)],
            ['Deposit due', usd(p.deposit)],
            ...(p.invoiceNumber ? ([['Invoice', esc(p.invoiceNumber)]] as [string, string][]) : []),
          ],
        },
        { type: 'callout', title: 'Next step', html: 'The deposit invoice was sent to the client automatically.' },
        { type: 'buttons', items: [{ label: 'Open Admin Dashboard', href: p.adminUrl }], fallbackLink: false },
      ],
    })
  )
}

export function depositInvoice(p: {
  clientName: string
  projectTitle: string
  invoiceNumber: string
  serviceDesc: string
  dueDate: string
  totalFee: number
  deposit: number
  balance: number
  depositLabel: string
  balanceLabel: string
  paymentMethod: string
  schedule?: Milestone[]
}): Email {
  return done(
    `Invoice ${p.invoiceNumber}: ${p.projectTitle}`,
    renderEmail({
      preheader: `Deposit invoice for ${p.projectTitle}. Due ${p.dueDate}.`,
      eyebrow: 'Deposit invoice',
      title: 'Invoice',
      titleAccent: `#${p.invoiceNumber}`,
      blocks: [
        { type: 'p', html: `Hi ${esc(p.clientName)}, here’s your deposit invoice. Payment is due within 7 days to officially kick off the project.` },
        {
          type: 'details',
          rows: [
            ['Service', esc(p.serviceDesc)],
            ['Due date', esc(p.dueDate)],
            ['Total project fee', usd(p.totalFee)],
            [p.depositLabel, `<strong style="font-size:20px;color:#B33A26;">${p.schedule ? money(p.deposit) : usd(p.deposit)}</strong>`],
            [p.balanceLabel, p.schedule ? money(p.balance) : usd(p.balance)],
            ...milestoneRows(p.schedule),
          ],
        },
        ...(p.schedule ? ([{ type: 'note', html: 'Each milestone is invoiced separately when it’s reached. Nothing is charged automatically.' }] as Block[]) : []),
        { type: 'callout', title: 'How to pay', html: `${escLines(p.paymentMethod)}<br>Reference: Invoice #${esc(p.invoiceNumber)} | ${esc(p.clientName)}` },
        { type: 'note', html: 'Work begins once the deposit is received.' },
      ],
    })
  )
}

export function signedContractCopy(p: { clientName: string; projectTitle: string; signerName: string; signedDate: string }): Email {
  return done(
    `Signed contract: ${p.projectTitle}`,
    renderEmail({
      preheader: 'Your signed contract is attached for your records.',
      eyebrow: 'Signed contract',
      title: 'Signed contract',
      titleAccent: 'attached.',
      blocks: [
        { type: 'p', html: `Hi ${esc(p.clientName)}, your signed contract for <strong>${esc(p.projectTitle)}</strong> is attached to this email. Keep it for your records.` },
        { type: 'details', rows: [['Signed by', esc(p.signerName)], ['Date', esc(p.signedDate)]] },
      ],
    })
  )
}

/* ================================================================== */
/* Invoices and messages                                               */
/* ================================================================== */

export function invoice(p: {
  clientName: string
  invoiceNumber: string
  invoiceType: string
  totalFee: number
  depositAmount: number
  dueDate?: string | null
  serviceDesc?: string | null
  hours?: number | string | null
  hourlyRate?: number | string | null
}): Email {
  const isProject = p.invoiceType === 'project'
  const balance = Number(p.totalFee || 0) - Number(p.depositAmount || 0)
  const hourly = p.invoiceType === 'revision' || (p.hours !== undefined && p.hours !== null && Number(p.hours) > 0)
  const payRows: [string, string][] = isProject
    ? [
        ['Total project fee', usd(p.totalFee)],
        ['Deposit due now (50%)', `<strong style="font-size:20px;color:#B33A26;">${usd(p.depositAmount)}</strong>`],
        ['Balance due on delivery (50%)', usd(balance)],
      ]
    : hourly
      ? [
          ['Hours', `${esc(p.hours)}h x $${esc(p.hourlyRate)}/hr`],
          ['Total due', `<strong style="font-size:20px;color:#B33A26;">${usd(p.totalFee)}</strong>`],
        ]
      : [['Amount due', `<strong style="font-size:20px;color:#B33A26;">${money(Number(p.totalFee) || 0)}</strong>`]]
  return done(
    `Invoice #${p.invoiceNumber} from ${BRAND.name}`,
    renderEmail({
      preheader: `Invoice #${p.invoiceNumber}. Payment is due within 7 days.`,
      eyebrow: 'Invoice',
      title: 'Invoice',
      titleAccent: `#${p.invoiceNumber}`,
      blocks: [
        { type: 'p', html: `Hi ${esc(p.clientName)}, here are your invoice details. Payment is due within 7 days.` },
        { type: 'details', rows: [['Service', val(p.serviceDesc, 'Web development services')], ['Due date', val(p.dueDate, 'Upon receipt')], ...payRows] },
        { type: 'callout', title: 'How to pay', html: `Stripe, PayPal, Zelle, or Wise<br>Reference: Invoice #${esc(p.invoiceNumber)} | ${esc(p.clientName)}` },
        ...(isProject ? ([{ type: 'note', html: 'Final deliverables will be transferred upon receipt of the balance payment.' }] as Block[]) : []),
      ],
    })
  )
}

/** Free form message written in the admin portal. Their words are kept as written. */
export function message(p: { subject: string; message: string }): Email {
  return done(
    p.subject,
    renderEmail({
      preheader: oneLine(p.message).slice(0, 110),
      title: oneLine(p.subject),
      blocks: [{ type: 'p', html: escLines(p.message) }],
    })
  )
}
