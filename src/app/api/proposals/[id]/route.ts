import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { proposalPaymentLines, usesCurrentTerms } from '@/lib/terms'
import { Resend } from 'resend'
import { BRAND } from '@/lib/brand'
import * as mail from '@/lib/email/templates'
import { SITE_URL } from '@/content/site'
import { NO_STORE, UUID_RE, publicProposal } from '@/lib/public-docs'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'Not found' }, { status: 404, headers: NO_STORE })
  const { data, error } = await supabaseAdmin.from('proposals').select('*').eq('id', id).single()
  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404, headers: NO_STORE })
  const { data: sow } = await supabaseAdmin.from('sows').select('line_items').eq('proposal_id', id).maybeSingle()
  return NextResponse.json(publicProposal(data, sow?.line_items), { headers: NO_STORE })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    if (!UUID_RE.test(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const { action, declineReason } = await req.json()
    if (action !== 'accepted' && action !== 'declined') return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    const ip = req.headers.get('x-forwarded-for') || 'unknown'

    const { data: proposal } = await supabaseAdmin.from('proposals').select('*').eq('id', id).single()
    if (!proposal) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (proposal.status !== 'pending') return NextResponse.json({ error: 'Already responded' }, { status: 400 })

    await supabaseAdmin.from('proposals').update({
      status: action,
      responded_at: new Date().toISOString(),
      response_ip: ip,
      decline_reason: declineReason || null,
    }).eq('id', id)

    // Move client to proposal_sent stage if accepted
    if (action === 'accepted' && proposal.client_email) {
      const { data: client } = await supabaseAdmin
        .from('clients')
        .select('id, pipeline_stage')
        .eq('email', proposal.client_email)
        .single()
      if (client && client.pipeline_stage === 'discovery_call') {
        await supabaseAdmin.from('clients').update({ pipeline_stage: 'proposal_sent' }).eq('id', client.id)
      }
    }

    if (action === 'accepted') {
      const adminNote = mail.responseAdmin({ kind: 'Proposal', action: 'accepted', clientName: proposal.client_name, clientEmail: proposal.client_email, projectTitle: proposal.project_title, total: proposal.total, adminUrl: `${SITE_URL}/admin` })
      const { error: mailErr_adminNote } = await resend.emails.send({ from: BRAND.adminFrom, to: BRAND.email, subject: adminNote.subject, html: adminNote.html, text: adminNote.text })
      if (mailErr_adminNote) console.error('Email failed:', mailErr_adminNote)
      const thanks = mail.proposalAcceptedClient({ proposal })
      const { error: mailErr_thanks } = await resend.emails.send({ from: BRAND.from, to: proposal.client_email, subject: thanks.subject, html: thanks.html, text: thanks.text })
      if (mailErr_thanks) console.error('Email failed:', mailErr_thanks)
      // Full proposal copy to both. Payment wording follows the proposal's own terms version.
      const accepted = { ...proposal, responded_at: proposal.responded_at || new Date().toISOString() }
      const copy = mail.proposalCopy({
        proposal: accepted,
        paymentTitle: usesCurrentTerms(proposal) ? 'Payment schedule' : `Deposit (${proposal.deposit_pct}%)`,
        paymentLines: usesCurrentTerms(proposal)
          ? proposalPaymentLines(proposal, Number(proposal.total))
          : [`$${(proposal.total * proposal.deposit_pct / 100).toLocaleString()} due at project start`],
      })
      const { error: mailErr_copy } = await resend.emails.send({ from: BRAND.from, to: [proposal.client_email, BRAND.email], subject: copy.subject, html: copy.html, text: copy.text })
      if (mailErr_copy) console.error('Email failed:', mailErr_copy)
    } else {
      const declined = mail.responseAdmin({ kind: 'Proposal', action: 'declined', clientName: proposal.client_name, clientEmail: proposal.client_email, projectTitle: proposal.project_title, total: proposal.total, declineReason, adminUrl: `${SITE_URL}/admin` })
      const { error: mailErr_declined } = await resend.emails.send({ from: BRAND.adminFrom, to: BRAND.email, subject: declined.subject, html: declined.html, text: declined.text })
      if (mailErr_declined) console.error('Email failed:', mailErr_declined)
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Proposal respond error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
