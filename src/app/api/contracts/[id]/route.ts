import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { balanceLabel, depositLabel, invoiceDepositLabel } from '@/lib/terms'
import { BRAND } from '@/lib/brand'
import * as mail from '@/lib/email/templates'
import { SITE_URL } from '@/content/site'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data, error } = await supabaseAdmin.from('contracts').select('*').eq('id', id).single()
  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { signatureImage, signerName } = await req.json()
    const ip = req.headers.get('x-forwarded-for') || 'unknown'

    const { data: contract } = await supabaseAdmin.from('contracts').select('*').eq('id', id).single()
    if (!contract) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (contract.status === 'signed') return NextResponse.json({ error: 'Already signed' }, { status: 400 })

    const signedAt = new Date().toISOString()
    const signedDate = new Date(signedAt).toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
    })

    await supabaseAdmin.from('contracts').update({
      status: 'signed',
      signature_image: signatureImage,
      signer_name: signerName,
      signed_at: signedAt,
      signer_ip: ip,
    }).eq('id', id)

    // Auto-create project record on signing
    await supabaseAdmin.from('projects').insert({
      name: contract.project_title + ' — ' + contract.client_name,
      type: contract.project_type,
      status: 'active',
      value: contract.total_fee,
      platform: 'direct',
      start_date: contract.start_date || new Date().toISOString().split('T')[0],
      end_date: contract.delivery_date || null,
      notes: `Client: ${contract.client_name} | ${contract.client_email}`,
    })

    // Find the pending invoice linked to this contract
    const { data: invoice } = await supabaseAdmin
      .from('invoices')
      .select('*')
      .like('notes', `contract_id:${id}%`)
      .single()

    // Update invoice status to awaiting_deposit and link client if found
    if (invoice) {
      await supabaseAdmin.from('invoices').update({
        status: 'awaiting_deposit',
      }).eq('id', invoice.id)
    }

    // Notify you
    const signedNote = mail.contractSignedAdmin({
      clientName: contract.client_name, projectTitle: contract.project_title, signerName, signedDate, ip,
      totalFee: contract.total_fee, deposit: contract.deposit, invoiceNumber: invoice?.invoice_number ?? null, adminUrl: `${SITE_URL}/admin`,
    })
    const { error: mailErr_signedNote } = await resend.emails.send({ from: BRAND.adminFrom, to: BRAND.email, subject: signedNote.subject, html: signedNote.html, text: signedNote.text })
    if (mailErr_signedNote) console.error('Email failed:', mailErr_signedNote)

    // Send signed contract confirmation to client
    const signedCopy = mail.contractSignedClient({
      clientName: contract.client_name, projectTitle: contract.project_title, signerName, signedDate,
      totalFee: contract.total_fee, deposit: contract.deposit, balance: contract.balance,
      depositLabel: depositLabel(contract), balanceLabel: balanceLabel(contract),
    })
    const { error: mailErr_signedCopy } = await resend.emails.send({ from: BRAND.from, to: contract.client_email, subject: signedCopy.subject, html: signedCopy.html, text: signedCopy.text })
    if (mailErr_signedCopy) console.error('Email failed:', mailErr_signedCopy)

    // Auto-send deposit invoice if we have the data
    if (invoice) {
      const depositMail = mail.depositInvoice({
        clientName: contract.client_name, projectTitle: contract.project_title,
        invoiceNumber: invoice.invoice_number, serviceDesc: invoice.service_desc || contract.project_title,
        dueDate: invoice.due_date ? new Date(invoice.due_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'Within 7 days',
        totalFee: Number(invoice.total_fee), deposit: Number(invoice.deposit_amount), balance: Number(invoice.total_fee) - Number(invoice.deposit_amount),
        depositLabel: invoiceDepositLabel(contract), balanceLabel: balanceLabel(contract), paymentMethod: contract.payment_method,
      })
      const { error: mailErr_depositMail } = await resend.emails.send({ from: BRAND.from, to: contract.client_email, cc: BRAND.email, subject: depositMail.subject, html: depositMail.html, text: depositMail.text })
      if (mailErr_depositMail) console.error('Email failed:', mailErr_depositMail)
    }

    // Send signed contract PDF
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://alantevelez.com'
    await fetch(`${siteUrl}/api/contracts/send-signed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contractId: id }),
    }).catch(e => console.error('Send signed contract error:', e))

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Contract sign error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}