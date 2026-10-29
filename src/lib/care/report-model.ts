/**
 * The concise client report, built from plain data with no database access, so
 * the same code builds real reports and the public samples.
 *
 * Rules it enforces:
 * - Repeated results are grouped into one issue with its affected pages.
 * - A check row is "Passed" only when an automated result or a recorded manual
 *   review supports it. Anything else is "Not verified", never "Passed".
 * - "Fixed and verified" needs your "fixed" decision plus a clean recheck or a
 *   recorded verification note.
 * - Internal notes never enter the snapshot.
 * Copy rule: no dashes in client facing text.
 */
import { CHECK_ROWS, DESTINATION_NOTE, issueText } from './issue-catalog'

export type FindingIn = {
  run_id?: string
  check_key: string
  issue_code?: string | null
  status: string
  url?: string | null
  viewport?: string | null
  observed?: string
  evidence?: Record<string, unknown> | null
  client_visible?: boolean
}
export type ManualIn = { item_id: string; label: string; category?: string | null; status: string | null; note?: string | null; reason?: string | null }
export type IssueNoteIn = { group_key: string; resolution: string | null; client_note?: string | null; verification_note?: string | null; internal_note?: string | null }
export type Page = { label: string; url: string }
export type Destination = { label: string; url: string; kind: string }

export type ModelInput = {
  reportId: string
  cycleId: string
  version: number
  sample?: boolean
  client: { name: string; business: string }
  recipient: { name: string; email: string }
  site: { label: string; url: string }
  plan: { id: string; name: string; includedMinutes: number }
  period: { start: string; end: string; label: string }
  reviewDate: string | null
  scanStatus: string | null
  pages: Page[]
  destinations: Destination[]
  findings: FindingIn[]
  earlierFindings: FindingIn[]
  manual: ManualIn[]
  notes: IssueNoteIn[]
  content: Record<string, string | undefined>
}

export type RowState = 'passed' | 'issue' | 'unverified' | 'fixed'
export const STATE_LABEL: Record<RowState, string> = { passed: 'Passed', issue: 'Issue found', unverified: 'Not verified', fixed: 'Fixed and verified' }

export const RESOLUTION_LABEL: Record<string, string> = {
  fixed: 'Fixed and verified',
  client_input: 'Needs your input',
  approval: 'Needs your approval',
  investigating: 'I’m looking into it',
}

export type Group = {
  key: string
  check: string
  code: string | null
  severity: 'issue' | 'unverified'
  title: string
  what: string
  why: string
  pages: string[]
  devices: string[]
  evidence: string
  count: number
  resolution: string | null
  clientNote: string
  verification: string
  clearedOnRecheck: boolean
  state: RowState | 'hidden'
}

const ISSUE_STATUSES = ['failed', 'needs_review', 'could_not_check']
const strip = (u: string) => u.replace(/#.*$/, '').replace(/\/$/, '')

function pageLabel(url: string | null | undefined, pages: Page[], destinations: Destination[]): string {
  if (!url) return 'Whole site'
  const hit = [...pages, ...destinations].find((p) => strip(p.url) === strip(url))
  if (hit) return hit.label
  try {
    const u = new URL(url)
    return u.pathname === '/' ? u.hostname : u.pathname
  } catch {
    return url
  }
}

const CHECK_NAME: Record<string, string> = {
  page_load: 'Pages open', redirects: 'Redirects', https: 'Secure connection', images: 'Images', overflow: 'Screen fit', internal_links: 'Links', destination: 'Destination', scan: 'Automated check', screenshot: 'Screenshot',
}

export function groupKey(f: FindingIn) {
  return `${f.check_key}:${f.issue_code || f.status}`
}

/** Groups non passing results by check and issue type (devices and pages merged). */
export function groupFindings(findings: FindingIn[], pages: Page[], destinations: Destination[]) {
  const map = new Map<string, { items: FindingIn[] }>()
  for (const f of findings) {
    if (f.client_visible === false || f.check_key === 'screenshot' || !ISSUE_STATUSES.includes(f.status)) continue
    const k = groupKey(f)
    const g = map.get(k) || { items: [] }
    g.items.push(f)
    map.set(k, g)
  }
  return [...map.entries()].map(([key, { items }]) => {
    const first = items[0]
    const text = issueText(first.issue_code, CHECK_NAME[first.check_key] || first.check_key)
    const severity: 'issue' | 'unverified' = items.some((i) => i.status === 'failed') ? 'issue' : 'unverified'
    const pagesHit = [...new Set(items.map((i) => (i.check_key === 'internal_links' ? `${pageLabel(i.url, pages, destinations)} (linked from ${pageLabel(String(i.evidence?.found_on || ''), pages, destinations)})` : pageLabel(i.url, pages, destinations))))]
    const codes = [...new Set(items.map((i) => (i.evidence?.http_status ? `HTTP ${i.evidence.http_status}` : i.evidence?.error_code ? String(i.evidence.error_code) : '')).filter(Boolean))]
    return {
      key, check: first.check_key, code: first.issue_code || null, severity, title: text.title, what: text.what, why: text.why,
      pages: pagesHit, devices: [...new Set(items.map((i) => i.viewport).filter(Boolean) as string[])], evidence: codes.slice(0, 3).join(', '), count: items.length,
    }
  })
}

const ALL_CLEAR = /\b(everything|all)\b[^.]{0,30}\b(ok|okay|fine|good|working|great|passed|healthy)\b|\bno (issues|problems)\b|\ball good\b/i

export function buildReport(i: ModelInput) {
  const notes = new Map(i.notes.map((n) => [n.group_key, n]))
  const raw = groupFindings(i.findings, i.pages, i.destinations)
  const latestKeys = new Set(raw.map((g) => g.key))
  // Issues seen earlier this cycle that a later check no longer shows.
  const earlierGroups = groupFindings(i.earlierFindings, i.pages, i.destinations).filter((g) => !latestKeys.has(g.key) && g.severity === 'issue')

  const groups: Group[] = []
  for (const g of raw) {
    const n = notes.get(g.key)
    const verification = (n?.verification_note || '').trim()
    let state: Group['state'] = g.severity
    if (n?.resolution === 'not_an_issue') state = 'hidden'
    else if (n?.resolution === 'fixed' && verification) state = 'fixed'
    groups.push({ ...g, resolution: n?.resolution || null, clientNote: (n?.client_note || '').trim(), verification, clearedOnRecheck: false, state })
  }
  for (const g of earlierGroups) {
    const n = notes.get(g.key)
    if (n?.resolution === 'fixed') {
      groups.push({ ...g, resolution: 'fixed', clientNote: (n.client_note || '').trim(), verification: (n.verification_note || '').trim() || 'Rechecked automatically: no longer found.', clearedOnRecheck: true, state: 'fixed' })
    }
  }
  // Manual items with a failed result are issues too.
  for (const m of i.manual) {
    if (m.status !== 'failed') continue
    const key = `manual:${m.item_id}`
    const n = notes.get(key)
    const verification = (n?.verification_note || '').trim()
    groups.push({
      key, check: 'manual', code: null, severity: 'issue', title: m.label, what: (m.note || '').trim() || 'This didn’t pass when I checked it by hand.', why: '', pages: [], devices: [], evidence: '', count: 1,
      resolution: n?.resolution || null, clientNote: (n?.client_note || '').trim(), verification, clearedOnRecheck: false,
      state: n?.resolution === 'not_an_issue' ? 'hidden' : n?.resolution === 'fixed' && verification ? 'fixed' : 'issue',
    })
  }
  const visible = groups.filter((g) => g.state !== 'hidden')
  const stateOfGroups = (gs: Group[]): RowState | null =>
    gs.some((g) => g.state === 'issue') ? 'issue' : gs.some((g) => g.state === 'unverified') ? 'unverified' : gs.some((g) => g.state === 'fixed') ? 'fixed' : null

  // Checklist rows.
  type Row = { label: string; state: RowState; note: string }
  const rows: Row[] = []
  const noScan = !i.findings.length
  for (const r of CHECK_ROWS) {
    const fs = i.findings.filter((f) => r.checks.includes(f.check_key) && f.status !== 'not_applicable' && f.client_visible !== false)
    const gs = visible.filter((g) => r.checks.includes(g.check))
    const fromGroups = stateOfGroups(gs)
    const passedAny = fs.some((f) => f.status === 'passed')
    const state: RowState = fromGroups || (passedAny ? 'passed' : 'unverified')
    const note = state === 'unverified' && (noScan || fs.length === 0) ? 'Not checked this month.' : r.key === 'pages' ? `${i.pages.length} agreed page${i.pages.length === 1 ? '' : 's'}` : ''
    rows.push({ label: r.label, state, note })
  }
  for (const d of i.destinations) {
    const fs = i.findings.filter((f) => f.check_key === 'destination' && f.url && strip(f.url) === strip(d.url))
    const gs = visible.filter((g) => g.check === 'destination' && g.pages.includes(d.label))
    const fromGroups = stateOfGroups(gs)
    const state: RowState = fromGroups || (fs.some((f) => f.status === 'passed') ? 'passed' : 'unverified')
    rows.push({ label: `${d.label} opens`, state, note: state === 'passed' ? DESTINATION_NOTE[d.kind] || DESTINATION_NOTE.other : fs.length ? '' : 'Not checked this month.' })
  }
  const notApplicable: string[] = []
  for (const m of i.manual) {
    if (m.status === 'not_applicable') { notApplicable.push(m.label); continue }
    const g = visible.find((x) => x.key === `manual:${m.item_id}`)
    const state: RowState = m.status === 'passed' ? 'passed' : g ? (g.state as RowState) : m.status === 'failed' ? 'issue' : 'unverified'
    rows.push({ label: m.label, state, note: m.status === 'passed' ? 'Checked by hand.' : state === 'unverified' ? 'Not checked by hand this month.' : '' })
  }

  const attention = visible.filter((g) => g.state === 'issue').map((g) => ({
    title: g.title, what: g.what + (g.evidence ? ` (${g.evidence})` : ''), why: g.why, pages: g.pages, devices: g.devices,
    status: g.resolution ? RESOLUTION_LABEL[g.resolution] || 'I’m looking into it' : 'I’m looking into it', note: g.clientNote, kind: g.resolution || 'investigating',
  }))
  const fixed = visible.filter((g) => g.state === 'fixed').map((g) => ({ title: g.title, pages: g.pages, verified: g.verification, note: g.clientNote }))
  const notVerifiedRaw = [
    ...visible.filter((g) => g.state === 'unverified').map((g) => ({ label: g.title, why: g.clientNote || g.why, pages: g.pages })),
    ...i.manual.filter((m) => m.status === 'not_checked' || m.status === 'could_not_check' || m.status === 'needs_review').map((m) => ({ label: m.label, why: (m.reason || '').trim() || 'Not checked by hand this month.', pages: [] as string[] })),
    ...(noScan ? [{ label: 'Automated checks', why: 'The automated check didn’t complete this month.', pages: [] as string[] }] : []),
  ]
  // One entry per reason: items you explained with the same words are listed together.
  const notVerified: { label: string; why: string; pages: string[] }[] = []
  for (const n of notVerifiedRaw) {
    const same = notVerified.find((x) => x.why === n.why)
    if (same) { same.label = `${same.label}; ${n.label}`; same.pages = [...new Set([...same.pages, ...n.pages])] }
    else notVerified.push({ ...n, pages: [...n.pages] })
  }

  // Passed counts agreed checks; issues and not verified count the grouped items listed below them.
  const counts = {
    passed: rows.filter((r) => r.state === 'passed' || r.state === 'fixed').length,
    fixed: rows.filter((r) => r.state === 'fixed').length,
    issues: attention.length,
    unverified: notVerified.length,
  }

  const headline = counts.issues
    ? `${counts.issues} ${counts.issues === 1 ? 'issue needs' : 'issues need'} attention${counts.unverified ? `, and ${counts.unverified} ${counts.unverified === 1 ? 'item wasn’t' : 'items weren’t'} verified` : ''}.`
    : counts.unverified
      ? `No issues found in what was checked. ${counts.unverified} ${counts.unverified === 1 ? 'item wasn’t' : 'items weren’t'} verified this month.`
      : 'Everything agreed for this month was checked and passed.'

  const c = i.content
  const sendItems = attention.filter((a) => a.kind === 'client_input' && a.note).map((a) => a.note)
  const approveItems = [...attention.filter((a) => a.kind === 'approval' && a.note).map((a) => a.note), ...(c.proposed_work ? [c.proposed_work] : [])]
  const nextStep = {
    send: sendItems,
    approve: approveItems,
    estimate: c.estimate || '',
    // Why requested work is outside the included care scope, in your words. Required before any request for payment.
    why_extra: approveItems.length || c.estimate ? (c.extra_work_reason || '').trim() : '',
    none: !sendItems.length && !approveItems.length,
    more: c.next_steps || '',
  }
  const allowance = i.plan.includedMinutes
    ? `Checks and this report are included in ${i.plan.name}. Fixes use your ${i.plan.includedMinutes} included minutes a month, or a separate estimate you approve first.`
    : `Checks and this report are included in ${i.plan.name}. Fixes are quoted separately and start only after you approve.`

  const scopeParts = [`${i.pages.length} page${i.pages.length === 1 ? '' : 's'}`]
  for (const kind of ['booking', 'checkout', 'contact', 'other']) {
    const n = i.destinations.filter((d) => (d.kind || 'other') === kind).length
    if (n) scopeParts.push(`${n} ${kind === 'other' ? 'linked' : kind} page${n === 1 ? '' : 's'}`)
  }
  const handCount = i.manual.filter((m) => m.status !== 'not_applicable').length
  if (handCount) scopeParts.push(`${handCount} hand check${handCount === 1 ? '' : 's'}`)

  return {
    schema: 2 as const,
    sample: !!i.sample,
    report_id: i.reportId,
    cycle_id: i.cycleId,
    version: i.version,
    client: i.client,
    recipient: i.recipient,
    site: i.site,
    plan: i.plan,
    period: i.period,
    review_date: i.reviewDate,
    scope: { line: scopeParts.join(', '), pages: i.pages.map((p) => ({ label: p.label, url: p.url })), destinations: i.destinations.map((d) => ({ label: d.label, url: d.url, kind: d.kind })) },
    headline,
    summary: (c.summary || '').trim(),
    counts,
    attention,
    fixed,
    checklist: rows,
    not_applicable: notApplicable,
    not_verified: notVerified,
    work: { fixes: (c.fixes || '').trim(), investigated: (c.investigated || '').trim(), outstanding: (c.outstanding || '').trim() },
    next_step: nextStep,
    notes: (c.client_notes || '').trim(),
    allowance,
    disclaimer: 'Automated checks are read only. A page opening doesn’t prove booking, payment, or form delivery works unless it’s listed as checked by hand. This report isn’t a security, accessibility, or compliance certification.',
  }
}

export type Snapshot = ReturnType<typeof buildReport>

/** Problems that must be fixed before the report can be marked ready. */
export function modelProblems(i: ModelInput, s: Snapshot): string[] {
  const p: string[] = []
  const raw = groupFindings(i.findings, i.pages, i.destinations)
  const notes = new Map(i.notes.map((n) => [n.group_key, n]))
  const manualIssues = i.manual.filter((m) => m.status === 'failed').map((m) => ({ key: `manual:${m.item_id}`, title: m.label, severity: 'issue' }))
  for (const g of [...raw, ...manualIssues]) {
    const n = notes.get(g.key)
    if (g.severity === 'issue' && !n?.resolution) p.push(`Choose what happens next for “${g.title}”.`)
    if (n?.resolution === 'fixed' && !(n.verification_note || '').trim()) p.push(`“${g.title}” is marked fixed but the latest check still shows it. Rerun the check, or record how you verified the fix.`)
    if ((n?.resolution === 'client_input' || n?.resolution === 'approval') && !(n.client_note || '').trim()) p.push(`Say what you need from the client for “${g.title}”.`)
    if (n?.resolution === 'not_an_issue' && !(n.internal_note || '').trim()) p.push(`Add a private note explaining why “${g.title}” isn’t an issue.`)
  }
  const asksForPayment = s.next_step.approve.length > 0 || !!(i.content.estimate || '').trim()
  if (asksForPayment && (i.content.extra_work_reason || '').trim().length < 20) {
    p.push('This report asks the client to approve extra work. Explain why it’s outside the included care scope and whether any remaining included time applies (Why this is extra work).')
  }
  if (s.summary && (s.counts.issues || s.counts.unverified) && ALL_CLEAR.test(s.summary)) {
    p.push('The summary reads as if everything is fine, but some checks found issues or weren’t verified. Adjust the wording.')
  }
  return p
}
