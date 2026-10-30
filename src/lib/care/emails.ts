/**
 * Website Care emails on the shared branded layout. Owner notices use the
 * admin audience; the client report email uses the light client brand.
 * Copy rule: no dashes in client facing text.
 */
import { esc, escLines, renderEmail } from '@/lib/email/layout'
import { COLORS as C, FONTS } from '@/lib/brand'
import { STATE_LABEL, TONE, nextStepLines, normalizePlanBox, planFacts, type Snapshot, type RowState } from './report-model'

export type Email = { subject: string; html: string; text: string }
const oneLine = (s: unknown) => String(s ?? '').replace(/[\r\n]+/g, ' ').trim()

type ScanNotice = {
  client: string
  site: string
  siteUrl: string
  due: string
  counts: Record<string, number>
  attention: string[]
  couldNot: string[]
  manualOpen: string[]
  link: string
  outcome: string
  error?: string | null
  attempts?: number
}

const countLine = (c: Record<string, number>) =>
  [['passed', 'passed'], ['failed', 'failed'], ['needs_review', 'need review'], ['could_not_check', 'could not check']]
    .filter(([k]) => c[k]).map(([k, l]) => `${c[k]} ${l}`).join(', ') || 'no results recorded'

const list = (items: string[], max = 8) => (items.length ? items.slice(0, max).map((i) => `• ${esc(i)}`).join('<br>') + (items.length > max ? `<br>and ${items.length - max} more` : '') : 'None')

export function scanDone(p: ScanNotice): Email {
  const subject = `Website Care: ${p.client} is ready for review (due ${p.due})`
  return {
    subject: oneLine(subject),
    ...renderEmail({
      audience: 'admin',
      preheader: `Automated checks finished for ${p.site}: ${countLine(p.counts)}.`,
      eyebrow: 'Automated checks finished',
      title: 'Time to review',
      titleAccent: `${p.client}.`,
      blocks: [
        { type: 'details', rows: [['Client', esc(p.client)], ['Website', `${esc(p.site)}<br>${esc(p.siteUrl)}`], ['Review due', esc(p.due)], ['Results', esc(countLine(p.counts))]] },
        { type: 'callout', title: 'Issues found', html: list(p.attention), tone: 'coral' },
        { type: 'p', html: `<strong>Not verified (needs review or couldn’t be checked):</strong><br>${list(p.couldNot)}` },
        { type: 'p', html: `<strong>Manual checks still open:</strong><br>${list(p.manualOpen)}` },
        { type: 'buttons', items: [{ label: 'Open Draft Report', href: p.link }], fallbackLink: true },
        { type: 'note', html: 'The link opens your admin dashboard and asks you to sign in if needed. Nothing has been sent to the client.' },
      ],
    }),
  }
}

export function scanProblem(p: ScanNotice): Email {
  const partial = p.outcome === 'partial'
  const subject = partial ? `Website Care: checks for ${p.client} only partly finished` : `Website Care: checks for ${p.client} failed`
  return {
    subject,
    ...renderEmail({
      audience: 'admin',
      preheader: partial ? 'Some checks did not finish. Review what ran and retry if needed.' : 'The automated checks did not finish. Nothing was confirmed.',
      eyebrow: partial ? 'Checks incomplete' : 'Checks failed',
      title: partial ? 'Checks only partly finished for' : 'Checks did not finish for',
      titleAccent: `${p.client}.`,
      blocks: [
        { type: 'details', rows: [['Client', esc(p.client)], ['Website', `${esc(p.site)}<br>${esc(p.siteUrl)}`], ['Review due', esc(p.due)], ['What happened', esc(p.error || 'No error message was recorded.')], ['Attempts', String(p.attempts ?? 1)]] },
        { type: 'p', html: partial ? 'The results that did come back are in the draft. Items that did not run are listed as could not check.' : 'A failed check never counts as a completed review or a healthy website. The review task is still open.' },
        { type: 'p', html: '<strong>What to do:</strong> open the review, read the error, and choose Retry check. If the site blocks automated visitors, check it by hand and note that in the report.' },
        { type: 'buttons', items: [{ label: 'Open Review', href: p.link }], fallbackLink: true },
      ],
    }),
  }
}

export function reviewReminder(p: { client: string; site: string; due: string; link: string; overdue: boolean; manualOpen: string[]; reportStatus: string }): Email {
  const subject = p.overdue ? `Overdue: Website Care review for ${p.client} (was due ${p.due})` : `Reminder: Website Care review for ${p.client} is due ${p.due}`
  return {
    subject,
    ...renderEmail({
      audience: 'admin',
      preheader: p.overdue ? 'This review is past its due date.' : 'This review is coming up.',
      eyebrow: p.overdue ? 'Review overdue' : 'Review coming up',
      title: p.overdue ? 'Overdue review for' : 'Upcoming review for',
      titleAccent: `${p.client}.`,
      blocks: [
        { type: 'details', rows: [['Website', esc(p.site)], ['Due', esc(p.due)], ['Report status', esc(p.reportStatus)]] },
        { type: 'p', html: `<strong>Manual checks still open:</strong><br>${list(p.manualOpen)}` },
        { type: 'buttons', items: [{ label: 'Open Review', href: p.link }], fallbackLink: true },
      ],
    }),
  }
}

export function billingAttention(p: { client: string; site: string; state: string; detail: string; link: string }): Email {
  return {
    subject: `Website Care billing: ${p.client} needs attention`,
    ...renderEmail({
      audience: 'admin',
      preheader: p.detail,
      eyebrow: 'Billing attention',
      title: 'Billing needs a look for',
      titleAccent: `${p.client}.`,
      blocks: [
        { type: 'details', rows: [['Website', esc(p.site)], ['Status', esc(p.state)], ['What happened', esc(p.detail)]] },
        { type: 'p', html: 'Nothing changes automatically for the client. Decide how to handle it using your approved billing policy.' },
        { type: 'buttons', items: [{ label: 'Open Website Care', href: p.link }], fallbackLink: true },
      ],
    }),
  }
}

/** The client's persistent private link to read and sign their care agreement. */
export function agreementLink(p: { name: string; siteLabel: string; siteUrl: string; planName: string; amount: string; includedMinutes: number; link: string; version: string; queuedLine: string; replaced?: boolean; signed?: boolean }): Email {
  const first = String(p.name || '').trim().split(/\s+/)[0] || 'there'
  if (p.signed) {
    return {
      subject: oneLine(`Your new Website Care link for ${p.siteLabel}`),
      ...renderEmail({
        audience: 'client',
        preheader: 'Your signed agreement is on file. Here’s your new private link to start your plan.',
        eyebrow: 'Website Care',
        title: 'Your new private',
        titleAccent: 'care link.',
        blocks: [
          { type: 'p', html: `Hi ${esc(first)},` },
          { type: 'p', html: `I’ve replaced your private Website Care link for ${esc(p.siteLabel)}. The earlier link no longer works. Your signed agreement is still on file and nothing needs to be signed again.` },
          { type: 'details', rows: [['Website', `${esc(p.siteLabel)}<br>${esc(p.siteUrl)}`], ['Plan', esc(p.planName)], ['Monthly price', `${esc(p.amount)} a month, billed monthly in advance until you cancel`]] },
          { type: 'buttons', items: [{ label: 'Open My Agreement', href: p.link }], fallbackLink: true },
          { type: 'note', html: `The page shows your signed agreement and lets you start your plan through Stripe. ${esc(p.queuedLine)}` },
        ],
      }),
    }
  }
  return {
    subject: oneLine(`Your Website Care agreement for ${p.siteLabel}`),
    ...renderEmail({
      audience: 'client',
      preheader: `${p.planName}, ${p.amount} a month. Read and sign your care agreement, then start your plan.`,
      eyebrow: 'Website Care',
      title: 'Your care agreement is',
      titleAccent: 'ready to sign.',
      blocks: [
        { type: 'p', html: `Hi ${esc(first)},` },
        { type: 'p', html: `Here’s your ${p.replaced ? 'new ' : ''}private link to read and sign the Website Care agreement for ${esc(p.siteLabel)}.${p.replaced ? ' The earlier link no longer works.' : ''} It lists the website and checks we agreed on, your plan and price, and the billing, cancellation and refund terms.` },
        { type: 'details', rows: [['Website', `${esc(p.siteLabel)}<br>${esc(p.siteUrl)}`], ['Plan', esc(p.planName)], ['Monthly price', `${esc(p.amount)} a month, billed monthly in advance until you cancel`], ['Included time', `${p.includedMinutes} minutes each month`], ['Agreement', `Version ${esc(p.version)}`]] },
        { type: 'buttons', items: [{ label: 'Read and Sign', href: p.link }], fallbackLink: true },
        { type: 'note', html: `Once you sign, you’ll get a signed PDF copy by email and the same page lets you start your plan through Stripe. ${esc(p.queuedLine)} This link stays the same, so you can come back to it any time.` },
      ],
    }),
  }
}

/** Sent to the client with the signed agreement PDF attached. */
export function agreementSignedClient(p: { name: string; siteLabel: string; signedDate: string; link: string; queuedLine: string; paid: boolean }): Email {
  const first = String(p.name || '').trim().split(/\s+/)[0] || 'there'
  return {
    subject: oneLine(`Your signed Website Care agreement for ${p.siteLabel}`),
    ...renderEmail({
      audience: 'client',
      preheader: 'Your signed copy is attached.',
      eyebrow: 'Website Care',
      title: 'Thanks for',
      titleAccent: 'signing.',
      blocks: [
        { type: 'p', html: `Hi ${esc(first)},<br><br>Your signed Website Care agreement for ${esc(p.siteLabel)} is attached as a PDF for your records. You signed it on ${esc(p.signedDate)}.` },
        ...(p.paid ? [] : [
          { type: 'p' as const, html: `The next step is starting your plan. ${esc(p.queuedLine)}` },
          { type: 'buttons' as const, items: [{ label: 'Continue to Payment', href: p.link }], fallbackLink: true },
        ]),
        { type: 'note', html: 'Questions? Just reply to this email.' },
      ],
    }),
  }
}

/** Owner notice that a client signed, with the same PDF attached. */
export function agreementSignedOwner(p: { client: string; site: string; signer: string; signedDate: string; version: string; ip: string; link: string; clientEmail: string }): Email {
  return {
    subject: oneLine(`Website Care: ${p.client} signed the care agreement`),
    ...renderEmail({
      audience: 'admin',
      preheader: `${p.signer} signed version ${p.version}. Payment is now unlocked for them.`,
      eyebrow: 'Agreement signed',
      title: 'Agreement signed by',
      titleAccent: `${p.client}.`,
      blocks: [
        { type: 'details', rows: [['Website', esc(p.site)], ['Signed by', esc(p.signer)], ['Signed', esc(p.signedDate)], ['Version', esc(p.version)], ['From', esc(p.ip)], ['Signed copy emailed to', esc(p.clientEmail)]] },
        { type: 'p', html: 'The signed PDF is attached and stored with the website. Payment is unlocked on the client’s agreement page; a verified payment queues the first check straight away.' },
        { type: 'buttons', items: [{ label: 'Open Website', href: p.link }], fallbackLink: true },
      ],
    }),
  }
}

export function paidReviewHeld(p: { client: string; site: string; siteUrl: string; reason: string; reasonText: string; renewal: boolean; period: string; due: string; link: string }): Email {
  return {
    subject: `Website Care: paid review for ${p.client} is on hold`,
    ...renderEmail({
      audience: 'admin',
      preheader: `${p.renewal ? 'A renewal' : 'A payment'} was received but the check can’t start: ${p.reasonText}`,
      eyebrow: 'Payment received, check on hold',
      title: 'Paid review on hold for',
      titleAccent: `${p.client}.`,
      blocks: [
        { type: 'details', rows: [['Website', `${esc(p.site)}<br>${esc(p.siteUrl)}`], ['Paid period', esc(p.period)], ['Why it’s held', esc(p.reasonText)], ['Review due', esc(p.due)]] },
        { type: 'p', html: 'The paid review is kept. Nothing was scanned, because the confirmed scope doesn’t match what’s set up now. Confirm the setup (or resume care) and the check is queued straight away. If the service can’t be provided for this period, decide how to handle it; nothing was refunded.' },
        { type: 'buttons', items: [{ label: 'Open Review', href: p.link }], fallbackLink: true },
      ],
    }),
  }
}

export function dispatchBlocked(p: { client: string; site: string; siteUrl: string; error: string; attempts: number; due: string; link: string }): Email {
  return {
    subject: `Website Care: the check for ${p.client} couldn’t be started`,
    ...renderEmail({
      audience: 'admin',
      preheader: 'The paid review is kept and its check is still queued.',
      eyebrow: 'Check not started',
      title: 'The check couldn’t start for',
      titleAccent: `${p.client}.`,
      blocks: [
        { type: 'details', rows: [['Website', `${esc(p.site)}<br>${esc(p.siteUrl)}`], ['What happened', esc(p.error)], ['Attempts', String(p.attempts)], ['Review due', esc(p.due)]] },
        { type: 'p', html: 'The paid review and its queued check are kept. The check workflow’s own schedule can still pick it up. Check the runner settings, then choose Retry start on the review.' },
        { type: 'buttons', items: [{ label: 'Open Review', href: p.link }], fallbackLink: true },
      ],
    }),
  }
}

/**
 * The client's report email: your message, then the complete approved report,
 * built from the same frozen snapshot as the attached PDF. Tables with inline
 * styles; the two column parts stack on phones. Internal notes are never in a
 * snapshot, so they can't reach this email.
 */
export function clientReport(p: { subject: string; message: string; snap: Snapshot }): Email {
  const s = p.snap
  const F = FONTS.body
  const T: string[] = [] // plain text version of the report, in the same order
  const H: string[] = []
  const sect = (title: string, state?: RowState) => {
    H.push(`<div style="margin:22px 0 8px;font-family:${F};font-size:12px;line-height:16px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:${C.teal};">${state ? `${badge(state, 16)}&nbsp; ` : ''}${esc(title)}</div>`)
    T.push('', title.toUpperCase())
  }
  const para = (html: string, text: string, size = 15) => {
    H.push(`<p style="margin:0 0 8px;font-family:${F};font-size:${size}px;line-height:${Math.round(size * 1.55)}px;color:${C.ink};">${html}</p>`)
    T.push(text)
  }

  // Header
  H.push(`<div style="font-family:${F};font-size:12px;line-height:16px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:${C.coralDeep};">Monthly health report &bull; ${esc(s.period.label)}</div>`)
  H.push(`<div style="margin:4px 0 2px;font-family:${FONTS.display};font-size:24px;line-height:30px;font-weight:700;color:${C.ink};">${esc(s.site.label)}</div>`)
  const who = [s.recipient.name, s.client.business].filter(Boolean).join(', ')
  H.push(`<div style="font-family:${F};font-size:14px;line-height:21px;color:${C.inkSoft};word-break:break-word;">${who ? `${esc(who)} &bull; ` : ''}${esc(s.site.url)}<br>Reviewed ${esc(s.review_date || 'not yet')} &bull; Checked: ${esc(s.scope.line)}</div>`)
  T.push(`MONTHLY HEALTH REPORT, ${s.period.label}`, s.site.label, `${who ? `${who}, ` : ''}${s.site.url}`, `Reviewed ${s.review_date || 'not yet'}. Checked: ${s.scope.line}`)

  // Plan and included time
  const pb = normalizePlanBox(s.plan_box)
  if (pb) {
    const b = pb
    const facts = planFacts(b)
    const cell = ([k, v]: [string, string]) =>
      `<div style="font-size:11px;line-height:15px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:${C.tealDeep};">${esc(k)}</div><div style="font-size:15px;line-height:21px;font-weight:700;color:${C.ink};">${esc(v)}</div>`
    const pairRow = (a: [string, string], c: [string, string], first: boolean) =>
      `<tr><td class="rv-stack" width="50%" valign="top" style="padding:${first ? 0 : 10}px 12px 0 0;font-family:${F};">${cell(a)}</td><td class="rv-stack rv-stack-next" width="50%" valign="top" style="padding:${first ? 0 : 10}px 0 0;font-family:${F};">${cell(c)}</td></tr>`
    H.push(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0 4px;border-collapse:separate;"><tr><td style="background:${C.cream};border:1px solid ${C.line};border-left:4px solid ${C.teal};border-radius:12px;padding:14px 16px;font-family:${F};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${pairRow(facts[0], facts[1], true)}${pairRow(facts[2], facts[3], false)}</table>
${b.rows.length ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:12px 0 0;border-top:1px solid ${C.line};"><tr><td style="height:10px;line-height:10px;">&nbsp;</td></tr>${b.rows.map((r, i) => (i % 2 ? '' : pairRow(r, b.rows[i + 1] || ['', ''], i === 0))).join('')}</table>` : ''}
${b.status ? `<div style="margin:10px 0 0;font-size:14px;line-height:21px;font-weight:700;color:${C.ink};">${esc(b.status)}</div>` : ''}
<div style="margin:6px 0 0;font-size:14px;line-height:21px;color:${C.inkSoft};">${esc(b.rules.join(' '))}</div>
</td></tr></table>`)
    T.push('', 'YOUR PLAN', ...facts.map(([k, v]) => `${k}: ${v}`), ...b.rows.map(([k, v]) => `${k}: ${v}`), ...(b.status ? [b.status] : []), b.rules.join(' '))
  }

  // Headline and counts
  H.push(`<div style="margin:18px 0 10px;font-family:${FONTS.display};font-size:19px;line-height:26px;font-weight:700;color:${C.ink};">${esc(s.headline)}</div>`)
  const tiles: [RowState, number, string][] = [
    ['passed', s.counts.passed, s.counts.fixed ? `Passed (${s.counts.fixed} fixed)` : 'Passed'],
    ['issue', s.counts.issues, s.counts.issues === 1 ? 'Issue found' : 'Issues found'],
    ['unverified', s.counts.unverified, 'Not verified'],
  ]
  H.push(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;"><tr>${tiles
    .map(([k, n, label], i) => `<td class="rv-stack${i ? ' rv-tile-next' : ''}" width="33%" valign="middle" style="padding:0 ${i < 2 ? 8 : 0}px 0 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;"><tr><td style="background:${TONE[k].fill};border:1.5px solid ${TONE[k].line};border-radius:12px;padding:10px 12px;font-family:${F};color:${TONE[k].text};">${badge(k, 20)}&nbsp; <span style="font-family:${FONTS.display};font-size:24px;line-height:28px;font-weight:700;vertical-align:middle;">${n}</span>&nbsp; <span style="font-size:14px;font-weight:700;vertical-align:middle;">${esc(label)}</span></td></tr></table></td>`)
    .join('')}</tr></table>`)
  T.push('', s.headline, tiles.map(([, n, l]) => `${l}: ${n}`).join(' | '))
  const next = nextStepLines(s)
  H.push(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:14px 0 4px;border-collapse:separate;"><tr><td style="background:${C.tealSoft};border:1.5px solid ${C.ink};border-radius:12px;padding:12px 14px;font-family:${F};color:${C.ink};">
<div style="font-size:12px;line-height:16px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:${C.tealDeep};">Your next step</div>
${next.map((t, i) => `<div style="margin:4px 0 0;font-size:${i ? 14 : 15}px;line-height:${i ? 21 : 23}px;${i ? '' : 'font-weight:700;'}">${esc(t)}</div>`).join('')}
</td></tr></table>`)
  T.push('', 'YOUR NEXT STEP', ...next)
  if (s.summary) { H.push('<div style="height:10px;line-height:10px;">&nbsp;</div>'); para(escLines(s.summary), s.summary) }

  // Needs attention, full width
  if (s.attention.length) {
    sect('Needs attention', 'issue')
    for (const a of s.attention) {
      const where = a.pages.length ? `${a.pages.join(', ')}${a.devices.length ? ` (${a.devices.join(' and ')})` : ''}` : ''
      const lines: [string, string][] = [['What’s wrong', a.what], ...(a.why ? [['Why it matters', a.why] as [string, string]] : []), ...(where ? [['Where', where] as [string, string]] : []), ...(a.note ? [['Next', `${a.status}: ${a.note}`] as [string, string]] : [])]
      H.push(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 10px;border-collapse:separate;"><tr><td style="background:#FFF7F5;border:1.5px solid ${TONE.issue.line};border-radius:12px;padding:12px 14px;font-family:${F};font-size:14px;line-height:21px;color:${C.ink};">
<div style="margin:0 0 4px;">${badge('issue', 18)}&nbsp; <strong style="font-size:15px;">${esc(a.title)}</strong> &nbsp;<span style="font-size:13px;font-weight:700;color:${TONE.issue.text};white-space:nowrap;">${esc(a.status)}</span></div>
${lines.map(([k, v]) => `<div><strong>${esc(k)}:</strong> ${esc(v)}</div>`).join('')}
</td></tr></table>`)
      T.push(`[Issue] ${a.title} (${a.status})`, ...lines.map(([k, v]) => `  ${k}: ${v}`))
    }
  }

  if (s.fixed.length) {
    sect('Fixed and verified', 'fixed')
    for (const f of s.fixed) {
      const t = `${f.title}${f.pages.length ? `: ${f.pages.join(', ')}` : ''}. Verified: ${f.verified}${f.note ? ` ${f.note}` : ''}`
      para(`${badge('fixed', 16)}&nbsp; ${esc(t)}`, `[Fixed] ${t}`, 14)
    }
  }

  // This month's checks: two columns with row dividers and a divider between columns; one column on phones.
  sect('This month’s checks')
  const half = Math.ceil(s.checklist.length / 2)
  const cols = [s.checklist.slice(0, half), s.checklist.slice(half)]
  const rowHtml = (r: Snapshot['checklist'][number], i: number) =>
    `<tr><td width="22" valign="top" style="padding:9px 8px 9px 0;${i ? `border-top:1px solid ${C.line};` : ''}">${badge(r.state, 18)}</td><td valign="top" style="padding:9px 8px 9px 0;${i ? `border-top:1px solid ${C.line};` : ''}font-family:${F};font-size:14px;line-height:20px;color:${C.ink};"><strong>${esc(r.label)}</strong>${r.note ? `<br><span style="font-size:12.5px;line-height:18px;color:${C.inkSoft};">${esc(r.note)}</span>` : ''}</td><td valign="top" align="right" style="padding:9px 0;${i ? `border-top:1px solid ${C.line};` : ''}font-family:${F};font-size:12.5px;line-height:20px;font-weight:700;white-space:nowrap;color:${TONE[r.state].text};">${esc(STATE_LABEL[r.state])}</td></tr>`
  const colHtml = (rows: Snapshot['checklist']) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows.map(rowHtml).join('')}</table>`
  H.push(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td class="rv-stack" width="50%" valign="top" style="padding:0 14px 0 0;">${colHtml(cols[0])}</td>${cols[1].length ? `<td class="rv-stack rv-col-next" width="50%" valign="top" style="padding:0 0 0 14px;border-left:1px solid ${C.line};">${colHtml(cols[1])}</td>` : ''}</tr></table>`)
  T.push(...s.checklist.map((r) => `[${STATE_LABEL[r.state]}] ${r.label}${r.note ? `: ${r.note}` : ''}`))
  if (s.not_applicable.length) para(`<span style="color:${C.inkSoft};">Not part of this month: ${esc(s.not_applicable.join(', '))}.</span>`, `Not part of this month: ${s.not_applicable.join(', ')}.`, 13)

  if (s.not_verified.length) {
    sect('Not verified this month', 'unverified')
    for (const n of s.not_verified) {
      const label = `${n.label}${n.pages.length ? ` (${n.pages.join(', ')})` : ''}`
      para(`${badge('unverified', 16)}&nbsp; <strong>${esc(label)}:</strong> ${esc(n.why)}`, `[Not verified] ${label}: ${n.why}`, 14)
    }
  }

  if (s.work_done?.length || s.work.fixes || s.work.investigated || s.work.outstanding) {
    sect('Work completed')
    for (const w of s.work_done || []) para(`&bull; ${esc(w.what)} <span style="color:${C.inkSoft};">(${esc(w.minutes)})</span>`, `- ${w.what} (${w.minutes})`, 14)
    if (s.work.fixes) para(escLines(s.work.fixes), s.work.fixes, 14)
    if (s.work.investigated) para(`<strong>Looked into:</strong> ${escLines(s.work.investigated)}`, `Looked into: ${s.work.investigated}`, 14)
    if (s.work.outstanding) para(`<strong>Still open:</strong> ${escLines(s.work.outstanding)}`, `Still open: ${s.work.outstanding}`, 14)
  }

  if (s.approvals?.length) {
    sect('Waiting for your approval')
    for (const a of s.approvals) {
      const rows: [string, string][] = [
        ['Scope', a.scope], ['You’ll get', a.deliverables], ...(a.schedule ? [['Schedule', a.schedule] as [string, string]] : []),
        ['Standard minutes, including testing', String(a.standard_minutes)], ['From your included time', `${a.included_minutes} minutes`], ['Additional work', `${a.additional_minutes} minutes`],
        ...(a.additional_minutes > 0 ? [['Additional price', `${a.price_label}. ${a.price_explanation}`] as [string, string]] : []),
      ]
      H.push(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 10px;border-collapse:separate;"><tr><td style="background:#F7FBFA;border:1.5px solid ${C.teal};border-radius:12px;padding:12px 14px;font-family:${F};font-size:14px;line-height:21px;color:${C.ink};">
<div style="margin:0 0 4px;"><strong style="font-size:15px;">${esc(a.title)}</strong></div>
${rows.map(([k, v]) => `<div><strong>${esc(k)}:</strong> ${esc(v)}</div>`).join('')}
<div style="margin:6px 0 0;font-size:12.5px;line-height:19px;color:${C.inkSoft};">Plan time is counted in standard minutes. The additional price is a separate quote, not a per minute charge. Nothing starts until you approve.</div>
</td></tr></table>`)
      T.push(`[Approval] ${a.title}`, ...rows.map(([k, v]) => `  ${k}: ${v}`), '  Plan time is counted in standard minutes. The additional price is a separate quote, not a per minute charge. Nothing starts until you approve.')
    }
  }
  if (s.approved_work?.length) {
    const t = `Approved and in progress: ${s.approved_work.map((a) => `${a.title} (${a.reserved_minutes} plan minutes reserved)`).join('; ')}.`
    para(esc(t), t, 14)
  }

  if (s.notes) para(escLines(s.notes), s.notes, 14)
  H.push(`<p style="margin:10px 0 16px;font-family:${F};font-size:12.5px;line-height:19px;color:${C.muted};">${esc(s.disclaimer)}</p>`)
  T.push('', s.disclaimer)

  return {
    subject: oneLine(p.subject),
    ...renderEmail({
      audience: 'client',
      preheader: s.headline,
      eyebrow: 'Website Care',
      title: 'Your monthly',
      titleAccent: 'health report.',
      mobileCss: '.rv-stack { display: block !important; width: 100% !important; padding-left: 0 !important; padding-right: 0 !important; } .rv-stack-next { padding-top: 10px !important; } .rv-tile-next { padding-top: 8px !important; } .rv-col-next { border-left: 0 !important; border-top: 1px solid ' + C.line + ' !important; }',
      blocks: [
        { type: 'p', html: escLines(p.message) },
        { type: 'divider' },
        { type: 'html', html: H.join('\n'), text: T.join('\n') },
        { type: 'divider' },
        { type: 'note', html: `A PDF copy of this report (version ${s.version}) is attached for your records. Reply to this email with any questions.` },
      ],
    }),
  }
}

/** Status icon for email: a colored disc with a glyph, always next to a text label. */
function badge(state: RowState, size: number) {
  const glyph = state === 'issue' ? '&#10007;' : state === 'unverified' ? '!' : '&#10003;'
  return `<span style="display:inline-block;width:${size}px;height:${size}px;border-radius:${size / 2}px;background:${TONE[state].line};color:#ffffff;font-family:Arial,sans-serif;font-size:${Math.round(size * 0.62)}px;line-height:${size}px;font-weight:700;text-align:center;vertical-align:middle;" aria-hidden="true">${glyph}</span>`
}

export function defaultClientMessage(p: { name: string; monthLabel: string; siteLabel: string }) {
  const first = String(p.name || '').trim().split(/\s+/)[0] || 'there'
  return `Hi ${first},\n\nHere’s your website health report for ${p.siteLabel} for ${p.monthLabel}. It covers your plan and included time, what I checked, anything that needs attention, what I fixed, and anything that needs your approval. A PDF copy is attached for your records.\n\nThanks,\nAlante`
}
