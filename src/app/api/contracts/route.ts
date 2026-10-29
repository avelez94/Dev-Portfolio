import { NextRequest, NextResponse } from 'next/server'
import { DOC_BRAND_VERSION, missingBrandColumn } from '@/lib/brand-version'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { Resend } from 'resend'
import { requireAdmin } from '@/lib/admin-auth'
import { BRAND } from '@/lib/brand'
import * as mail from '@/lib/email/templates'
import { STANDARD_HOURLY_RATE, TERMS_VERSION, balanceLabel, depositLabel } from '@/lib/terms'
import { checkSchedule } from '@/lib/payment-schedule'
import { MigrationRequiredError, assertTermsSchema, migrationResponse, throwIfMissingColumn } from '@/lib/terms-schema'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  const denied = requireAdmin(req)
  if (denied) return denied
  try {
    const body = await req.json()
    const {
      clientName, clientEmail, clientBusiness,
      projectTitle, projectType, startDate, deliveryDate,
      totalFee, killFeePct, paymentMethod, milestones, hourlyRate, clientId,
      invoiceNumber, invoiceServiceDesc, invoiceDueDate, paymentPlan,
    } = body

    // New contracts use the current payment policy, checked here to the cent: the 50% deposit
    // and the milestones for the remaining 50% (amounts sent by the browser are recalculated).
    if (paymentPlan !== 'milestone_balance') {
      return NextResponse.json({ error: 'INVALID', message: 'New contracts use the current payment schedule: a 50% deposit and milestones for the remaining 50%.' }, { status: 400 })
    }
    const check = checkSchedule(totalFee, Array.isArray(milestones) ? milestones : [])
    if (!check.ok) return NextResponse.json({ error: 'INVALID', message: check.problems.join(' ') }, { status: 400 })
    if (!invoiceNumber || typeof invoiceNumber !== 'string') return NextResponse.json({ error: 'INVALID', message: 'Add the deposit invoice number.' }, { status: 400 })
    const { total, deposit, balance, milestones: schedule } = check.schedule
    const plan = 'milestone_balance'
    // The rate agreed in the proposal carries over; otherwise the standard rate.
    const rate = Number(hourlyRate) > 0 ? Number(hourlyRate) : STANDARD_HOURLY_RATE

    // One invoice schedule per invoice number, so a double submit can't create two.
    const dup = await supabaseAdmin.from('invoices').select('id').eq('invoice_number', invoiceNumber).limit(1)
    if (dup.data?.length) return NextResponse.json({ error: 'INVALID', message: `Invoice number ${invoiceNumber} is already used. Choose a new one.` }, { status: 409 })
    let linkedClient: string | null = null
    if (clientId) {
      const c = await supabaseAdmin.from('clients').select('id').eq('id', clientId).maybeSingle()
      linkedClient = c.data?.id ?? null
    }

    await assertTermsSchema(['proposals', 'sows', 'contracts'])

    const { data: contract, error } = await supabaseAdmin.from('contracts').insert({
      client_name: clientName,
      client_email: clientEmail,
      client_business: clientBusiness || null,
      project_title: projectTitle,
      project_type: projectType,
      start_date: startDate || null,
      delivery_date: deliveryDate || null,
      total_fee: total,
      deposit,
      balance,
      kill_fee_pct: killFeePct || 25,
      payment_method: paymentMethod || 'Stripe, PayPal, Zelle, or Wise',
      line_items: schedule,
      status: 'pending',
      // Store invoice details for auto-send on signing
      signer_name: null,
      signature_image: null,
      terms_version: TERMS_VERSION,
      hourly_rate: rate,
      payment_plan: plan,
    }).select().single()

    throwIfMissingColumn(error, 'contracts')
    if (error || !contract) throw error

    // The linked invoice schedule, ready for when they sign: the deposit, then each milestone.
    // Nothing is charged automatically; each milestone is invoiced by you when it's reached.
    const scheduleInvoice = {
      client_id: linkedClient,
      invoice_number: invoiceNumber,
      invoice_type: 'milestone',
      total_fee: total,
      deposit_amount: deposit,
      amount: total,
      due_date: invoiceDueDate || null,
      service_desc: invoiceServiceDesc || projectTitle,
      hours: 0,
      hourly_rate: rate,
      status: 'awaiting_signature',
      notes: `contract_id:${contract.id}`,
    }
    // Stamped with the current document look; unstamped if the column doesn't exist yet.
    let inv = await supabaseAdmin.from('invoices').insert({ ...scheduleInvoice, brand_version: DOC_BRAND_VERSION }).select().single()
    let stamp = true
    if (inv.error && missingBrandColumn(inv.error)) { inv = await supabaseAdmin.from('invoices').insert(scheduleInvoice).select().single(); stamp = false }
    if (inv.error || !inv.data) throw inv.error
    const rows = [
      { invoice_id: inv.data.id, name: 'Deposit (50%)', deliverables: 'Due before work begins', due_date: invoiceDueDate || null, fee: deposit, status: 'pending' },
      ...schedule.map((m) => ({ invoice_id: inv.data.id, name: m.name, deliverables: m.deliverables, due_date: m.dueDate, fee: m.fee, status: 'pending' })),
    ].map((r, i) => ({ ...r, created_at: new Date(Date.now() + i).toISOString(), ...(stamp ? { brand_version: DOC_BRAND_VERSION } : {}) })) // kept in schedule order
    const ms = await supabaseAdmin.from('invoice_milestones').insert(rows)
    if (ms.error) throw ms.error

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://alantevelez.com'
    const contractUrl = `${siteUrl}/contracts/${contract.id}`

    const m = mail.contractReady({
      clientName, projectTitle, url: contractUrl,
      totalFee: total, deposit, balance,
      depositLabel: depositLabel(contract), balanceLabel: balanceLabel(contract), schedule,
    })
    const { error: mailErr } = await resend.emails.send({ from: BRAND.from, to: clientEmail, cc: BRAND.email, subject: m.subject, html: m.html, text: m.text })
    // The document is saved. If the email fails, say so instead of failing, so it isn't issued twice.
    if (mailErr) console.error('Document email failed:', mailErr)

    return NextResponse.json({ success: true, id: contract.id, emailed: !mailErr, url: contractUrl })
  } catch (err) {
    if (err instanceof MigrationRequiredError) return migrationResponse(err)
    console.error('Create contract error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}