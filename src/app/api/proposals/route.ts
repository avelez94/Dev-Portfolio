import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { requireAdmin } from '@/lib/admin-auth'
import { BRAND } from '@/lib/brand'
import * as mail from '@/lib/email/templates'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { STANDARD_DEPOSIT_PCT, STANDARD_HOURLY_RATE, TERMS_VERSION } from '@/lib/terms'
import { checkSchedule, toCents } from '@/lib/payment-schedule'
import { BOOKING_PROJECT_TYPE, bookingAutomationLines } from '@/lib/automation'
import { MigrationRequiredError, assertTermsSchema, migrationResponse, throwIfMissingColumn } from '@/lib/terms-schema'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  const denied = requireAdmin(req)
  if (denied) return denied
  try {
    const body = await req.json()
    const {
      clientId, clientName, clientEmail, clientBusiness,
      projectTitle, projectType, understood, lineItems, milestones, total,
      outOfScope, timeline, startDate, deliveryDate,
      revisions, hourlyRate, nextSteps, message, paymentPlan,
    } = body

    // New proposals use the current payment policy: 50% deposit, remaining 50% across the milestones given.
    if (paymentPlan !== 'milestone_balance') {
      return NextResponse.json({ error: 'INVALID', message: 'New proposals use the current payment schedule: a 50% deposit and milestones for the remaining 50%.' }, { status: 400 })
    }
    const items = Array.isArray(lineItems) ? lineItems : []
    const itemCents = items.reduce((sum: number, i: { price?: unknown }) => sum + (Number.isFinite(toCents(i.price)) ? toCents(i.price) : 0), 0)
    if (itemCents !== toCents(total)) {
      return NextResponse.json({ error: 'INVALID', message: 'The total doesn’t match the line items. Nothing was sent.' }, { status: 400 })
    }
    const check = checkSchedule(total, Array.isArray(milestones) ? milestones : [])
    if (!check.ok) return NextResponse.json({ error: 'INVALID', message: check.problems.join(' ') }, { status: 400 })
    if (projectType === BOOKING_PROJECT_TYPE && bookingAutomationLines(items).length) {
      return NextResponse.json({ error: 'INVALID', message: 'Booking & Payments already includes booking confirmations and reminders. Remove the separate charge for them, or describe the custom automation it covers.' }, { status: 400 })
    }
    const { deposit, balance, milestones: schedule } = check.schedule

    await assertTermsSchema(['proposals', 'sows', 'contracts'])

    const plan = 'milestone_balance'
    const pct = STANDARD_DEPOSIT_PCT
    const rate = Number(hourlyRate) > 0 ? Number(hourlyRate) : STANDARD_HOURLY_RATE

    const { data: proposal, error } = await supabaseAdmin
      .from('proposals')
      .insert({
        client_id: clientId || null,
        client_name: clientName,
        client_email: clientEmail,
        client_business: clientBusiness || null,
        project_title: projectTitle,
        project_type: projectType,
        understood: understood || null,
        line_items: items,
        total: check.schedule.total,
        deposit_pct: pct,
        out_of_scope: outOfScope || null,
        timeline: timeline || null,
        next_steps: nextSteps || null,
        message: message || null,
        status: 'pending',
        terms_version: TERMS_VERSION,
        hourly_rate: rate,
        payment_plan: plan,
      })
      .select()
      .single()

    throwIfMissingColumn(error, 'proposals')
    if (error || !proposal) throw error

    // The milestone schedule lives in the linked SOW, which the proposal page shows.
    {
      const { error: sowError } = await supabaseAdmin.from('sows').insert({
        proposal_id: proposal.id,
        client_name: clientName,
        client_email: clientEmail,
        client_business: clientBusiness || null,
        project_title: projectTitle,
        project_type: projectType,
        understood: understood || null,
        out_of_scope: outOfScope || null,
        line_items: schedule,
        total: check.schedule.total,
        deposit,
        balance,
        deposit_pct: pct,
        timeline: timeline || null,
        start_date: startDate || null,
        delivery_date: deliveryDate || null,
        revisions: revisions || '2',
        hourly_rate: rate,
        payment_method: 'Stripe, PayPal, Zelle, or Wise',
        status: 'pending',
        terms_version: TERMS_VERSION,
        payment_plan: plan,
      })
      if (sowError) {
        // Don't leave a proposal without its schedule; nothing has been emailed yet.
        await supabaseAdmin.from('proposals').delete().eq('id', proposal.id)
        throwIfMissingColumn(sowError, 'sows')
        throw sowError
      }
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://alantevelez.com'
    const proposalUrl = `${siteUrl}/proposals/${proposal.id}`

    const m = mail.proposalSent({ clientName, projectTitle, message, url: proposalUrl })
    const { error: mailErr } = await resend.emails.send({ from: BRAND.from, to: clientEmail, cc: BRAND.email, subject: m.subject, html: m.html, text: m.text })
    // The document is saved. If the email fails, say so instead of failing, so it isn't issued twice.
    if (mailErr) console.error('Document email failed:', mailErr)

    return NextResponse.json({ success: true, id: proposal.id, emailed: !mailErr, url: proposalUrl })
  } catch (err) {
    if (err instanceof MigrationRequiredError) return migrationResponse(err)
    console.error('Create proposal error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}