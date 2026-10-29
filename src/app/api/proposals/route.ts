import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { requireAdmin } from '@/lib/admin-auth'
import { BRAND } from '@/lib/brand'
import * as mail from '@/lib/email/templates'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { STANDARD_DEPOSIT_PCT, STANDARD_HOURLY_RATE, TERMS_VERSION, parsePaymentPlan } from '@/lib/terms'
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
      depositPct, outOfScope, timeline, startDate, deliveryDate,
      revisions, hourlyRate, nextSteps, message, paymentPlan,
    } = body

    const plan = parsePaymentPlan(paymentPlan)
    if (!plan) {
      return NextResponse.json({ error: 'INVALID', message: 'Choose a payment schedule: standard (50/50) or milestones.' }, { status: 400 })
    }
    const validMilestones = Array.isArray(milestones) ? milestones : []
    if (plan === 'milestones' && validMilestones.length === 0) {
      return NextResponse.json({ error: 'INVALID', message: 'A milestone payment schedule needs at least one milestone.' }, { status: 400 })
    }

    await assertTermsSchema(['proposals', 'sows', 'contracts'])

    // Standard website projects are always 50% upfront, 50% at delivery.
    const pct = plan === 'standard' ? STANDARD_DEPOSIT_PCT : parseFloat(depositPct) || STANDARD_DEPOSIT_PCT
    const deposit = (Number(total) || 0) * (pct / 100)
    const balance = (Number(total) || 0) - deposit
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
        line_items: lineItems || [],
        total: total || 0,
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

    // Milestone projects keep their schedule in a linked SOW.
    if (plan === 'milestones') {
      const { error: sowError } = await supabaseAdmin.from('sows').insert({
        proposal_id: proposal.id,
        client_name: clientName,
        client_email: clientEmail,
        client_business: clientBusiness || null,
        project_title: projectTitle,
        project_type: projectType,
        understood: understood || null,
        out_of_scope: outOfScope || null,
        line_items: validMilestones,
        total: total || 0,
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