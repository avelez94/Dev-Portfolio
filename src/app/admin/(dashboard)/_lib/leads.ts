/** Lead and pipeline rules shared by Home and Pipeline. */
import type { Submission } from './types'

export const PIPELINE_STAGES = ['discovery_call', 'proposal_sent', 'active_project', 'closed', 'lost']
export const STAGE_LABELS: Record<string, string> = { discovery_call: 'Discovery', proposal_sent: 'Proposal Sent', active_project: 'Active Project', closed: 'Closed', lost: 'Lost' }

/** Where a lead is: short note, details completed, call booked. Rows saved before the intake flow count as details completed. */
export function leadSteps(s: Submission | null | undefined, booked: boolean) {
  const hasDetails = s?.stage ? s.stage === 'details' : true
  return [
    { label: 'Short note', done: Boolean(s && (s.source === 'homepage' || s.inquiry_note || s.linked_submission_id || s.stage === 'inquiry')), optional: true },
    { label: 'Details completed', done: hasDetails },
    { label: 'Call booked', done: booked },
  ]
}
export function leadStageLabel(s: Submission, booked = false) {
  if (booked) return 'Call booked'
  if (s.stage === 'inquiry') return 'Short note only'
  return 'Details completed'
}
const DETAIL_LABELS: Record<string, string> = {
  interest: 'Interested in', existing: 'Has a website now', website: 'Current website', platform: 'Site platform',
  assets: 'Assets ready', integrations: 'Integrations', references: 'Sites they like',
}
export function detailFields(s: Submission | null | undefined) {
  const out: { label: string; val: string }[] = []
  if (s?.inquiry_note && s.inquiry_note !== s.description) out.push({ label: 'Original short note', val: s.inquiry_note })
  Object.entries(s?.details || {}).forEach(([k, v]) => {
    const val = Array.isArray(v) ? v.join(', ') : String(v ?? '')
    if (val) out.push({ label: DETAIL_LABELS[k] || k, val })
  })
  return out
}
