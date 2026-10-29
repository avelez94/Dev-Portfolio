import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { clientIp, hit } from '@/lib/rate-limit'
import { hashToken, isMissingColumn, looksLikeToken, websiteFromNotes } from '@/lib/intake'

/**
 * Returns what someone already sent in their short note, so the questionnaire
 * can be prefilled. Requires the private continue token from their link or
 * success screen (sent in the request body, never as a database id).
 */
export async function POST(req: NextRequest) {
  const ip = clientIp(req.headers)
  if (!hit(`continue:${ip}`, 20, 10 * 60 * 1000).ok) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }
  let token: unknown
  try {
    token = ((await req.json()) as { token?: unknown })?.token
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
  if (!looksLikeToken(token)) return NextResponse.json({ status: 'invalid' }, { status: 404 })

  const { data, error } = await supabaseAdmin
    .from('intake_submissions')
    .select('name, email, business, project_type, description, budget, timeline, notes, interest, inquiry_note, details, stage, continue_token_expires_at')
    .eq('continue_token_hash', hashToken(token))
    .maybeSingle()

  if (error) {
    if (isMissingColumn(error)) return NextResponse.json({ status: 'invalid' }, { status: 404 })
    console.error('Continue lookup failed:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
  if (!data || data.stage !== 'inquiry') return NextResponse.json({ status: 'invalid' }, { status: 404 })
  if (new Date(data.continue_token_expires_at).getTime() < Date.now()) return NextResponse.json({ status: 'expired' }, { status: 410 })

  const details = (data.details || {}) as Record<string, unknown>
  return NextResponse.json(
    {
      status: 'ok',
      prefill: {
        name: data.name,
        email: data.email,
        business: data.business || '',
        interest: data.interest || '',
        type: data.project_type || '',
        note: data.inquiry_note || data.description || '',
        website: (details.website as string) || websiteFromNotes(data.notes),
        budget: data.budget || '',
        timeline: data.timeline || '',
      },
    },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
