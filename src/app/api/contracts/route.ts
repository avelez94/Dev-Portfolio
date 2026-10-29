import { NextRequest, NextResponse } from 'next/server'
import { DOC_BRAND_VERSION, missingBrandColumn } from '@/lib/brand-version'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { Resend } from 'resend'
import { requireAdmin } from '@/lib/admin-auth'
import { BRAND } from '@/lib/brand'
import * as mail from '@/lib/email/templates'
import { STANDARD_DEPOSIT_PCT, STANDARD_HOURLY_RATE, TERMS_VERSION, balanceLabel, depositLabel, parsePaymentPlan } from '@/lib/terms'
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
      totalFee, deposit, balance, killFeePct, paymentMethod, lineItems,
      invoiceNumber, invoiceServiceDesc, invoiceDueDate, paymentPlan,
    } = body

    const plan = parsePaymentPlan(paymentPlan)
    if (!plan) {
      return NextResponse.json({ error: 'INVALID', message: 'Choose a payment schedule: standard (50/50) or milestones.' }, { status: 400 })
    }
    if (plan === 'standard') {
      const expected = (Number(totalFee) || 0) * (STANDARD_DEPOSIT_PCT / 100)
      if (Math.abs((Number(deposit) || 0) - expected) > 1 || Math.abs((Number(balance) || 0) - ((Number(totalFee) || 0) - expected)) > 1) {
        return NextResponse.json({ error: 'INVALID', message: 'Standard website projects use a 50% deposit and a 50% balance at delivery. Check the deposit and balance.' }, { status: 400 })
      }
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
      total_fee: totalFee || 0,
      deposit: deposit || 0,
      balance: balance || 0,
      kill_fee_pct: killFeePct || 25,
      payment_method: paymentMethod || 'Stripe, PayPal, Zelle, or Wise',
      line_items: lineItems || [],
      status: 'pending',
      // Store invoice details for auto-send on signing
      signer_name: null,
      signature_image: null,
      terms_version: TERMS_VERSION,
      hourly_rate: STANDARD_HOURLY_RATE,
      payment_plan: plan,
    }).select().single()

    throwIfMissingColumn(error, 'contracts')
    if (error || !contract) throw error

    // Store invoice data in a separate record so it's ready when they sign
    const depositInvoice = {
      client_id: null,
      invoice_number: invoiceNumber,
      invoice_type: 'project',
      total_fee: totalFee || 0,
      deposit_amount: deposit || 0,
      amount: totalFee || 0,
      due_date: invoiceDueDate || null,
      service_desc: invoiceServiceDesc || projectTitle,
      hours: 0,
      hourly_rate: STANDARD_HOURLY_RATE,
      status: 'awaiting_signature',
      notes: `contract_id:${contract.id}`,
    }
    // Stamped with the current document look; unstamped if the column doesn't exist yet.
    const stamped = await supabaseAdmin.from('invoices').insert({ ...depositInvoice, brand_version: DOC_BRAND_VERSION })
    if (stamped.error && missingBrandColumn(stamped.error)) await supabaseAdmin.from('invoices').insert(depositInvoice)

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://alantevelez.com'
    const contractUrl = `${siteUrl}/contracts/${contract.id}`

    const m = mail.contractReady({
      clientName, projectTitle, url: contractUrl,
      totalFee: Number(totalFee) || 0, deposit: Number(deposit) || 0, balance: Number(balance) || 0,
      depositLabel: depositLabel(contract), balanceLabel: balanceLabel(contract),
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