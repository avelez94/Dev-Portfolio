/**
 * Website Care emails on the shared branded layout. Owner notices use the
 * admin audience; the client report email uses the light client brand.
 * Copy rule: no dashes in client facing text.
 */
import { esc, escLines, renderEmail } from '@/lib/email/layout'
import type { Snapshot } from './report-model'

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

/** The client's report email: your message plus the same summary as the attached approved report. */
export function clientReport(p: { subject: string; message: string; snap: Snapshot }): Email {
  const s = p.snap
  const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
  const next: string[] = []
  if (s.next_step.none) next.push('No action needed.')
  s.next_step.send.forEach((t) => next.push(`Please send: ${t}`))
  s.next_step.approve.forEach((t) => next.push(`Approval needed for: ${t}`))
  const rows: [string, string][] = [
    ['Passed', `✓ ${count(s.counts.passed, 'check', 'checks')}${s.counts.fixed ? ` (${s.counts.fixed} fixed and verified)` : ''}`],
    ['Issues found', `✗ ${count(s.counts.issues, 'issue', 'issues')}`],
    ['Not verified', `! ${count(s.counts.unverified, 'item', 'items')}`],
  ]
  return {
    subject: oneLine(p.subject),
    ...renderEmail({
      audience: 'client',
      preheader: s.headline,
      eyebrow: 'Website Care',
      title: 'Your monthly',
      titleAccent: 'health report.',
      blocks: [
        { type: 'p', html: escLines(p.message) },
        { type: 'details', title: `${s.site.label}, ${s.period.label}`, rows: [['Result', esc(s.headline)], ...rows.map(([k, v]) => [k, esc(v)] as [string, string])] },
        ...(s.attention.length ? [{ type: 'callout' as const, title: 'Needs attention', tone: 'coral' as const, html: s.attention.map((a) => `✗ <strong>${esc(a.title)}</strong>: ${esc(a.status)}${a.note ? `: ${esc(a.note)}` : ''}`).join('<br>') }] : []),
        { type: 'p', html: `<strong>Next step:</strong> ${next.map(esc).join('<br>')}` },
        { type: 'note', html: `The full report (version ${s.version}) is attached as a PDF. Reply to this email with any questions.` },
      ],
    }),
  }
}

export function defaultClientMessage(p: { name: string; monthLabel: string; siteLabel: string }) {
  const first = String(p.name || '').trim().split(/\s+/)[0] || 'there'
  return `Hi ${first},\n\nYour website health report for ${p.siteLabel} for ${p.monthLabel} is attached. It covers what I checked, anything that needs attention, what I fixed, and anything that needs your approval.\n\nThanks,\nAlante`
}
