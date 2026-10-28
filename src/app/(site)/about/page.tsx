import type { Metadata } from 'next'
import Image from 'next/image'
import s from '@/components/site/site.module.css'
import { CtaBand } from '@/components/site/blocks'
import { Sparkle } from '@/components/site/Shapes'
import { about, inquiryHref, techGroups } from '@/content/site'

const title = 'About'
const description =
  'Meet Alante Velez, a website designer and developer based in Maryland who works with businesses nationwide. Plain language, clear scope, and help after launch.'

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: '/about' },
  openGraph: { title: `${title} | Alante Velez`, description, url: '/about' },
  twitter: { title: `${title} | Alante Velez`, description },
}

const approach = [
  { title: 'One point of contact.', body: 'From the first call through launch and after, you talk to the person building your site.' },
  { title: 'Plain language.', body: 'No jargon unless you ask for it. I’ll explain what you need, and what you can skip.' },
  { title: 'Clear scope.', body: 'You get a written proposal, so you know what’s included before anything starts.' },
  { title: 'Help after launch.', body: 'Care plans are there if you want ongoing updates and checks.' },
]

export default function AboutPage() {
  return (
    <>
      <section className={s.aboutHero} aria-labelledby="about-title">
        <div className={s.aboutPhotoWrap}>
          <div className={s.aboutPhoto}>
            <Image
              src="/Alante.PNG"
              alt="Portrait of Alante Velez"
              width={1086}
              height={1448}
              preload
              sizes="(max-width: 1000px) 60vw, 340px"
              className={s.aboutImg}
            />
          </div>
          <Sparkle className={s.aboutSparkle} />
        </div>
        <div className={s.aboutCopy}>
          <p className={s.eyebrow}>About</p>
          <h1 id="about-title" className={s.pageTitle}>
            Hi, I’m Alante. <em>You’ll work directly with me.</em>
          </h1>
          <p>
            I design and build websites for small businesses, service providers, consultants, and creators. My job is to make getting a great website,
            and keeping it that way, feel easy.
          </p>
          <ul className={s.aboutFacts}>
            <li>
              <span className={s.factLabel}>Where</span>
              {about.location}
            </li>
            <li>
              <span className={s.factLabel}>Background</span>
              {about.background}
            </li>
          </ul>
        </div>
      </section>

      <section className={s.section} aria-labelledby="approach-title">
        <div className={s.sectionHead} data-reveal>
          <p className={s.eyebrow}>How I work</p>
          <h2 id="approach-title" className={s.sectionTitle}>
            Friendly, clear, <em>and still here later.</em>
          </h2>
        </div>
        <ul className={s.approach}>
          {approach.map((a, i) => (
            <li key={a.title} data-reveal style={{ '--i': i } as React.CSSProperties}>
              <h3 className={s.approachTitle}>{a.title}</h3>
              <p>{a.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className={s.section} aria-labelledby="tools-title">
        <details className={s.techDetails} data-reveal>
          <summary>
            <span id="tools-title">For the technically curious: the tools I use</span>
            <span className={s.summaryIcon} aria-hidden="true" />
          </summary>
          <div className={s.techBody}>
            <p>
              Most of my builds use Next.js and React with TypeScript, hosted on Vercel, with Supabase for databases and logins. Payments run through
              Stripe or PayPal and email through Resend. I also connect tools like Zoom, Calendly, AI APIs, and webhooks when a project calls for it.
            </p>
            <dl className={s.techGrid}>
              {techGroups.map((g) => (
                <div key={g.label}>
                  <dt>{g.label}</dt>
                  <dd>{g.items.join(', ')}</dd>
                </div>
              ))}
            </dl>
          </div>
        </details>
      </section>

      <CtaBand
        title={
          <>
            Sound like <em>a good fit?</em>
          </>
        }
        body="Tell me about your business and what you’d like your website to do."
        label="Let’s Work Together"
        href={inquiryHref()}
      />
    </>
  )
}
