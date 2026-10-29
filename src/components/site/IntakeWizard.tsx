'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import s from './site.module.css'
import { CONTACT_EMAIL, UNSURE, interestGroups, interestLabel, parseInterest } from '@/content/site'

/* ------------------------------------------------------------------ */
/* Questions (all original questions kept; grouped into four sections)  */
/* ------------------------------------------------------------------ */

const EXISTING = ['Yes', 'No', 'In progress']
const PRIORITIES = ['Speed of delivery', 'Quality of design', 'Technical functionality', 'Budget efficiency']
const ASSETS = ['Logo', 'Brand colors', 'Copy / written content', 'Images or photography', 'Design mockups', 'None yet']
const INTEGRATIONS = ['Payment processing (Stripe / PayPal)', 'Booking or scheduling', 'Email marketing', 'CMS for content editing', 'AI or automation', 'User login / accounts', 'None']
const TIMELINES = ['As soon as possible', 'Within 2 weeks', 'Within a month', '1 to 3 months', 'No hard deadline']
const BUDGETS = ['Under $500', '$500 to $1,000', '$1,000 to $2,500', '$2,500 to $5,000', '$5,000+', 'Not sure yet']
const HEARD = ['Referral', 'Portfolio site', 'LinkedIn', 'Other']
const OTHER = { key: 'other', label: 'Something else' }
const CARE_KEYS = new Set(['care', 'care-essential', 'care-business', 'care-premium', 'support'])

type Answers = {
  name: string
  email: string
  business: string
  existing: string
  website: string
  interest: string
  description: string
  platform: string
  priority: string
  assets: string[]
  integrations: string[]
  references: string
  timeline: string
  budget: string
  heard: string
  anything: string
}

const EMPTY: Answers = {
  name: '', email: '', business: '', existing: '', website: '', interest: '', description: '', platform: '', priority: '',
  assets: [], integrations: [], references: '', timeline: '', budget: '', heard: '', anything: '',
}

type StepId = 'about' | 'project' | 'content' | 'timing'
const STEP_TITLES: Record<StepId, string> = {
  about: 'About you',
  project: 'Your project',
  content: 'Content and features',
  timing: 'Timing and budget',
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

type Errors = Partial<Record<keyof Answers, string>>

function validate(step: StepId, a: Answers, isCare: boolean): Errors {
  const e: Errors = {}
  if (step === 'about') {
    if (!a.name.trim()) e.name = 'Please add your name.'
    if (!a.email.trim()) e.email = 'Please add your email so I can reach you.'
    else if (!EMAIL_RE.test(a.email.trim())) e.email = 'That email doesn’t look quite right.'
  }
  if (step === 'project') {
    if (!a.interest) e.interest = 'Pick the closest option, or “Not sure yet”.'
    if (a.description.trim().length < 10) e.description = isCare ? 'A sentence or two about what you need help with is plenty.' : 'A few sentences is plenty.'
  }
  if (step === 'timing' && !a.heard) e.heard = 'Please choose one.'
  return e
}

const ORDER: (keyof Answers)[] = ['name', 'email', 'business', 'existing', 'website', 'interest', 'description', 'platform', 'priority', 'assets', 'integrations', 'references', 'timeline', 'budget', 'heard', 'anything']

/** Per tab storage for the private link token only. Answers are never stored. */
const TOKEN_KEY = 'intake-continue'
const tokenStore = {
  get(): string | null {
    try {
      return window.sessionStorage.getItem(TOKEN_KEY)
    } catch {
      return null
    }
  },
  set(v: string) {
    try {
      window.sessionStorage.setItem(TOKEN_KEY, v)
    } catch {}
  },
  clear() {
    try {
      window.sessionStorage.removeItem(TOKEN_KEY)
    } catch {}
  },
}

type Prefill = { name: string; email: string; business: string; interest: string; type: string; note: string; website: string; budget: string; timeline: string }

export default function IntakeWizard() {
  const router = useRouter()
  const params = useSearchParams()
  const [answers, setAnswers] = useState<Answers>(() => ({ ...EMPTY, interest: parseInterest(params.get('interest')) ?? '' }))
  const [errors, setErrors] = useState<Errors>({})
  const [stepIdx, setStepIdx] = useState(0)
  const [linkToken] = useState<string | null>(() => params.get('continue'))
  // The private link token (never the answers) is kept for this tab only, so a
  // refresh can reload the prefill. It's cleared once the details are saved.
  const continueToken = useRef<string | null>(linkToken)
  const [prefill, setPrefill] = useState<Prefill | null>(null)
  const [linkState, setLinkState] = useState<'none' | 'loading' | 'ok' | 'expired' | 'invalid' | 'error'>(() => (params.get('continue') ? 'loading' : 'none'))
  const [status, setStatus] = useState<'idle' | 'sending' | 'error' | 'limited'>('idle')
  const [done, setDone] = useState<{ next: string; firstName: string; emailed: boolean } | null>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const startedAt = useRef(0)
  const firstRender = useRef(true)

  const isCare = CARE_KEYS.has(answers.interest)
  const steps: StepId[] = isCare ? ['about', 'project', 'timing'] : ['about', 'project', 'content', 'timing']
  const step = steps[Math.min(stepIdx, steps.length - 1)]
  const last = stepIdx >= steps.length - 1

  // Load what they already sent, using the private token from their link.
  // The token is moved out of the address bar right away.
  useEffect(() => {
    let token = linkToken
    if (token) {
      window.history.replaceState(null, '', '/intake')
      tokenStore.set(token)
    } else {
      token = tokenStore.get()
    }
    if (!token) return
    continueToken.current = token
    let cancelled = false
    fetch('/api/intake/continue', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) })
      .then(async (res) => {
        if (cancelled) return
        if (res.status === 410 || res.status === 404) {
          tokenStore.clear()
          continueToken.current = null
          return setLinkState(res.status === 410 ? 'expired' : 'invalid')
        }
        if (!res.ok) return setLinkState('error')
        const data = await res.json()
        const p = data.prefill as Prefill
        setPrefill(p)
        setAnswers((a) => ({
          ...a,
          name: p.name || a.name,
          email: p.email || a.email,
          business: p.business || a.business,
          interest: parseInterest(p.interest) ?? a.interest,
          description: p.note || a.description,
          website: p.website || a.website,
          existing: p.website ? 'Yes' : a.existing,
          budget: p.budget || a.budget,
          timeline: p.timeline || a.timeline,
          heard: a.heard || 'Portfolio site',
        }))
        setLinkState('ok')
      })
      .catch(() => !cancelled && setLinkState('error'))
    return () => {
      cancelled = true
    }
  }, [linkToken])

  // Move focus to the step heading when the step changes (not on first load).
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    headingRef.current?.focus()
  }, [stepIdx])

  function set<K extends keyof Answers>(k: K, v: Answers[K]) {
    setAnswers((a) => ({ ...a, [k]: v }))
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }))
  }

  function toggle(k: 'assets' | 'integrations', option: string) {
    setAnswers((a) => {
      const cur = a[k]
      return { ...a, [k]: cur.includes(option) ? cur.filter((o) => o !== option) : [...cur, option] }
    })
  }

  function focusFirstError(errs: Errors) {
    const firstBad = ORDER.find((k) => errs[k])
    if (firstBad) requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>(`[data-field="${firstBad}"]`)?.focus())
  }

  function next() {
    const errs = validate(step, answers, isCare)
    setErrors(errs)
    if (Object.keys(errs).length) return focusFirstError(errs)
    setStepIdx((i) => Math.min(i + 1, steps.length - 1))
    window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
  }

  function back() {
    setErrors({})
    setStepIdx((i) => Math.max(0, i - 1))
  }

  async function submit() {
    // Re-check every step, in case something was cleared on an earlier one.
    for (let i = 0; i < steps.length; i++) {
      const errs = validate(steps[i], answers, isCare)
      if (Object.keys(errs).length) {
        setStepIdx(i)
        setErrors(errs)
        return focusFirstError(errs)
      }
    }
    const honeypot = (formRef.current?.querySelector<HTMLInputElement>('input[name="company_fax"]')?.value ?? '').trim()
    setStatus('sending')
    try {
      const res = await fetch('/api/intake/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'questionnaire',
          continueToken: continueToken.current,
          name: answers.name.trim(),
          email: answers.email.trim(),
          business: answers.business.trim(),
          interest: answers.interest === OTHER.key ? '' : answers.interest,
          type: answers.interest === OTHER.key ? OTHER.label : interestLabel(answers.interest) ?? UNSURE.label,
          description: answers.description.trim(),
          priority: answers.priority,
          timeline: answers.timeline,
          budget: answers.budget,
          heard: answers.heard,
          anything: answers.anything.trim(),
          details: {
            existing: answers.existing,
            website: answers.existing && answers.existing !== 'No' ? answers.website.trim() : '',
            platform: isCare ? answers.platform.trim() : '',
            assets: isCare ? [] : answers.assets,
            integrations: isCare ? [] : answers.integrations,
            references: isCare ? '' : answers.references.trim(),
          },
          company_fax: honeypot,
          elapsed_ms: startedAt.current ? Date.now() - startedAt.current : undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.status === 429) return setStatus('limited')
      if (!res.ok || !data?.next) throw new Error('failed')
      tokenStore.clear()
      setDone({ next: data.next, firstName: answers.name.trim().split(/\s+/)[0], emailed: data.emailed === true })
      setStatus('idle')
      // Go straight to booking. The panel below stays as a fallback link.
      setTimeout(() => router.push(data.next), 900)
    } catch {
      setStatus('error')
    }
  }

  if (done) {
    return (
      <section className={s.flowShell} aria-labelledby="done-title">
        <div className={s.flowCard} role="status" aria-live="polite">
          <div className={s.successBadge} aria-hidden="true">
            <svg viewBox="0 0 24 24" width="28" height="28">
              <path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1 id="done-title" className={s.flowTitle}>
            Thanks, {done.firstName}! <em>Your details are saved.</em>
          </h1>
          <p className={s.flowLede}>Taking you to pick a time for your discovery call…</p>
          <p className={s.flowLede}>
            If nothing happens, <Link href={done.next}>choose your call time here</Link>.{' '}
            {done.emailed ? 'I also emailed you this link.' : ''}
          </p>
        </div>
      </section>
    )
  }

  const prop = (k: keyof Answers) => ({
    id: `q-${k}`,
    name: k,
    'data-field': k,
    'aria-invalid': errors[k] ? true : undefined,
    'aria-describedby': errors[k] ? `q-${k}-error` : undefined,
  })
  const err = (k: keyof Answers) =>
    errors[k] ? (
      <p id={`q-${k}-error`} className={s.fieldError}>
        {errors[k]}
      </p>
    ) : null

  return (
    <section className={s.flowShell} aria-labelledby="intake-title">
      <header className={s.flowHead}>
        <p className={s.eyebrow}>Project questionnaire</p>
        <h1 id="intake-title" className={s.flowTitle}>
          Tell me about <em>your project.</em>
        </h1>
        <p className={s.flowLede}>
          About five minutes. When you’re done, you’ll pick a time for a 20 minute discovery call. Only name, email, what you need, a short
          description, and how you found me are required.
        </p>
        <p className={s.flowFine} id="intake-save-note">
          Your answers stay as you move between steps and if sending fails, but nothing is saved until you submit. Refreshing or closing this
          page clears anything you haven’t submitted.
        </p>
      </header>

      {linkState === 'loading' && (
        <p className={s.flowNotice} role="status">
          Loading what you already sent…
        </p>
      )}
      {linkState === 'ok' && prefill && (
        <div className={s.flowNotice} role="status">
          <strong>Welcome back, {prefill.name.split(/\s+/)[0]}.</strong> I filled in what you already sent. Look it over and change anything you like.
        </div>
      )}
      {(linkState === 'expired' || linkState === 'invalid' || linkState === 'error') && (
        <div className={s.flowNotice} role="status">
          {linkState === 'expired'
            ? 'That link has expired, so I couldn’t fill in your earlier note.'
            : linkState === 'invalid'
              ? 'That link has already been used or isn’t valid, so I couldn’t fill in your earlier note. If you already finished the questionnaire, the link to book your call is in your “Project details received” email.'
              : 'I couldn’t load your earlier note just now.'}{' '}
          No problem: your note is still saved, and you can fill this in fresh.
        </div>
      )}

      <ol className={s.stepper} aria-label="Questionnaire progress">
        {steps.map((id, i) => (
          <li key={id} className={i === stepIdx ? s.stepCurrent : i < stepIdx ? s.stepDone : undefined} aria-current={i === stepIdx ? 'step' : undefined}>
            <span className={s.stepDot} aria-hidden="true">
              {i < stepIdx ? '✓' : i + 1}
            </span>
            <span className={s.stepLabel}>{STEP_TITLES[id]}</span>
          </li>
        ))}
      </ol>
      <div className={s.progressBar} aria-hidden="true">
        <span style={{ width: `${((stepIdx + 1) / steps.length) * 100}%` }} />
      </div>

      <form
        ref={formRef}
        className={s.flowCard}
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          if (last) submit()
          else next()
        }}
        onFocus={() => {
          if (!startedAt.current) startedAt.current = Date.now()
        }}
        aria-labelledby="step-title"
      >
        <p className={s.stepCount}>
          Step {stepIdx + 1} of {steps.length}
        </p>
        <h2 id="step-title" ref={headingRef} tabIndex={-1} className={s.stepTitle}>
          {STEP_TITLES[step]}
        </h2>

        {step === 'about' && (
          <div className={s.qGrid}>
            <div className={s.field}>
              <label htmlFor="q-name">
                Your name <span className={s.req}>(required)</span>
              </label>
              <input {...prop('name')} type="text" autoComplete="name" value={answers.name} onChange={(e) => set('name', e.target.value)} />
              {err('name')}
            </div>
            <div className={s.field}>
              <label htmlFor="q-email">
                Best email to reach you <span className={s.req}>(required)</span>
              </label>
              <input {...prop('email')} type="email" inputMode="email" autoComplete="email" value={answers.email} onChange={(e) => set('email', e.target.value)} />
              {err('email')}
            </div>
            <div className={`${s.field} ${s.fieldWide}`}>
              <label htmlFor="q-business">
                Business or project name <span className={s.opt}>(optional)</span>
              </label>
              <input {...prop('business')} type="text" autoComplete="organization" value={answers.business} onChange={(e) => set('business', e.target.value)} />
            </div>
            <fieldset className={`${s.choiceSet} ${s.fieldWide}`}>
              <legend>
                Do you have a website or platform now? <span className={s.opt}>(optional)</span>
              </legend>
              <div className={s.choices}>
                {EXISTING.map((o) => (
                  <label key={o} className={s.choice}>
                    <input type="radio" name="existing" value={o} checked={answers.existing === o} onChange={() => set('existing', o)} />
                    <span>{o}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            {answers.existing && answers.existing !== 'No' && (
              <div className={`${s.field} ${s.fieldWide}`}>
                <label htmlFor="q-website">
                  Its address <span className={s.opt}>(optional)</span>
                </label>
                <input {...prop('website')} type="text" inputMode="url" placeholder="yourbusiness.com" value={answers.website} onChange={(e) => set('website', e.target.value)} />
              </div>
            )}
          </div>
        )}

        {step === 'project' && (
          <div className={s.qGrid}>
            <div className={`${s.field} ${s.fieldWide}`}>
              <label htmlFor="q-interest">
                What are you looking for? <span className={s.req}>(required)</span>
              </label>
              <select {...prop('interest')} value={answers.interest} onChange={(e) => set('interest', e.target.value)}>
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
                <option value={OTHER.key}>{OTHER.label}</option>
              </select>
              {err('interest')}
            </div>

            {prefill?.note && (
              <div className={`${s.originalNote} ${s.fieldWide}`}>
                <p className={s.originalNoteLabel}>Your original note (saved as you sent it)</p>
                <p>{prefill.note}</p>
              </div>
            )}

            <div className={`${s.field} ${s.fieldWide}`}>
              <label htmlFor="q-description">
                {isCare ? 'What do you need help with?' : 'Describe what you need. The more detail the better.'} <span className={s.req}>(required)</span>
              </label>
              <p className={s.hint} id="q-description-hint">
                {isCare
                  ? 'For example: “Update our menu and hours each season, and check the booking link still works.”'
                  : 'For example: what it should do, who will use it, and what problem it solves for your business.'}
              </p>
              <textarea
                {...prop('description')}
                aria-describedby={[errors.description ? 'q-description-error' : '', 'q-description-hint'].filter(Boolean).join(' ')}
                rows={6}
                value={answers.description}
                onChange={(e) => set('description', e.target.value)}
              />
              {err('description')}
            </div>

            {isCare && (
              <div className={`${s.field} ${s.fieldWide}`}>
                <label htmlFor="q-platform">
                  What is your site built on, if you know? <span className={s.opt}>(optional)</span>
                </label>
                <input {...prop('platform')} type="text" placeholder="WordPress, Squarespace, Wix, custom, not sure…" value={answers.platform} onChange={(e) => set('platform', e.target.value)} />
              </div>
            )}

            <fieldset className={`${s.choiceSet} ${s.fieldWide}`}>
              <legend>
                What matters most to you in this project? <span className={s.opt}>(optional)</span>
              </legend>
              <div className={s.choices}>
                {PRIORITIES.map((o) => (
                  <label key={o} className={s.choice}>
                    <input type="radio" name="priority" value={o} checked={answers.priority === o} onChange={() => set('priority', o)} />
                    <span>{o}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            {isCare && (
              <p className={`${s.hint} ${s.fieldWide}`}>Since this is about ongoing help, I’ll skip the questions about content and features for a new build.</p>
            )}
          </div>
        )}

        {step === 'content' && (
          <div className={s.qGrid}>
            <fieldset className={`${s.choiceSet} ${s.fieldWide}`}>
              <legend>
                What do you already have ready? <span className={s.opt}>(optional)</span>
              </legend>
              <div className={s.choices}>
                {ASSETS.map((o) => (
                  <label key={o} className={s.choice}>
                    <input type="checkbox" name="assets" value={o} checked={answers.assets.includes(o)} onChange={() => toggle('assets', o)} />
                    <span>{o}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset className={`${s.choiceSet} ${s.fieldWide}`}>
              <legend>
                Will this project need any of these? <span className={s.opt}>(optional)</span>
              </legend>
              <div className={s.choices}>
                {INTEGRATIONS.map((o) => (
                  <label key={o} className={s.choice}>
                    <input type="checkbox" name="integrations" value={o} checked={answers.integrations.includes(o)} onChange={() => toggle('integrations', o)} />
                    <span>{o}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div className={`${s.field} ${s.fieldWide}`}>
              <label htmlFor="q-references">
                Any websites or apps you like the look or feel of? <span className={s.opt}>(optional)</span>
              </label>
              <textarea {...prop('references')} rows={3} placeholder="Links or names, plus what you like about them" value={answers.references} onChange={(e) => set('references', e.target.value)} />
            </div>
          </div>
        )}

        {step === 'timing' && (
          <div className={s.qGrid}>
            <div className={s.field}>
              <label htmlFor="q-timeline">
                When do you need this? <span className={s.opt}>(optional)</span>
              </label>
              <select {...prop('timeline')} value={answers.timeline} onChange={(e) => set('timeline', e.target.value)}>
                <option value="">Flexible or not sure</option>
                {TIMELINES.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </div>
            <div className={s.field}>
              <label htmlFor="q-budget">
                Approximate budget <span className={s.opt}>(optional)</span>
              </label>
              <select {...prop('budget')} value={answers.budget} onChange={(e) => set('budget', e.target.value)}>
                <option value="">Prefer to discuss</option>
                {BUDGETS.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </div>
            <fieldset className={`${s.choiceSet} ${s.fieldWide}`} aria-describedby={errors.heard ? 'q-heard-error' : undefined}>
              <legend>
                How did you find me? <span className={s.req}>(required)</span>
              </legend>
              <div className={s.choices}>
                {HEARD.map((o, i) => (
                  <label key={o} className={s.choice}>
                    <input
                      type="radio"
                      name="heard"
                      value={o}
                      data-field={i === 0 ? 'heard' : undefined}
                      checked={answers.heard === o}
                      onChange={() => set('heard', o)}
                    />
                    <span>{o}</span>
                  </label>
                ))}
              </div>
              {err('heard')}
            </fieldset>
            <div className={`${s.field} ${s.fieldWide}`}>
              <label htmlFor="q-anything">
                Anything else you want me to know before our call? <span className={s.opt}>(optional)</span>
              </label>
              <textarea {...prop('anything')} rows={3} placeholder="Constraints, concerns, context…" value={answers.anything} onChange={(e) => set('anything', e.target.value)} />
            </div>
          </div>
        )}

        <div className={s.trap} aria-hidden="true">
          <label htmlFor="q-company-fax">Leave this empty</label>
          <input id="q-company-fax" name="company_fax" type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
        </div>

        {status === 'error' && (
          <div className={s.formError} role="alert">
            Something went wrong and your details weren’t saved yet. Your answers are still here, so you can try again. If it keeps happening, email me at{' '}
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
          </div>
        )}
        {status === 'limited' && (
          <div className={s.formError} role="alert">
            Several submissions came through from you already, so I paused this one. Please email me at <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
          </div>
        )}

        <div className={s.flowNav}>
          {stepIdx > 0 ? (
            <button type="button" className={`${s.btn} ${s.btnGhost}`} onClick={back}>
              Back
            </button>
          ) : (
            <span />
          )}
          <button type="submit" className={`${s.btn} ${s.btnPrimary}`} disabled={status === 'sending'}>
            {status === 'sending' ? 'Saving…' : last ? 'Save and Choose a Call Time' : 'Continue'}
          </button>
        </div>
      </form>

      <p className={s.flowAside}>
        Just want to send a quick note instead? <Link href="/#contact">Use the short form</Link>.
      </p>
    </section>
  )
}
