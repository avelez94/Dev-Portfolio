'use client'

import { useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import s from './site.module.css'
import { CONTACT_EMAIL, UNSURE, interestGroups, interestLabel, parseInterest, type InterestKey } from '@/content/site'

// Budget and timeline options match the detailed intake so admin data stays consistent.
const budgetOptions = ['Under $500', '$500 to $1,000', '$1,000 to $2,500', '$2,500 to $5,000', '$5,000+', 'Not sure yet']
const timelineOptions = ['As soon as possible', 'Within 2 weeks', 'Within a month', '1 to 3 months', 'No hard deadline']

type Fields = {
  name: string
  email: string
  business: string
  website: string
  interest: string
  description: string
  budget: string
  timeline: string
}

type Errors = Partial<Record<keyof Fields, string>>

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const URL_RE = /^(https?:\/\/)?[^\s.]+\.[^\s]{2,}$/i

function validate(f: Fields): Errors {
  const e: Errors = {}
  if (!f.name.trim()) e.name = 'Please add your name.'
  if (!f.email.trim()) e.email = 'Please add your email so I can reply.'
  else if (!EMAIL_RE.test(f.email.trim())) e.email = 'That email doesn’t look quite right.'
  if (f.website.trim() && !URL_RE.test(f.website.trim())) e.website = 'That doesn’t look like a web address. Leave it blank if you don’t have one.'
  if (!f.interest) e.interest = 'Pick the closest option, or “Not sure yet”.'
  if (f.description.trim().length < 10) e.description = 'A sentence or two is plenty.'
  return e
}

const order: (keyof Fields)[] = ['name', 'email', 'business', 'website', 'interest', 'description', 'budget', 'timeline']

type Result = { id: string; emailed: boolean; firstName: string; email: string }

/** Reads ?interest= from the URL. Wrap in <Suspense> with <InquiryForm interestParam={null} /> as fallback. */
export default function InquiryFormFromUrl() {
  const params = useSearchParams()
  return <InquiryForm interestParam={parseInterest(params.get('interest'))} />
}

export function InquiryForm({ interestParam }: { interestParam: InterestKey | null }) {
  const [f, setF] = useState<Fields>(() => ({
    name: '',
    email: '',
    business: '',
    website: '',
    interest: interestParam ?? '',
    description: '',
    budget: '',
    timeline: '',
  }))
  const [errors, setErrors] = useState<Errors>({})
  const [touched, setTouched] = useState<Partial<Record<keyof Fields, boolean>>>({})
  const [status, setStatus] = useState<'idle' | 'sending' | 'error' | 'limited'>('idle')
  const [result, setResult] = useState<Result | null>(null)
  const [lastParam, setLastParam] = useState(interestParam)
  const startedAt = useRef(0)
  const formRef = useRef<HTMLFormElement>(null)
  const successRef = useRef<HTMLHeadingElement>(null)

  // Following another "Ask about" link while on the homepage updates the choice.
  if (interestParam !== lastParam) {
    setLastParam(interestParam)
    if (interestParam) {
      setF((prev) => ({ ...prev, interest: interestParam }))
      setErrors((prev) => ({ ...prev, interest: undefined }))
    }
  }

  function set<K extends keyof Fields>(k: K, v: string) {
    const next = { ...f, [k]: v }
    setF(next)
    if (touched[k]) setErrors((prev) => ({ ...prev, [k]: validate(next)[k] }))
  }

  function blur(k: keyof Fields) {
    setTouched((t) => ({ ...t, [k]: true }))
    setErrors((prev) => ({ ...prev, [k]: validate(f)[k] }))
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const errs = validate(f)
    setErrors(errs)
    setTouched(Object.fromEntries(order.map((k) => [k, true])))
    const firstBad = order.find((k) => errs[k])
    if (firstBad) {
      formRef.current?.querySelector<HTMLElement>(`[name="${firstBad}"]`)?.focus()
      return
    }

    const honeypot = (new FormData(e.currentTarget).get('company_fax') as string | null) ?? ''

    setStatus('sending')
    try {
      const website = f.website.trim()
      const res = await fetch('/api/intake/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: f.name.trim(),
          email: f.email.trim(),
          business: f.business.trim(),
          type: interestLabel(f.interest) ?? UNSURE.label,
          description: f.description.trim(),
          budget: f.budget,
          timeline: f.timeline,
          heard: 'Portfolio site',
          anything: website ? `Existing website: ${website}` : '',
          source: 'homepage',
          company_fax: honeypot,
          elapsed_ms: startedAt.current ? Date.now() - startedAt.current : undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.status === 429) {
        setStatus('limited')
        return
      }
      if (!res.ok || !data?.id) throw new Error('Request failed')

      setResult({
        id: String(data.id),
        emailed: data.emailed === true,
        firstName: f.name.trim().split(/\s+/)[0],
        email: f.email.trim(),
      })
      setStatus('idle')
      requestAnimationFrame(() => successRef.current?.focus())
    } catch {
      setStatus('error')
    }
  }

  if (result) {
    return (
      <div className={s.formCard} role="status" aria-live="polite">
        <div className={s.successBadge} aria-hidden="true">
          <svg viewBox="0 0 24 24" width="28" height="28">
            <path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h3 ref={successRef} tabIndex={-1} className={s.successTitle}>
          Thanks, {result.firstName}! Your note is in.
        </h3>
        <p className={s.successText}>
          {result.emailed
            ? `I sent a confirmation to ${result.email}.`
            : 'Your details were saved. The confirmation email didn’t go out, so don’t worry if you don’t see one.'}{' '}
          If you’d like, grab a time for a short intro call now.
        </p>
        <div className={s.successActions}>
          <a className={`${s.btn} ${s.btnPrimary}`} href={`/book?ref=${encodeURIComponent(result.id)}`}>
            Pick a Time to Chat
          </a>
        </div>
        <p className={s.formFine}>Not ready to book? No problem. I’ll read your note and reply by email.</p>
      </div>
    )
  }

  const fieldProps = (k: keyof Fields) => ({
    id: `inq-${k}`,
    name: k,
    value: f[k],
    onBlur: () => blur(k),
    'aria-invalid': errors[k] ? true : undefined,
    'aria-describedby': errors[k] ? `inq-${k}-error` : undefined,
  })

  const err = (k: keyof Fields) =>
    errors[k] ? (
      <p id={`inq-${k}-error`} className={s.fieldError}>
        {errors[k]}
      </p>
    ) : null

  return (
    <form
      ref={formRef}
      className={s.formCard}
      onSubmit={onSubmit}
      onFocus={() => {
        if (!startedAt.current) startedAt.current = Date.now()
      }}
      noValidate
      aria-label="Project inquiry"
    >
      <div className={s.formGrid}>
        <div className={s.field}>
          <label htmlFor="inq-name">
            Your name <span className={s.req}>(required)</span>
          </label>
          <input {...fieldProps('name')} type="text" autoComplete="name" required onChange={(e) => set('name', e.target.value)} />
          {err('name')}
        </div>
        <div className={s.field}>
          <label htmlFor="inq-email">
            Email <span className={s.req}>(required)</span>
          </label>
          <input {...fieldProps('email')} type="email" autoComplete="email" inputMode="email" required onChange={(e) => set('email', e.target.value)} />
          {err('email')}
        </div>
        <div className={s.field}>
          <label htmlFor="inq-business">Business name</label>
          <input {...fieldProps('business')} type="text" autoComplete="organization" onChange={(e) => set('business', e.target.value)} />
        </div>
        <div className={s.field}>
          <label htmlFor="inq-website">Current website, if you have one</label>
          <input
            {...fieldProps('website')}
            type="text"
            inputMode="url"
            autoComplete="url"
            placeholder="yourbusiness.com"
            onChange={(e) => set('website', e.target.value)}
          />
          {err('website')}
        </div>
        <div className={`${s.field} ${s.fieldWide}`}>
          <label htmlFor="inq-interest">
            What can I help with? <span className={s.req}>(required)</span>
          </label>
          <select {...fieldProps('interest')} required onChange={(e) => set('interest', e.target.value)}>
            <option value="">Choose one</option>
            {interestGroups.map((g) => (
              <optgroup key={g.label} label={g.label}>
                {g.options.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.label}
                  </option>
                ))}
              </optgroup>
            ))}
            <option value={UNSURE.key}>{UNSURE.label}</option>
          </select>
          {err('interest')}
        </div>
        <div className={`${s.field} ${s.fieldWide}`}>
          <label htmlFor="inq-description">
            Tell me a little about the project <span className={s.req}>(required)</span>
          </label>
          <textarea
            {...fieldProps('description')}
            rows={4}
            required
            placeholder="What do you do, and what do you want your website to help with?"
            onChange={(e) => set('description', e.target.value)}
          />
          {err('description')}
        </div>
        <div className={s.field}>
          <label htmlFor="inq-budget">
            Budget <span className={s.opt}>(optional)</span>
          </label>
          <select {...fieldProps('budget')} onChange={(e) => set('budget', e.target.value)}>
            <option value="">Prefer to discuss</option>
            {budgetOptions.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>
        <div className={s.field}>
          <label htmlFor="inq-timeline">
            Timeline <span className={s.opt}>(optional)</span>
          </label>
          <select {...fieldProps('timeline')} onChange={(e) => set('timeline', e.target.value)}>
            <option value="">Flexible or not sure</option>
            {timelineOptions.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Spam trap: hidden from people and assistive tech, bots tend to fill it. */}
      <div className={s.trap} aria-hidden="true">
        <label htmlFor="inq-company-fax">Leave this empty</label>
        <input id="inq-company-fax" name="company_fax" type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
      </div>

      <p className={s.formFine}>Please don’t include passwords or account logins. I’ll never need them here.</p>

      {status === 'error' && (
        <div className={s.formError} role="alert">
          Something went wrong and your message wasn’t sent. Please try again, or email me at{' '}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </div>
      )}
      {status === 'limited' && (
        <div className={s.formError} role="alert">
          Looks like a few notes came through from you already, so I paused this one. Please email me at{' '}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> and I’ll take it from there.
        </div>
      )}

      <button type="submit" className={`${s.btn} ${s.btnPrimary} ${s.btnBlock}`} disabled={status === 'sending'}>
        {status === 'sending' ? 'Sending…' : 'Send My Note'}
      </button>
    </form>
  )
}
