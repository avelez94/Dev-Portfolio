/** Row shapes for the admin dashboard tables (moved from the single page dashboard). */
export type Submission = {
  id: string; name: string; email: string; business: string | null
  project_type: string; description: string; budget: string | null
  timeline: string | null; heard_from: string; priority: string | null
  notes: string | null; status: string; submitted_at: string
  // Intake flow (20261028_intake_flow.sql). Absent on rows saved before the migration.
  stage?: 'inquiry' | 'details' | 'merged' | null; source?: string | null; interest?: string | null
  inquiry_note?: string | null; details?: Record<string, string | string[]> | null
  details_completed_at?: string | null; linked_submission_id?: string | null
}
export type Booking = {
  id: string; intake_id: string; scheduled_at: string
  zoom_join_url: string | null; zoom_host_url: string | null
  status: string; intake_submissions: Submission
}
export type Client = {
  id: string; name: string; email: string; business: string | null
  pipeline_stage: string; created_at: string
  intake_id: string | null; booking_id: string | null
  notes: string | null; platform: string | null
}
export type Availability = { id: string; day_of_week: number; start_time: string; end_time: string; is_active: boolean }
export type BlockedDate = { id: string; blocked_date: string; reason: string | null }
export type BlockedSlot = { id: string; blocked_date: string; start_time: string; end_time: string; reason: string | null }
export type Project = {
  id: string; client_id: string | null; name: string; type: string
  status: string; value: number; platform: string
  start_date: string | null; end_date: string | null; notes: string | null; created_at: string
}
export type Invoice = {
  id: string; project_id: string | null; client_id: string | null
  invoice_number: string; amount: number; status: string
  invoice_type: string; total_fee: number; deposit_amount: number
  deposit_paid_date: string | null; hours: number; hourly_rate: number
  service_desc: string | null
  due_date: string | null; paid_date: string | null; notes: string | null; created_at: string
  brand_version?: string | null
}
export type Pricing = { id: string; name: string; price: string; description: string; updated_at: string }
export type Meeting = {
  id: string; client_id: string; scheduled_at: string
  zoom_join_url: string | null; zoom_host_url: string | null
  title: string; status: string; created_at: string
}
export type Document = { id: string; client_id: string | null; name: string; type: string; storage_path: string; created_at: string }
export type InvoiceMilestone = {
  id: string; invoice_id: string; name: string
  deliverables: string | null; due_date: string | null
  fee: number; status: string; paid_date: string | null; created_at: string
  brand_version?: string | null
}
export type PreviewDoc = { title: string; sections: { label: string; value: string }[] }
export type Row = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
export type CareCalendarItem = { id: string; date: string; due: string; client: string; site: string; status: string; overdue: boolean; done: boolean; link: string }
