import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { SITE_URL, interestLabel, parseInterest } from '@/content/site'
import { clientIp, hit } from '@/lib/rate-limit'
import { BRAND } from '@/lib/brand'
import * as mail from '@/lib/email/templates'
import {
  INTAKE_FLOW_COLUMNS,
  detailsAsText,
  hashToken,
  isMissingColumn,
  looksLikeToken,
  newContinueToken,
  readDetails,
  shortDate,
} from '@/lib/intake'

/**
 * Two entry points, one lead:
 *  source "homepage"      short note. Saved as stage "inquiry" with a private
 *                          continue link. No booking link yet.
 *  source "questionnaire" detailed intake. With a valid continue token it
 *                          completes the same lead (no second lead, no second
 *                          "new inquiry" email). Otherwise it's a new lead.
 * A saved submission always returns success, even if email fails.
 */

const resend = new Resend(process.env.RESEND_API_KEY)
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

function str(v: unknown, max = 5000): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : ''
}

/** Submissions per IP per window (per server instance). */
const IP_LIMIT = 5
const IP_WINDOW_MS = 10 * 60 * 1000
/** Submissions per email address per hour (checked in the database). */
const EMAIL_LIMIT = 3
const EMAIL_WINDOW_MS = 60 * 60 * 1000
/** Faster than any person can fill in the homepage form. */
const MIN_FILL_MS = 2500
/** A short note and a questionnaire from the same email this close together are one lead. */
const RELATED_WINDOW_MS = 30 * 86400000

type Row = Record<string, unknown> & { id: string }

async function send(email: mail.Email, to: string | string[], replyTo?: string) {
  const { error } = await resend.emails.send({
    from: BRAND.from,
    to,
    ...(replyTo ? { replyTo } : {}),
    subject: email.subject,
    html: email.html,
    text: email.text,
  })
  if (error) throw error
}

/** Sends and reports success without ever failing the request. */
async function trySend(label: string, fn: () => Promise<void>) {
  try {
    await fn()
    return true
  } catch (err) {
    console.error(`Intake ${label} email failed:`, err)
    return false
  }
}

/** Insert with the intake flow columns; if the migration hasn't run, save the lead the original way. */
async function insertLead(row: Record<string, unknown>, legacyNotesExtra = '') {
  const first = await supabaseAdmin.from('intake_submissions').insert(row).select().single()
  if (!first.error) return { data: first.data as Row, migrated: true }
  if (!isMissingColumn(first.error)) throw first.error
  console.warn('intake_submissions is missing the intake flow columns; saving without them. Run supabase/migrations/20261028_intake_flow.sql.')
  const legacy = { ...row }
  INTAKE_FLOW_COLUMNS.forEach((c) => delete legacy[c])
  if (legacyNotesExtra) legacy.notes = [legacy.notes, legacyNotesExtra].filter(Boolean).join('\n\n')
  const second = await supabaseAdmin.from('intake_submissions').insert(legacy).select().single()
  if (second.error) throw second.error
  return { data: second.data as Row, migrated: false }
}

export async function POST(req: NextRequest) {
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
  const body = raw as Record<string, unknown>
  const source = body.source === 'homepage' ? 'homepage' : 'questionnaire'

  // Spam signals: a filled hidden field, or a form completed impossibly fast.
  // Answer like a success so bots learn nothing, but store and send nothing.
  const honeypot = str(body.company_fax, 200)
  const elapsed = typeof body.elapsed_ms === 'number' ? body.elapsed_ms : null
  // Someone finishing from their private link may breeze through prefilled steps, so the
  // timing check only applies without one.
  const hasLink = source === 'questionnaire' && looksLikeToken(body.continueToken)
  if (honeypot || (!hasLink && elapsed !== null && elapsed < MIN_FILL_MS)) {
    console.warn('Intake dropped as likely spam', { honeypot: Boolean(honeypot), elapsed })
    return NextResponse.json({ success: true, id: null, emailed: false })
  }

  const ipCheck = hit(`intake:${clientIp(req.headers)}`, IP_LIMIT, IP_WINDOW_MS)
  if (!ipCheck.ok) {
    return NextResponse.json(
      { error: 'Too many submissions. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(ipCheck.retryAfterSec) } }
    )
  }

  const name = str(body.name, 200)
  const email = str(body.email, 320)
  const business = str(body.business, 200)
  const interest = parseInterest(str(body.interest, 40))
  const type = str(body.type, 200) || (interest ? interestLabel(interest) ?? '' : '')
  const description = str(body.description)
  const budget = str(body.budget, 100)
  const timeline = str(body.timeline, 100)
  const heard = str(body.heard, 100) || (source === 'homepage' ? 'Portfolio site' : '')
  const priority = str(body.priority, 100)
  const anything = str(body.anything)

  if (!name || !email || !EMAIL_RE.test(email) || !type || !description || !heard) {
    return NextResponse.json({ error: 'Please fill in the required fields.' }, { status: 400 })
  }

  const continueToken = source === 'questionnaire' && looksLikeToken(body.continueToken) ? body.continueToken : null

  // Shared limit per email address. Completing an existing note doesn't add a row,
  // so it never counts against the person. If the count fails, let it through.
  if (!continueToken) {
    try {
      const since = new Date(Date.now() - EMAIL_WINDOW_MS).toISOString()
      const { count, error: countError } = await supabaseAdmin
        .from('intake_submissions')
        .select('id', { count: 'exact', head: true })
        .ilike('email', email)
        .gte('submitted_at', since)
      if (countError) throw countError
      if ((count ?? 0) >= EMAIL_LIMIT) {
        return NextResponse.json({ error: 'Too many submissions. Please try again later.' }, { status: 429 })
      }
    } catch (limitErr) {
      console.error('Intake email rate check failed:', limitErr)
    }
  }

  const adminUrl = `${SITE_URL}/admin`
  const base = {
    name,
    email,
    business: business || null,
    project_type: type,
    description,
    budget: budget || null,
    timeline: timeline || null,
    heard_from: heard,
    priority: priority || null,
    notes: anything || null,
    status: 'pending',
  }

  try {
    /* ---------------- Short homepage note ---------------- */
    if (source === 'homepage') {
      const website = str(body.website, 300) || (anything.match(/Existing website:\s*(\S+)/i)?.[1] ?? '')
      const tok = newContinueToken()
      const { data: saved, migrated } = await insertLead({
        ...base,
        stage: 'inquiry',
        source: 'homepage',
        interest,
        inquiry_note: description,
        details: website ? { website } : null,
        continue_token_hash: tok.hash,
        continue_token_expires_at: tok.expiresAt,
      })
      // Without the migration there's no saved token, so the plain questionnaire link is used.
      const next = migrated ? `/intake?continue=${tok.token}` : '/intake'
      const emailed = await trySend('client', () => send(mail.inquiryReceived({ name, continueUrl: `${SITE_URL}${next}` }), email))
      await trySend('admin', () => send(mail.inquiryAdmin({ ...base, type, website, adminUrl }), BRAND.email, email))
      return NextResponse.json({ success: true, id: saved.id, emailed, next })
    }

    /* ---------------- Detailed questionnaire ---------------- */
    const details = readDetails(body)
    if (interest) (details as Record<string, unknown>).interest = interestLabel(interest)
    const completedAt = new Date().toISOString()
    let saved: Row | null = null
    let continuedFrom: { note: string; sentAt: string } | null = null
    let relatedNote: { note: string; sentAt: string } | null = null

    if (continueToken) {
      const { data: match, error: findErr } = await supabaseAdmin
        .from('intake_submissions')
        .select('id, stage, inquiry_note, description, submitted_at, continue_token_expires_at')
        .eq('continue_token_hash', hashToken(continueToken))
        .maybeSingle()
      if (findErr && !isMissingColumn(findErr)) throw findErr
      const valid = match && match.stage === 'inquiry' && new Date(match.continue_token_expires_at as string).getTime() > Date.now()
      if (valid) {
        const { data, error } = await supabaseAdmin
          .from('intake_submissions')
          .update({
            ...base,
            stage: 'details',
            interest,
            details,
            details_completed_at: completedAt,
            continue_token_hash: null,
            continue_token_expires_at: null,
          })
          .eq('id', match.id)
          .eq('stage', 'inquiry') // only once, even if submitted twice at the same moment
          .select()
          .single()
        if (error) throw error
        saved = data as Row
        continuedFrom = { note: String(match.inquiry_note || match.description || ''), sentAt: shortDate(match.submitted_at as string) }
      }
    }

    if (!saved) {
      // Same email sent a short note recently but didn't use their link: link the two.
      let related: Row | null = null
      const since = new Date(Date.now() - RELATED_WINDOW_MS).toISOString()
      const rel = await supabaseAdmin
        .from('intake_submissions')
        .select('id, inquiry_note, description, submitted_at')
        .ilike('email', email)
        .eq('stage', 'inquiry')
        .gte('submitted_at', since)
        .order('submitted_at', { ascending: false })
        .limit(1)
      if (!rel.error && rel.data?.length) related = rel.data[0] as Row

      const { data, migrated } = await insertLead(
        {
          ...base,
          stage: 'details',
          source: 'questionnaire',
          interest,
          details,
          details_completed_at: completedAt,
          linked_submission_id: related?.id ?? null,
        },
        detailsAsText(details)
      )
      saved = data
      if (migrated && related) {
        await supabaseAdmin
          .from('intake_submissions')
          .update({ stage: 'merged', linked_submission_id: saved.id, continue_token_hash: null, continue_token_expires_at: null })
          .eq('id', related.id)
        relatedNote = { note: String(related.inquiry_note || related.description || ''), sentAt: shortDate(related.submitted_at as string) }
      }
    }

    const bookingPath = `/book?ref=${encodeURIComponent(saved.id)}`
    const emailed = await trySend('client', () => send(mail.detailsReceived({ name, bookingUrl: `${SITE_URL}${bookingPath}` }), email))
    await trySend('admin', () =>
      send(mail.detailsAdmin({ ...base, type, heard, details, adminUrl, continuedFrom, relatedNote }), BRAND.email, email)
    )
    return NextResponse.json({ success: true, id: saved.id, emailed, next: bookingPath })
  } catch (err) {
    console.error('Intake error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
