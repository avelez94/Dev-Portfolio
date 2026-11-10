/**
 * Care agreements: the workflow from a confirmed technical scope to payment.
 *
 *   1. You confirm the technical scope (sites.ts confirmSite).
 *   2. The client gets a persistent private agreement link
 *      (/care/agreement/<token>); the token never changes for the website.
 *   3. The client reads the agreement (parties, plan, price, scope, terms) and
 *      signs it: typed name, drawn signature, and an explicit agreement.
 *   4. The signed PDF is stored privately and emailed to the client and you.
 *   5. Payment unlocks: the same page opens a Stripe Checkout made on demand
 *      for the verified price. Only a signed agreement that still matches the
 *      confirmed scope, plan and price can open checkout.
 *   6. A verified successful payment queues and dispatches the scan
 *      (stripe.ts, cycles.ts). Reports are still approved and sent by hand.
 *
 * A change to the scope, plan or price closes any unsigned version and the
 * open checkout link; a new version must be issued and signed before payment.
 * Signed versions are never altered. Copy rule: no dashes in client text.
 */
import { createHash, randomBytes } from 'node:crypto'
import { Resend } from 'resend'
import { db, must, CareError, logActivity, putObject, getObject, type Row } from './db'
import { appUrl, clientEmailAllowed } from './config'
import { plan as planInfo } from './plans'
import { setupHash } from './sites'
import { verifyCheckoutPrice, expectedCharge, openCheckout, closeCheckout, stripeConfigured, PAYMENT_NOT_CONNECTED, type CheckoutLink } from './stripe'
import { agreementLink, agreementSignedClient, agreementSignedOwner } from './emails'
import { agreementPdf, type SignatureFacts } from './agreement-pdf'
import { ownerEmail } from './notify'
import { BRAND } from '@/lib/brand'
import { CARE_AGREEMENT_TERMS, CARE_AGREEMENT_VERSION, CARE_QUEUED_LINE, CARE_TERMS_VERSION, CARE_CHECKOUT_DISCLOSURE, type CareTermsSection } from '@/content/care-terms'

export const AGREEMENTS_BUCKET = 'care-agreements'
export const TOKEN_RE = /^[A-Za-z0-9_-]{32}$/

export type AgreementSnapshot = {
  version: string
  issued_on: string
  client: { name: string; business: string; email: string }
  site: { label: string; url: string; domains: string[] }
  plan: { id: string; name: string; included_minutes: number }
  price: { amount_cents: number; currency: 'USD'; interval: 'month'; label: string }
  scope: { pages: { label: string; url: string }[]; destinations: { label: string; url: string; kind: string }[]; checks: { label: string; category: string }[] }
  terms: CareTermsSection[]
  billing_disclosure: string
}

const usd = (cents: number) => `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 })}`
/** JSON with sorted keys, so a snapshot read back from jsonb hashes the same as when it was built. */
const canonical = (v: unknown): string => Array.isArray(v) ? `[${v.map(canonical).join(',')}]`
  : v && typeof v === 'object' ? `{${Object.keys(v as object).sort().filter((k) => (v as Row)[k] !== undefined).map((k) => `${JSON.stringify(k)}:${canonical((v as Row)[k])}`).join(',')}}`
  : JSON.stringify(v ?? null)
/** Content fingerprint of a snapshot (sorted keys, so stored jsonb hashes the same). */
export const snapshotHash = (v: unknown) => hashOf(v)
const hashOf = (v: unknown) => createHash('sha256').update(canonical(v)).digest('hex')
const setupOf = (site: Row) => setupHash(site as Parameters<typeof setupHash>[0])

/** What the client reads and signs, built from the confirmed setup. */
export function buildSnapshot(site: Row, client: Row): AgreementSnapshot {
  const p = planInfo(site.plan)
  const cents = expectedCharge(site).amount_cents
  return {
    version: CARE_AGREEMENT_VERSION,
    issued_on: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/New_York' }),
    client: { name: site.recipient_name || client.name || '', business: client.business || '', email: String(site.recipient_email || client.email || '') },
    site: { label: site.label, url: site.site_url, domains: site.approved_domains || [] },
    plan: { id: p.id, name: p.name, included_minutes: p.includedMinutes },
    price: { amount_cents: cents, currency: 'USD', interval: 'month', label: usd(cents) },
    scope: {
      pages: (site.pages?.length ? site.pages : [{ label: 'Home', url: site.site_url }]).map((x: Row) => ({ label: x.label, url: x.url })),
      destinations: (site.destinations || []).map((d: Row) => ({ label: d.label, url: d.url, kind: d.kind })),
      checks: (site.manual_checklist || []).map((m: Row) => ({ label: m.label, category: m.category })),
    },
    terms: CARE_AGREEMENT_TERMS,
    billing_disclosure: CARE_CHECKOUT_DISCLOSURE,
  }
}

/** The parts of a snapshot that decide whether a signature still covers the current setup. */
const coverage = (s: AgreementSnapshot) => hashOf({ v: s.version, c: s.client, si: s.site, p: s.plan, pr: s.price, sc: s.scope, t: s.terms })

async function loadSite(siteId: string) {
  const site = must(await db.from('care_sites').select('*').eq('id', siteId).single(), 'Website')
  const client = must(await db.from('clients').select('id, name, email, business').eq('id', site.client_id).single(), 'Client')
  return { site, client }
}

async function currentAgreement(site: Row): Promise<Row | null> {
  if (!site.agreement_id) return null
  return (await db.from('care_agreements').select('*').eq('id', site.agreement_id).maybeSingle()).data
}

/** True when this signed agreement still covers the website's confirmed scope, plan and price. */
function covers(a: Row | null, site: Row, client: Row): boolean {
  if (!a || a.status !== 'signed' || a.terms_version !== CARE_AGREEMENT_VERSION) return false
  if (site.enrollment_status !== 'confirmed' || !site.confirmed_hash || site.confirmed_hash !== setupOf(site) || a.setup_hash !== site.confirmed_hash) return false
  return coverage(a.snapshot) === coverage(buildSnapshot(site, client))
}

/** Problems that stop an agreement being issued or sent. The technical scope must be confirmed first. */
async function issueProblems(site: Row, client: Row): Promise<string[]> {
  const p: string[] = []
  if (site.enrollment_status === 'ended') return ['Care for this website has ended.']
  if (site.enrollment_status === 'paused') p.push('Care for this website is paused. Resume it first.')
  else if (site.enrollment_status !== 'confirmed') p.push(site.confirmed_at ? 'The setup changed since it was confirmed. Confirm the technical scope again first.' : 'Confirm the technical scope first: website, client authorization and the manual checklist.')
  else if (site.confirmed_hash !== setupOf(site)) p.push('The setup changed since it was confirmed. Confirm the technical scope again first.')
  if (!site.recipient_email && !client.email) p.push('There is no recipient email. Add one in Website settings.')
  // The Stripe price is checked against the agreed price whenever Stripe is connected. Until then the
  // agreement can be issued and signed; checkout verifies the price again before anyone can pay.
  if (stripeConfigured()) {
    let check
    try { check = await verifyCheckoutPrice(site) } catch (e) { check = { ok: false, problems: [String((e as Error).message || e)] } }
    if (!check.ok) p.push(...check.problems)
  }
  return p
}

/**
 * The website's private link token. Created once and kept; if the owner
 * turned the link off, a new one is only issued by Replace link (never as a
 * side effect of sending or issuing a version).
 */
async function ensureToken(site: Row, actor = 'system', opts: { allowAfterRevoke?: boolean } = {}): Promise<string> {
  if (site.agreement_token) {
    // Links issued before link records existed get one now.
    await db.from('care_agreement_links').upsert({ site_id: site.id, token: site.agreement_token, created_by: 'backfill', sent_at: site.agreement_sent_at || null, sent_to: site.agreement_sent_to || null }, { onConflict: 'token', ignoreDuplicates: true })
    return site.agreement_token
  }
  if (!opts.allowAfterRevoke) {
    const prior = (await db.from('care_agreement_links').select('id').eq('site_id', site.id).eq('status', 'revoked').limit(1)).data || []
    if (prior.length) throw new CareError('The agreement link for this website is turned off. Choose Replace link to issue a new private link first.', 409)
  }
  const token = randomBytes(24).toString('base64url')
  const upd = await db.from('care_sites').update({ agreement_token: token, agreement_sent_at: null, agreement_sent_to: null, updated_at: new Date().toISOString() }).eq('id', site.id).is('agreement_token', null).select('agreement_token')
  if (upd.data?.length) {
    await db.from('care_agreement_links').insert({ site_id: site.id, token, created_by: actor })
    return token
  }
  return must(await db.from('care_sites').select('agreement_token').eq('id', site.id).single(), 'Website').agreement_token
}

const tail = (t: string) => `…${String(t).slice(-6)}`

/**
 * Turns the website's private link off. The server refuses it from then on
 * for viewing, signing and payment, and any open checkout started from it is
 * closed so it can't be paid. Signed agreements, their PDFs and the history
 * stay with the website.
 */
export async function revokeLink(siteId: string, body: { reason?: string; confirm?: boolean }, actor: string, replacing = false) {
  const site = must(await db.from('care_sites').select('*').eq('id', siteId).single(), 'Website')
  if (!site.agreement_token) throw new CareError('This website has no active agreement link.', 409)
  const reason = String(body.reason || '').trim().slice(0, 300)
  if (!replacing && body.confirm !== true) throw new CareError('Tick the box to confirm the client’s current link will stop working.', 422)
  if (reason.length < 3) throw new CareError('Say why the link is being turned off (for example, sent to the wrong address).', 422)
  await ensureToken(site, actor) // make sure the link has a record
  const now = new Date().toISOString()
  const checkoutSession = site.checkout_session_id as string | null
  const closed = await closeCheckout(siteId, replacing ? 'Agreement link replaced' : 'Agreement link turned off', actor)
  await db.from('care_agreement_links').update({
    status: 'revoked', revoked_at: now, revoked_by: actor, revoked_reason: reason, sent_at: site.agreement_sent_at || null, sent_to: site.agreement_sent_to || null,
    closed_checkout_session: closed ? checkoutSession : null,
  }).eq('token', site.agreement_token)
  await db.from('care_sites').update({ agreement_token: null, agreement_sent_at: null, agreement_sent_to: null, updated_at: now }).eq('id', siteId).eq('agreement_token', site.agreement_token)
  await logActivity({ site_id: siteId, actor, action: 'agreement_link_revoked', detail: { link: tail(site.agreement_token), reason, replacing, closed_checkout: closed ? checkoutSession : null } })
  return { revoked: tail(site.agreement_token), closed_checkout: closed }
}

/**
 * Replaces the private link: the old one stops working and a new one is
 * issued for the same agreement. Nothing is signed again because the link
 * changed: a signed agreement stays signed and payment stays unlocked on the
 * new link. Send the new link with Send link.
 */
export async function replaceLink(siteId: string, body: { reason?: string }, actor: string) {
  const site = must(await db.from('care_sites').select('*').eq('id', siteId).single(), 'Website')
  if (site.enrollment_status === 'ended') throw new CareError('Care for this website has ended.', 409)
  const oldToken = site.agreement_token as string | null
  if (oldToken) await revokeLink(siteId, body, actor, true)
  else {
    const prior = (await db.from('care_agreement_links').select('id').eq('site_id', siteId).limit(1)).data || []
    if (!prior.length) throw new CareError('This website has no agreement link yet. Send the agreement first.', 409)
  }
  const fresh = must(await db.from('care_sites').select('*').eq('id', siteId).single(), 'Website')
  const token = await ensureToken(fresh, actor, { allowAfterRevoke: true })
  const link = (await db.from('care_agreement_links').select('id').eq('token', token).single()).data
  if (oldToken && link) await db.from('care_agreement_links').update({ replaced_by: link.id }).eq('token', oldToken)
  else if (link) {
    const last = (await db.from('care_agreement_links').select('id').eq('site_id', siteId).eq('status', 'revoked').is('replaced_by', null).order('revoked_at', { ascending: false }).limit(1)).data?.[0]
    if (last) await db.from('care_agreement_links').update({ replaced_by: link.id }).eq('id', last.id)
  }
  await logActivity({ site_id: siteId, actor, action: 'agreement_link_replaced', detail: { old: oldToken ? tail(oldToken) : null, new: tail(token) } })
  return { link: agreementUrl(token), token }
}

/** The website's link records, newest first. Old tokens are shown only by their last characters. */
async function linkHistory(siteId: string) {
  const rows = (await db.from('care_agreement_links').select('id, token, status, created_at, created_by, sent_at, sent_to, revoked_at, revoked_by, revoked_reason, replaced_by, closed_checkout_session').eq('site_id', siteId).order('created_at', { ascending: false }).limit(20)).data || []
  return rows.map((r: Row) => ({ ...r, token: tail(r.token) }))
}

export const agreementUrl = (token: string) => `${appUrl()}/care/agreement/${token}`

/**
 * The current agreement version for the website: the signed one if it still
 * covers the setup, the open one if it matches, otherwise a new version
 * (closing the old open one). Never changes a signed version.
 */
export async function issueAgreement(siteId: string, actor: string) {
  const { site, client } = await loadSite(siteId)
  const problems = await issueProblems(site, client)
  if (problems.length) throw new CareError(`The agreement can’t be issued yet. ${problems.join(' ')}`, 409)
  const token = await ensureToken(site)
  const cur = await currentAgreement(site)
  const snap = buildSnapshot(site, client)
  if (cur && cur.status === 'signed' && covers(cur, site, client)) return { agreement: cur, token, created: false }
  if (cur && cur.status === 'issued' && cur.setup_hash === site.confirmed_hash && coverage(cur.snapshot) === coverage(snap)) return { agreement: cur, token, created: false }
  await supersedeOpen(siteId, 'A new version was issued for the current scope and price.', actor)
  const ins = await db.from('care_agreements').insert({
    site_id: siteId, client_id: site.client_id, terms_version: CARE_AGREEMENT_VERSION, snapshot: snap, snapshot_hash: hashOf(snap), setup_hash: site.confirmed_hash,
    amount_cents: snap.price.amount_cents, issued_by: actor,
  }).select('*').single()
  const a = must(ins, 'Agreement')
  await db.from('care_sites').update({ agreement_id: a.id, updated_at: new Date().toISOString() }).eq('id', siteId)
  await logActivity({ site_id: siteId, actor, action: 'agreement_issued', detail: { agreement: a.id, version: CARE_AGREEMENT_VERSION, amount_cents: snap.price.amount_cents } })
  return { agreement: a, token, created: true }
}

async function supersedeOpen(siteId: string, reason: string, actor: string) {
  const open = (await db.from('care_agreements').update({ status: 'superseded', superseded_at: new Date().toISOString(), superseded_reason: reason })
    .eq('site_id', siteId).eq('status', 'issued').select('id')).data || []
  for (const o of open) await logActivity({ site_id: siteId, actor, action: 'agreement_superseded', detail: { agreement: o.id, reason } })
  return open.length
}

/**
 * After the scope, plan or price changes: an unsigned version that no longer
 * matches is closed, and an open checkout link is closed so it can't be paid.
 * A signed version stays as signed; payment stays locked until a new version
 * is signed (see covers()).
 */
export async function reconcileAgreement(siteId: string, reason: string, actor: string) {
  const { site, client } = await loadSite(siteId)
  const cur = await currentAgreement(site)
  if (!cur) return { changed: false }
  const stillCovers = cur.status === 'signed' ? covers(cur, site, client) : cur.status === 'issued' && cur.setup_hash === site.confirmed_hash && site.confirmed_hash === setupOf(site) && site.enrollment_status === 'confirmed' && coverage(cur.snapshot) === coverage(buildSnapshot(site, client))
  if (stillCovers) return { changed: false }
  if (cur.status === 'issued') await supersedeOpen(siteId, reason, actor)
  if (!site.stripe_subscription_id) await closeCheckout(siteId, reason, actor)
  await logActivity({ site_id: siteId, actor, action: 'agreement_outdated', detail: { agreement: cur.id, reason } })
  return { changed: true }
}

/* ------------------------------------------------------------------ */
/* Owner: status, sending the link, signed copies                       */
/* ------------------------------------------------------------------ */

export type AgreementState = 'not_ready' | 'ready' | 'sent' | 'viewed' | 'signed' | 'outdated' | 'paid'

/** Where the website is in the agreement workflow, for the admin. */
export async function agreementStatus(siteId: string) {
  const { site, client } = await loadSite(siteId)
  const cur = await currentAgreement(site)
  const history = (await db.from('care_agreements').select('id, terms_version, status, issued_at, signed_at, signer_name, signed_email_status, signed_emailed_at, signed_email_error, superseded_reason, amount_cents, first_viewed_at, signed_pdf_path')
    .eq('site_id', siteId).order('issued_at', { ascending: false }).limit(20)).data || []
  const subscribed = !!site.stripe_subscription_id && !['canceled', 'incomplete_expired'].includes(site.subscription_status || '')
  const problems = cur && cur.status === 'signed' && covers(cur, site, client) ? [] : await issueProblems(site, client)
  let state: AgreementState
  if (cur?.status === 'signed' && covers(cur, site, client)) state = subscribed ? 'paid' : 'signed'
  else if (cur?.status === 'signed' || (subscribed && !cur)) state = 'outdated'
  else if (cur?.status === 'issued' && site.agreement_sent_at) state = cur.first_viewed_at ? 'viewed' : 'sent'
  else state = problems.length ? 'not_ready' : 'ready'
  const recipient = String(site.recipient_email || client.email || '')
  return {
    state, problems, version: CARE_AGREEMENT_VERSION,
    payment: stripeConfigured() ? { open: true, message: '' } : { open: false, message: PAYMENT_NOT_CONNECTED },
    scope_confirmed: site.enrollment_status === 'confirmed' && !!site.confirmed_hash && site.confirmed_hash === setupOf(site),
    link: site.agreement_token ? agreementUrl(site.agreement_token) : null,
    recipient: { name: site.recipient_name || client.name || '', email: recipient, allowed: recipient ? clientEmailAllowed(recipient) : { ok: false, reason: 'No recipient email.' } },
    sent: site.agreement_sent_at ? { at: site.agreement_sent_at, to: site.agreement_sent_to } : null,
    current: cur ? { id: cur.id, status: cur.status, issued_at: cur.issued_at, signed_at: cur.signed_at, signer_name: cur.signer_name, amount_cents: cur.amount_cents, email_status: cur.signed_email_status, email_error: cur.signed_email_error, has_pdf: !!cur.signed_pdf_path, viewed_at: cur.first_viewed_at } : null,
    history: history.map(({ signed_pdf_path, ...h }: Row) => ({ ...h, has_pdf: !!signed_pdf_path })),
    links: await linkHistory(siteId),
    link_off: !site.agreement_token && (await db.from('care_agreement_links').select('id').eq('site_id', siteId).limit(1)).data?.length ? true : false,
    preview: buildSnapshot(site, client),
  }
}

let mailer: Resend | null = null
const resend = () => (mailer ??= new Resend(process.env.RESEND_API_KEY))

/**
 * Emails the client their persistent agreement link, after you type the
 * recipient address. The link is the same every time; sending again is a
 * reminder and needs `resend: true`.
 */
export async function sendAgreementLink(siteId: string, body: { confirm_email?: string; resend?: boolean }, actor: string) {
  const { site, client } = await loadSite(siteId)
  const to = String(site.recipient_email || client.email || '').trim()
  if (!to) throw new CareError('There is no recipient email. Add one in Website settings.', 422)
  if (String(body.confirm_email || '').trim().toLowerCase() !== to.toLowerCase()) throw new CareError(`Type the recipient address exactly (${to}) to confirm.`, 422)
  const allowed = clientEmailAllowed(to)
  if (!allowed.ok) throw new CareError(allowed.reason!, 403)
  const { agreement, token, created } = await issueAgreement(siteId, actor)
  const subscribed = !!site.stripe_subscription_id && !['canceled', 'incomplete_expired'].includes(site.subscription_status || '')
  if (agreement.status === 'signed' && (subscribed || site.agreement_sent_at)) throw new CareError(subscribed ? 'The client already signed and their plan is active. There is nothing to send.' : 'The client already signed the current agreement. Their payment step is open on the same link.', 409)
  // A replacement link: the earlier one no longer works, and a signed agreement isn't signed again.
  const replaced = ((await db.from('care_agreement_links').select('id').eq('site_id', siteId).eq('status', 'revoked').limit(1)).data || []).length > 0
  if (!created && site.agreement_sent_at && !body.resend) throw new CareError(`The agreement link was already sent to ${site.agreement_sent_to}. Choose Send again to send a reminder with the same link.`, 409)
  const snap = agreement.snapshot as AgreementSnapshot
  const m = agreementLink({ name: snap.client.name, siteLabel: snap.site.label, siteUrl: snap.site.url, planName: snap.plan.name, amount: snap.price.label, includedMinutes: snap.plan.included_minutes, link: agreementUrl(token), version: snap.version, queuedLine: CARE_QUEUED_LINE, replaced, signed: agreement.status === 'signed', paymentOpen: stripeConfigured() })
  const { data, error } = await resend().emails.send(
    { from: BRAND.from, to, replyTo: BRAND.email, subject: m.subject, html: m.html, text: m.text },
    { idempotencyKey: `care-agreement-${agreement.id}-${token.slice(-6)}-${body.resend ? Date.now() : 'first'}` },
  )
  if (error) throw new CareError(`The agreement link wasn’t sent: ${error.message || 'the email provider refused it'}. You can retry.`, 502)
  const now = new Date().toISOString()
  await db.from('care_sites').update({ agreement_sent_at: now, agreement_sent_to: to, updated_at: now }).eq('id', siteId)
  await logActivity({ site_id: siteId, actor, action: 'agreement_link_sent', detail: { to, agreement: agreement.id, resend: !!body.resend, replaced, link: tail(token), provider_id: data?.id || null } })
  return { sent_to: to, agreement_id: agreement.id, link: agreementUrl(token) }
}

/** One issued version as the client read it, for the admin (no signature image or address). */
export async function agreementVersion(siteId: string, agreementId: string) {
  const a = must(await db.from('care_agreements').select('id, terms_version, status, snapshot, snapshot_hash, amount_cents, issued_at, signed_at, signer_name, signer_email, superseded_at, superseded_reason, signed_pdf_path, signed_email_status').eq('id', agreementId).eq('site_id', siteId).single(), 'Agreement')
  const { signed_pdf_path, ...rest } = a
  return { ...rest, has_pdf: !!signed_pdf_path, pdf: signed_pdf_path ? `/api/care/admin/sites/${siteId}/agreements/${a.id}/pdf` : null }
}

/** The stored signed PDF (admin download). */
export async function signedPdf(siteId: string, agreementId: string) {
  const a = must(await db.from('care_agreements').select('*').eq('id', agreementId).eq('site_id', siteId).single(), 'Agreement')
  if (a.status !== 'signed' || !a.signed_pdf_path) throw new CareError('This agreement has not been signed.', 404)
  return { bytes: await getObject(AGREEMENTS_BUCKET, a.signed_pdf_path), name: `Website_Care_Agreement_${a.terms_version}_signed.pdf` }
}

/** Emails the signed PDF to the client and you. Used right after signing, and to retry a failed send. */
export async function emailSignedCopy(agreementId: string, actor: string) {
  const a = must(await db.from('care_agreements').select('*').eq('id', agreementId).single(), 'Agreement')
  if (a.status !== 'signed' || !a.signed_pdf_path) throw new CareError('This agreement has not been signed.', 409)
  const { site, client } = await loadSite(a.site_id)
  const pdf = await getObject(AGREEMENTS_BUCKET, a.signed_pdf_path)
  const snap = a.snapshot as AgreementSnapshot
  const filename = `Website_Care_Agreement_${snap.site.label.replace(/[^A-Za-z0-9]+/g, '_')}.pdf`
  const signedDate = new Date(a.signed_at).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/New_York' })
  const subscribed = !!site.stripe_subscription_id && !['canceled', 'incomplete_expired'].includes(site.subscription_status || '')
  const attachments = [{ filename, content: pdf.toString('base64') }]
  const to = a.signer_email
  const allowed = clientEmailAllowed(to)
  let status: 'sent' | 'failed' | 'skipped' = 'sent'
  let err: string | null = null
  if (!allowed.ok) { status = 'skipped'; err = allowed.reason || 'Recipient not allowed here.' }
  else {
    const c = agreementSignedClient({ name: a.signer_name, siteLabel: snap.site.label, signedDate, link: agreementUrl(site.agreement_token), queuedLine: CARE_QUEUED_LINE, paid: subscribed, paymentOpen: stripeConfigured() })
    const r = await resend().emails.send({ from: BRAND.from, to, replyTo: BRAND.email, subject: c.subject, html: c.html, text: c.text, attachments }, { idempotencyKey: `care-agreement-signed-${a.id}-${actor === 'client' ? 'first' : Date.now()}` })
    if (r.error) { status = 'failed'; err = r.error.message || 'The email provider refused it.' }
  }
  const o = agreementSignedOwner({ client: client.business || client.name || site.label, site: site.label, signer: a.signer_name, signedDate, version: a.terms_version, ip: a.signer_ip || 'unknown', link: `${appUrl()}/admin/care?site=${site.id}`, clientEmail: status === 'sent' ? to : `${to} (not sent: ${err})` })
  const ro = await resend().emails.send({ from: BRAND.adminFrom, to: await ownerEmail(), subject: o.subject, html: o.html, text: o.text, attachments }, { idempotencyKey: `care-agreement-owner-${a.id}-${actor === 'client' ? 'first' : Date.now()}` })
  if (ro.error && status === 'sent') { status = 'failed'; err = `Owner copy: ${ro.error.message}` }
  await db.from('care_agreements').update({ signed_email_status: status, signed_email_error: err, signed_emailed_at: status === 'sent' ? new Date().toISOString() : null }).eq('id', a.id)
  await logActivity({ site_id: a.site_id, actor, action: status === 'sent' ? 'agreement_copy_emailed' : 'agreement_copy_not_emailed', detail: { agreement: a.id, to, error: err } })
  return { status, error: err }
}

/* ------------------------------------------------------------------ */
/* Client: the private agreement page                                   */
/* ------------------------------------------------------------------ */

/** What a turned off link shows. It reveals nothing about the agreement. */
export const LINK_OFF = 'This link is no longer active. If you were expecting an agreement, reply to my last email and I’ll send you the current link.'

async function siteForToken(token: string) {
  if (!TOKEN_RE.test(token)) throw new CareError('Not found', 404)
  const site = (await db.from('care_sites').select('*').eq('agreement_token', token).maybeSingle()).data
  if (!site) {
    const link = (await db.from('care_agreement_links').select('status').eq('token', token).maybeSingle()).data
    if (link?.status === 'revoked') throw new CareError(LINK_OFF, 410)
    throw new CareError('Not found', 404)
  }
  const rec = (await db.from('care_agreement_links').select('status').eq('token', token).maybeSingle()).data
  if (rec?.status === 'revoked') throw new CareError(LINK_OFF, 410)
  const client = must(await db.from('clients').select('id, name, email, business').eq('id', site.client_id).single(), 'Client')
  return { site, client }
}

export type PublicStep = 'sign' | 'pay' | 'active' | 'unavailable'

/**
 * What the client's page shows. Only the agreement text and status: no
 * signature image, IP, internal notes, or ids beyond the agreement's own.
 */
export async function publicAgreement(token: string) {
  const { site, client } = await siteForToken(token)
  const cur = await currentAgreement(site)
  const subscribed = !!site.stripe_subscription_id && !['canceled', 'incomplete_expired'].includes(site.subscription_status || '')
  let step: PublicStep = 'unavailable'
  let message = ''
  if (site.enrollment_status === 'ended') message = 'Care for this website has ended. Reply to any of my emails if you have questions.'
  else if (cur?.status === 'signed' && covers(cur, site, client)) step = subscribed ? 'active' : 'pay'
  else if (cur?.status === 'issued' && cur.setup_hash === site.confirmed_hash && site.confirmed_hash === setupOf(site) && site.enrollment_status === 'confirmed' && coverage(cur.snapshot) === coverage(buildSnapshot(site, client))) step = 'sign'
  else message = cur?.status === 'signed'
    ? 'Your signed agreement is on file. The agreed details have changed since you signed, so I’ll send you an updated agreement to review before anything else happens.'
    : 'Your agreement is being updated. I’ll email you when it’s ready to sign.'
  if (cur?.status === 'issued' && !cur.first_viewed_at) await db.from('care_agreements').update({ first_viewed_at: new Date().toISOString() }).eq('id', cur.id).is('first_viewed_at', null)
  const show = step === 'sign' || step === 'pay' || step === 'active' || cur?.status === 'signed'
  return {
    step, message,
    agreement: show && cur ? { id: cur.id, status: cur.status, snapshot: cur.snapshot as AgreementSnapshot, snapshot_hash: cur.snapshot_hash, signed_at: cur.signed_at, signer_name: cur.status === 'signed' ? cur.signer_name : null } : null,
    queued_line: CARE_QUEUED_LINE,
    payment_open: stripeConfigured(),
  }
}

/**
 * The client signs. They must sign the exact version they were shown (id and
 * content fingerprint), with a typed name, a drawn signature and an explicit
 * agreement. The signed PDF is stored and emailed; payment unlocks.
 */
export async function signAgreement(token: string, body: Row, ip: string) {
  const { site, client } = await siteForToken(token)
  const cur = await currentAgreement(site)
  const name = typeof body.signer_name === 'string' ? body.signer_name.trim() : ''
  const img = typeof body.signature_image === 'string' ? body.signature_image : ''
  if (body.agree !== true) throw new CareError('Tick the box to confirm you agree to the terms.', 422)
  if (name.length < 2 || name.length > 120) throw new CareError('Type your full name.', 422)
  if (!img.startsWith('data:image/png;base64,') || img.length < 200 || img.length > 600_000) throw new CareError('Draw your signature in the box.', 422)
  if (!cur || cur.id !== body.agreement_id) throw new CareError('This agreement has been updated. Reload the page to read the current version.', 409)
  if (cur.status === 'signed') throw new CareError('This agreement is already signed.', 409)
  if (cur.status !== 'issued' || cur.snapshot_hash !== body.snapshot_hash) throw new CareError('This agreement has been updated. Reload the page to read the current version.', 409)
  if (site.enrollment_status !== 'confirmed' || cur.setup_hash !== site.confirmed_hash || site.confirmed_hash !== setupOf(site) || coverage(cur.snapshot) !== coverage(buildSnapshot(site, client))) {
    throw new CareError('The agreed details changed since this version was issued. I’ll send you an updated agreement.', 409)
  }
  const signedAt = new Date().toISOString()
  const signerEmail = (cur.snapshot as AgreementSnapshot).client.email
  // Claim the signature first so two submissions can't both sign.
  const claim = await db.from('care_agreements').update({ status: 'signed', signer_name: name, signer_email: signerEmail, signature_image: img, signer_ip: ip.slice(0, 100), signed_at: signedAt })
    .eq('id', cur.id).eq('status', 'issued').select('*')
  if (!claim.data?.length) throw new CareError('This agreement is already signed.', 409)
  const facts: SignatureFacts = { signer_name: name, signer_email: signerEmail, signed_at: signedAt, signer_ip: ip.slice(0, 100), signature_image: img, agreement_id: cur.id, snapshot_hash: cur.snapshot_hash }
  const pdf = agreementPdf(cur.snapshot as AgreementSnapshot, facts)
  const path = `${site.id}/${cur.id}.pdf`
  await putObject(AGREEMENTS_BUCKET, path, pdf, 'application/pdf')
  await db.from('care_agreements').update({ signed_pdf_path: path, signed_pdf_sha256: createHash('sha256').update(pdf).digest('hex') }).eq('id', cur.id)
  await db.from('care_sites').update({
    care_terms_version: CARE_TERMS_VERSION, care_terms_note: `Signed care agreement ${cur.terms_version} on ${signedAt.slice(0, 10)} (${name})`, care_terms_reviewed_at: signedAt, updated_at: signedAt,
  }).eq('id', site.id)
  await logActivity({ site_id: site.id, actor: 'client', action: 'agreement_signed', detail: { agreement: cur.id, version: cur.terms_version, signer: name } })
  let email: { status: string; error: string | null } = { status: 'failed', error: null }
  try { email = await emailSignedCopy(cur.id, 'client') } catch (e) { email = { status: 'failed', error: String((e as Error).message || e) } }
  return { signed: true, signed_at: signedAt, emailed: email.status === 'sent' }
}

/** Continue to payment: only for a signed agreement that still covers the setup. */
export async function agreementCheckout(token: string): Promise<CheckoutLink> {
  const { site, client } = await siteForToken(token)
  if (!stripeConfigured()) throw new CareError('Online payment isn’t open yet. Your signed agreement is on file, and I’ll email you when you can start your plan.', 503)
  const cur = await currentAgreement(site)
  if (!cur || !covers(cur, site, client)) throw new CareError('Payment opens once the current agreement is signed.', 409)
  const link = await openCheckout(site.id, 'client')
  if (link.check.expected.amount_cents !== cur.amount_cents) throw new CareError('The price changed since you signed. I’ll send you an updated agreement.', 409)
  return link
}

/** The owner's copy of the checkout link: also only after the current agreement is signed. */
export async function ownerCheckout(siteId: string, actor: string): Promise<CheckoutLink> {
  const { site, client } = await loadSite(siteId)
  const cur = await currentAgreement(site)
  if (!covers(cur, site, client)) throw new CareError('Payment unlocks once the client signs the current care agreement. Send the agreement link first.', 409)
  return openCheckout(siteId, actor)
}
