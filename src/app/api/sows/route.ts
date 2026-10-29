import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { requireAdmin } from '@/lib/admin-auth'
import { BRAND } from '@/lib/brand'
import * as mail from '@/lib/email/templates'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { MigrationRequiredError, assertTermsSchema, migrationResponse, throwIfMissingColumn } from '@/lib/terms-schema'
import { STANDARD_HOURLY_RATE, TERMS_VERSION } from '@/lib/terms'
import { checkSchedule } from '@/lib/payment-schedule'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  const denied = requireAdmin(req)
  if (denied) return denied
  try {
    const body = await req.json()
    const {
      clientName, clientEmail, projectTitle, projectType,
      understood, outOfScope, milestones,
      total,
      startDate, deliveryDate, revisions, hourlyRate, paymentMethod,
    } = body

    // Current terms: 50% deposit, remaining 50% across these milestones, checked to the cent.
    const check = checkSchedule(total, Array.isArray(milestones) ? milestones : [])
    if (!check.ok) return NextResponse.json({ error: 'INVALID', message: check.problems.join(' ') }, { status: 400 })
    const { deposit, balance, milestones: schedule } = check.schedule

    await assertTermsSchema(['proposals', 'sows', 'contracts'])

    const { data: sow, error } = await supabaseAdmin.from('sows').insert({
      client_name: clientName,
      client_email: clientEmail,
      project_title: projectTitle,
      project_type: projectType,
      understood: understood || null,
      deliverables: null,
      out_of_scope: outOfScope || null,
      line_items: schedule,
      total: check.schedule.total,
      deposit,
      balance,
      deposit_pct: 50,
      start_date: startDate || null,
      delivery_date: deliveryDate || null,
      revisions: revisions || '2',
      hourly_rate: Number(hourlyRate) > 0 ? Number(hourlyRate) : STANDARD_HOURLY_RATE,
      payment_method: paymentMethod || 'Stripe, PayPal, Zelle, or Wise',
      status: 'pending',
      terms_version: TERMS_VERSION,
      payment_plan: 'milestone_balance',
    }).select().single()

    throwIfMissingColumn(error, 'sows')
    if (error || !sow) throw error

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://alantevelez.com'
    const sowUrl = `${siteUrl}/sows/${sow.id}`

    const m = mail.sowSent({ clientName, projectTitle, url: sowUrl })
    const { error: mailErr } = await resend.emails.send({ from: BRAND.from, to: clientEmail, cc: BRAND.email, subject: m.subject, html: m.html, text: m.text })
    // The document is saved. If the email fails, say so instead of failing, so it isn't issued twice.
    if (mailErr) console.error('Document email failed:', mailErr)

    return NextResponse.json({ success: true, id: sow.id, emailed: !mailErr, url: sowUrl })
  } catch (err) {
    if (err instanceof MigrationRequiredError) return migrationResponse(err)
    console.error('Create SOW error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}