'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const steps = [
  {
    id: 'basics',
    label: 'The Basics',
    questions: [
      { id: 'name', label: "What's your name?", type: 'text', placeholder: 'Your full name', required: true },
      { id: 'business', label: "What's your business or project called?", type: 'text', placeholder: 'Business or project name' },
      { id: 'email', label: 'Best email to reach you?', type: 'email', placeholder: 'you@example.com', required: true },
    ]
  },
  {
    id: 'project',
    label: 'The Project',
    questions: [
      {
        id: 'type', label: 'What kind of project are you looking to build?', type: 'select', required: true,
        options: ['Simple Landing Page', 'Booking + Payment Integration', 'Client Portal or Dashboard', 'Admin Dashboard', 'AI Workflow Integration', 'Not sure yet', 'Something else']
      },
      { id: 'description', label: 'Describe what you need built. The more detail the better.', type: 'textarea', placeholder: 'What does it do, who uses it, what problem does it solve...', required: true },
      { id: 'existing', label: 'Do you have an existing website or platform?', type: 'radio', options: ['Yes', 'No', 'In progress'] },
    ]
  },
  {
    id: 'scope',
    label: 'Scope & Assets',
    questions: [
      { id: 'assets', label: 'What assets do you already have ready?', type: 'checkbox', options: ['Logo', 'Brand colors', 'Copy / written content', 'Images or photography', 'Design mockups', 'None yet'] },
      { id: 'integrations', label: 'Will this project need any integrations?', type: 'checkbox', options: ['Payment processing (Stripe / PayPal)', 'Booking or scheduling', 'Email marketing', 'CMS for content editing', 'AI or automation', 'User login / accounts', 'None'] },
      { id: 'references', label: 'Any websites or apps you like the look or feel of?', type: 'textarea', placeholder: 'Optional but helpful...' },
    ]
  },
  {
    id: 'timeline',
    label: 'Timeline & Budget',
    questions: [
      { id: 'timeline', label: 'When do you need this completed?', type: 'select', options: ['As soon as possible', 'Within 2 weeks', 'Within a month', '1 to 3 months', 'No hard deadline'] },
      { id: 'budget', label: "What's your approximate budget?", type: 'select', options: ['Under $500', '$500 to $1,000', '$1,000 to $2,500', '$2,500 to $5,000', '$5,000+', 'Not sure yet'] },
      { id: 'heard', label: 'How did you find me?', type: 'select', required: true, options: ['Referral', 'Portfolio site', 'LinkedIn', 'Other'] },
    ]
  },
  {
    id: 'final',
    label: 'Last Thing',
    questions: [
      { id: 'priority', label: 'What matters most to you in this project?', type: 'radio', options: ['Speed of delivery', 'Quality of design', 'Technical functionality', 'Budget efficiency'] },
      { id: 'anything', label: 'Anything else you want me to know before our call?', type: 'textarea', placeholder: 'Constraints, concerns, context...' },
    ]
  }
]

const ERROR_MSG = "We'll need this to prepare for your call"

function isEmpty(value: any) {
  if (!value) return true
  if (typeof value === 'string') return value.trim() === ''
  if (Array.isArray(value)) return value.length === 0
  return false
}

export default function IntakePage() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(0)
  const [answers, setAnswers] = useState<Record<string, any>>({})
  const [errors, setErrors] = useState<Record<string, boolean>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const step = steps[currentStep]
  const progress = (currentStep / steps.length) * 100

  function updateAnswer(id: string, value: any) {
    setAnswers(prev => ({ ...prev, [id]: value }))
    if (errors[id]) setErrors(prev => ({ ...prev, [id]: false }))
  }

  function toggleCheckbox(id: string, option: string) {
    const current = answers[id] || []
    const updated = current.includes(option)
      ? current.filter((o: string) => o !== option)
      : [...current, option]
    updateAnswer(id, updated)
  }

  function validate() {
    const newErrors: Record<string, boolean> = {}
    step.questions.forEach((q: any) => {
      if (q.required && isEmpty(answers[q.id])) {
        newErrors[q.id] = true
      }
    })
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  async function handleNext() {
    if (!validate()) return

    if (currentStep < steps.length - 1) {
      setCurrentStep(s => s + 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    setSubmitting(true)
    setSubmitError('')

    try {
      const res = await fetch('/api/intake/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(answers),
      })

      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'Something went wrong')

      router.push(`/book?ref=${data.id}`)
    } catch (err: any) {
      setSubmitError(err.message || 'Something went wrong. Please try again.')
      setSubmitting(false)
    }
  }

  function handleBack() {
    if (currentStep > 0) {
      setCurrentStep(s => s - 1)
      setErrors({})
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400;1,700&family=DM+Mono:wght@300;400;500&family=DM+Sans:wght@300;400;500&display=swap');
        
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        
        :root {
          --pink: #A96860;
          --pink-light: #C18078;
          --gold: #D4A574;
          --beige: #F5E6D3;
          --cream: #FAF3E8;
          --dark: #2A2420;
          --dark-light: #3D3630;
          --muted: #8B7D73;
          --border: rgba(169,104,96,0.2);
          --error: #D97070;
          --serif: 'Playfair Display', Georgia, serif;
          --mono: 'DM Mono', monospace;
          --sans: 'DM Sans', sans-serif;
        }
        
        body { 
          background: var(--cream); 
          color: var(--dark); 
          font-family: var(--sans); 
          font-weight: 300; 
          min-height: 100vh; 
        }
        
        .shell { 
          width: 100%; 
          max-width: 680px; 
          margin: 0 auto; 
          padding: 60px 24px 100px; 
          position: relative; 
          z-index: 1; 
        }
        
        .top-bar { 
          display: flex; 
          justify-content: space-between; 
          align-items: center; 
          margin-bottom: 56px; 
          padding-bottom: 24px; 
          border-bottom: 1px solid var(--border); 
        }
        
        .logo-text { 
          font-family: var(--serif); 
          font-size: 1rem; 
          color: var(--dark); 
          letter-spacing: 0.02em; 
          text-decoration: none; 
          font-weight: 700;
        }
        
        .logo-sub {
          font-family: var(--mono);
          font-size: 0.6rem;
          color: var(--muted);
          letter-spacing: 0.12em;
          text-transform: uppercase;
          display: block;
        }
        
        .step-counter { 
          font-family: var(--mono); 
          font-size: 0.68rem; 
          color: var(--muted); 
          letter-spacing: 0.12em; 
          text-transform: uppercase; 
        }
        
        .progress-track { 
          height: 1px; 
          background: var(--border); 
          margin-bottom: 56px; 
          overflow: hidden; 
        }
        
        .progress-fill { 
          height: 100%; 
          background: var(--pink); 
          transition: width 0.5s cubic-bezier(0.4,0,0.2,1); 
        }
        
        .step-tag { 
          display: inline-flex; 
          align-items: center; 
          gap: 10px; 
          font-family: var(--mono); 
          font-size: 0.68rem; 
          color: var(--pink); 
          letter-spacing: 0.15em; 
          text-transform: uppercase; 
          margin-bottom: 16px; 
          font-weight: 500;
        }
        
        .step-tag::before { 
          content: ''; 
          width: 24px; 
          height: 1px; 
          background: var(--pink); 
        }
        
        .step-title { 
          font-family: var(--serif); 
          font-size: clamp(36px, 7vw, 56px); 
          font-weight: 900; 
          line-height: 1.1; 
          letter-spacing: -0.015em; 
          margin-bottom: 44px; 
          color: var(--dark);
        }
        
        .step-title em { 
          font-style: italic; 
          color: var(--pink); 
        }
        
        .questions { 
          display: flex; 
          flex-direction: column; 
          gap: 36px; 
        }
        
        .question { 
          display: flex; 
          flex-direction: column; 
          gap: 12px; 
        }
        
        .q-label-row { 
          display: flex; 
          align-items: baseline; 
          gap: 8px; 
        }
        
        .q-label { 
          font-size: 0.95rem; 
          font-weight: 300; 
          color: rgba(42, 36, 32, 0.8); 
          line-height: 1.5; 
        }
        
        .q-required { 
          font-family: var(--mono); 
          font-size: 0.6rem; 
          color: var(--pink); 
          letter-spacing: 0.08em; 
          opacity: 0.8; 
        }
        
        input[type="text"], input[type="email"], textarea, select { 
          background: white; 
          border: 1px solid var(--border); 
          color: var(--dark); 
          font-family: var(--sans); 
          font-size: 0.95rem; 
          font-weight: 300; 
          padding: 14px 18px; 
          width: 100%; 
          outline: none; 
          transition: border-color 0.2s, background 0.2s; 
          appearance: none; 
          border-radius: 4px;
        }
        
        input:focus, textarea:focus, select:focus { 
          border-color: var(--pink); 
          background: rgba(169, 104, 96, 0.02); 
        }
        
        input.has-error, textarea.has-error, select.has-error { 
          border-color: var(--error); 
        }
        
        input::placeholder, textarea::placeholder { 
          color: var(--muted); 
          font-weight: 300; 
        }
        
        textarea { 
          resize: vertical; 
          min-height: 110px; 
          line-height: 1.6; 
          font-family: var(--sans);
        }
        
        select { 
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%238B7D73' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E"); 
          background-repeat: no-repeat; 
          background-position: right 18px center; 
          padding-right: 44px; 
          cursor: pointer; 
        }
        
        select option { 
          background: white; 
          color: var(--dark); 
        }
        
        .field-error { 
          font-family: var(--mono); 
          font-size: 0.65rem; 
          color: var(--error); 
          letter-spacing: 0.06em; 
          display: flex; 
          align-items: center; 
          gap: 6px; 
        }
        
        .radio-group, .checkbox-group { 
          display: flex; 
          flex-direction: column; 
          gap: 8px; 
        }
        
        .option-item { 
          display: flex; 
          align-items: center; 
          gap: 14px; 
          padding: 13px 18px; 
          background: white; 
          border: 1px solid var(--border); 
          cursor: pointer; 
          transition: border-color 0.2s, background 0.2s; 
          user-select: none; 
          border-radius: 4px;
        }
        
        .option-item:hover { 
          background: rgba(169, 104, 96, 0.03); 
          border-color: rgba(169, 104, 96, 0.4); 
        }
        
        .option-item.selected { 
          border-color: var(--pink); 
          background: rgba(169, 104, 96, 0.05); 
        }
        
        .option-indicator { 
          width: 14px; 
          height: 14px; 
          border: 1.5px solid var(--muted); 
          flex-shrink: 0; 
          display: flex; 
          align-items: center; 
          justify-content: center; 
          transition: border-color 0.2s, background 0.2s; 
          border-radius: 3px;
        }
        
        .option-indicator.round { 
          border-radius: 50%; 
        }
        
        .option-item.selected .option-indicator { 
          border-color: var(--pink); 
          background: var(--pink); 
        }
        
        .indicator-inner { 
          width: 5px; 
          height: 5px; 
          border-radius: 50%; 
          background: white; 
        }
        
        .check-mark { 
          font-family: var(--mono); 
          color: white; 
          font-size: 10px; 
          font-weight: 700; 
          line-height: 1; 
        }
        
        .option-label { 
          font-size: 0.88rem; 
          color: rgba(42, 36, 32, 0.75); 
          font-weight: 300; 
        }
        
        .option-item.selected .option-label { 
          color: var(--dark); 
        }
        
        .nav { 
          display: flex; 
          justify-content: space-between; 
          align-items: center; 
          margin-top: 56px; 
          padding-top: 28px; 
          border-top: 1px solid var(--border); 
        }
        
        .btn-back { 
          background: none; 
          border: none; 
          color: var(--muted); 
          font-family: var(--mono); 
          font-size: 0.7rem; 
          letter-spacing: 0.1em; 
          text-transform: uppercase; 
          cursor: pointer; 
          padding: 0; 
          transition: color 0.2s; 
          display: flex; 
          align-items: center; 
          gap: 10px;
          font-weight: 500;
        }
        
        .btn-back:hover { 
          color: var(--pink); 
        }
        
        .btn-next { 
          display: inline-flex; 
          align-items: center; 
          gap: 12px; 
          background: var(--pink); 
          border: none; 
          color: white; 
          font-family: var(--mono); 
          font-size: 0.75rem; 
          font-weight: 500; 
          letter-spacing: 0.1em; 
          text-transform: uppercase; 
          padding: 14px 28px; 
          cursor: pointer; 
          transition: all 0.25s;
          border-radius: 4px;
        }
        
        .btn-next:hover:not(:disabled) { 
          background: var(--pink-light); 
          transform: translateY(-2px); 
        }
        
        .btn-next:disabled { 
          opacity: 0.6; 
          cursor: not-allowed; 
        }
        
        .submit-error { 
          font-family: var(--mono); 
          font-size: 0.7rem; 
          color: var(--error); 
          margin-top: 12px; 
          text-align: center; 
        }
        
        @keyframes errorIn { 
          from { opacity: 0; transform: translateY(-4px); } 
          to { opacity: 1; transform: translateY(0); } 
        }
        
        .field-error { 
          animation: errorIn 0.2s ease forwards; 
        }
        
        @media (max-width: 768px) {
          .shell { padding: 48px 16px 80px; }
          .top-bar { margin-bottom: 48px; }
          .step-title { margin-bottom: 36px; }
          .questions { gap: 28px; }
        }
      `}</style>

      <div className="shell">
        <div className="top-bar">
          <div>
            <a href="/" className="logo-text">Alante Velez</a>
            <span className="logo-sub">Full Stack Product Developer</span>
          </div>
          <span className="step-counter">{currentStep + 1} / {steps.length}</span>
        </div>

        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>

        <div className="step-tag">Step {currentStep + 1}</div>
        <h1 className="step-title">{step.label}</h1>

        <div className="questions">
          {step.questions.map((q: any) => (
            <div className="question" key={q.id} id={`field-${q.id}`}>
              <div className="q-label-row">
                <label className="q-label">{q.label}</label>
                {q.required && <span className="q-required">required</span>}
              </div>

              {(q.type === 'text' || q.type === 'email') && (
                <input
                  type={q.type}
                  placeholder={q.placeholder}
                  value={answers[q.id] || ''}
                  className={errors[q.id] ? 'has-error' : ''}
                  onChange={e => updateAnswer(q.id, e.target.value)}
                />
              )}

              {q.type === 'textarea' && (
                <textarea
                  placeholder={q.placeholder}
                  value={answers[q.id] || ''}
                  className={errors[q.id] ? 'has-error' : ''}
                  onChange={e => updateAnswer(q.id, e.target.value)}
                />
              )}

              {q.type === 'select' && (
                <select
                  value={answers[q.id] || ''}
                  className={errors[q.id] ? 'has-error' : ''}
                  onChange={e => updateAnswer(q.id, e.target.value)}
                >
                  <option value="" disabled>Select an option</option>
                  {q.options.map((o: string) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              )}

              {q.type === 'radio' && (
                <div className="radio-group">
                  {q.options.map((o: string) => (
                    <div
                      key={o}
                      className={`option-item${answers[q.id] === o ? ' selected' : ''}`}
                      onClick={() => updateAnswer(q.id, o)}
                    >
                      <div className="option-indicator round">
                        {answers[q.id] === o && <div className="indicator-inner" />}
                      </div>
                      <span className="option-label">{o}</span>
                    </div>
                  ))}
                </div>
              )}

              {q.type === 'checkbox' && (
                <div className="checkbox-group">
                  {q.options.map((o: string) => {
                    const checked = (answers[q.id] || []).includes(o)
                    return (
                      <div
                        key={o}
                        className={`option-item${checked ? ' selected' : ''}`}
                        onClick={() => toggleCheckbox(q.id, o)}
                      >
                        <div className="option-indicator">
                          {checked && <span className="check-mark">✓</span>}
                        </div>
                        <span className="option-label">{o}</span>
                      </div>
                    )
                  })}
                </div>
              )}

              {errors[q.id] && (
                <span className="field-error">
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <circle cx="5" cy="5" r="4.5" stroke="currentColor"/>
                    <path d="M5 3v2.5M5 7h.01" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                  </svg>
                  {ERROR_MSG}
                </span>
              )}
            </div>
          ))}
        </div>

        <div className="nav">
          {currentStep > 0 ? (
            <button className="btn-back" onClick={handleBack}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M10 7H2M6 3l-4 4 4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Back
            </button>
          ) : <span />}
          <button className="btn-next" onClick={handleNext} disabled={submitting}>
            {submitting ? 'Submitting...' : currentStep === steps.length - 1 ? 'Submit' : 'Continue'}
            {!submitting && (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </button>
        </div>
        {submitError && <p className="submit-error">{submitError}</p>}
      </div>
    </>
  )
}
