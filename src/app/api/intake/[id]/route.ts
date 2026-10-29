import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Used by the booking page (/book?ref=...). Existing booking links keep working,
 * but this now returns only what the page needs: a first name and progress.
 * It no longer returns email addresses or project details.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    if (!UUID_RE.test(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const { data, error } = await supabaseAdmin.from('intake_submissions').select('*').eq('id', id).single()
    if (error || !data || data.stage === 'merged') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json(
      {
        firstName: String(data.name || '').trim().split(/\s+/)[0] || '',
        // Submissions from before the new flow have no stage; they came from the full questionnaire.
        stage: data.stage || 'details',
        booked: data.status === 'booked',
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (err) {
    console.error('Intake fetch error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
