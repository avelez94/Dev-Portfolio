export type IntakeSubmission = {
  id: string
  name: string
  email: string
  business: string | null
  project_type: string
  description: string
  budget: string | null
  timeline: string | null
  heard_from: string
  priority: string | null
  notes: string | null
  status: 'pending' | 'booked' | 'completed' | 'cancelled'
  submitted_at: string
}

export type Booking = {
  id: string
  intake_id: string
  scheduled_at: string
  zoom_meeting_id: string | null
  zoom_join_url: string | null
  zoom_host_url: string | null
  status: 'scheduled' | 'completed' | 'cancelled' | 'no_show'
  created_at: string
}

export type Availability = {
  id: string
  day_of_week: number
  start_time: string
  end_time: string
  is_active: boolean
}

export type BlockedDate = {
  id: string
  blocked_date: string
  reason: string | null
  created_at: string
}

export type Client = {
  id: string
  intake_id: string | null
  booking_id: string | null
  name: string
  email: string
  business: string | null
  pipeline_stage: 'discovery_call' | 'proposal_sent' | 'active_project' | 'closed'
  created_at: string
}

export type PipelineStage = Client['pipeline_stage']