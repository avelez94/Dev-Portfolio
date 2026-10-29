/**
 * Finding statuses, labels, fingerprints, and run to run comparison.
 */
export const STATUSES = ['passed', 'failed', 'needs_review', 'could_not_check', 'not_applicable'] as const
export type FindingStatus = (typeof STATUSES)[number]
export const ISSUE: FindingStatus[] = ['failed', 'needs_review']

export const CHECK_LABELS: Record<string, string> = {
  page_load: 'Page loads',
  redirects: 'Redirects',
  https: 'Secure connection (HTTPS)',
  images: 'Images load',
  overflow: 'Fits the screen (no sideways scrolling)',
  screenshot: 'Screenshot',
  internal_links: 'Links within the site',
  destination: 'Destination opens',
  scan: 'Automated check',
}

export function fingerprint(f: { check_key: string; url?: string | null; viewport?: string | null }) {
  return `${f.check_key}|${f.viewport || '-'}|${(f.url || '').replace(/#.*$/, '')}`
}

export type FindingRow = { fingerprint: string; status: string; check_key: string; url: string | null; viewport: string | null; observed: string }

/** What changed between two runs, by finding fingerprint. */
export function diffFindings(prev: FindingRow[], curr: FindingRow[]) {
  const p = new Map(prev.map((f) => [f.fingerprint, f]))
  const c = new Map(curr.map((f) => [f.fingerprint, f]))
  const newIssues: FindingRow[] = []
  const resolved: FindingRow[] = []
  const changed: { from: FindingRow; to: FindingRow }[] = []
  const notSeen: FindingRow[] = []
  for (const [k, f] of c) {
    const before = p.get(k)
    const isIssue = ISSUE.includes(f.status as FindingStatus)
    if (!before) { if (isIssue) newIssues.push(f) }
    else if (before.status !== f.status) {
      if (ISSUE.includes(before.status as FindingStatus) && f.status === 'passed') resolved.push(f)
      else changed.push({ from: before, to: f })
    }
  }
  // An earlier issue that wasn't checked this time is NOT resolved; it's listed separately.
  for (const [k, f] of p) if (!c.has(k) && ISSUE.includes(f.status as FindingStatus)) notSeen.push(f)
  return { newIssues, resolved, changed, notSeen }
}
