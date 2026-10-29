import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { Suspense } from 'react'
import s from '@/components/site/site.module.css'
import InquiryFormFromUrl, { InquiryForm } from '@/components/site/InquiryForm'
import { ProjectGrid } from '@/components/site/blocks'
import { Blob, Ring, ServiceIcon, Sparkle, Squiggle, Wave } from '@/components/site/Shapes'
import { CONTACT_EMAIL, services } from '@/content/site'
import { carePlans, formatUSD, packages } from '@/content/offers'

const title = 'Alante Velez | Website Design, Redesigns, and Care'
const description =
  'Friendly website design, redesigns, and ongoing care for small businesses, service providers, consultants, and creators. Clear plans, plain language, and help after launch.'

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  alternates: { canonical: '/' },
  openGraph: { title, description, url: '/' },
  twitter: { title, description },
}

export default function Home() {
  return (
    <>
      {/* ---------------- Hero ---------------- */}
      <section className={s.hero} aria-labelledby="hero-title">
        <div className={s.heroCopy}>
          <p className={s.hello}>
            <Wave className={s.helloWave} />
            Hi, I’m Alante. I design and build websites.
          </p>
          <h1 id="hero-title" className={s.heroTitle}>
            Your business deserves a website you’re{' '}
            <span className={s.heroAccent}>
              excited to share.
              <Squiggle className={s.heroSquiggle} />
            </span>
          </h1>
          <p className={s.heroLede}>
            I design, rebuild, and look after websites that help people understand what you do and take the next step, whether that’s booking,
            buying, or simply getting in touch.
          </p>
          <div className={s.heroActions}>
            <a href="#contact" className={`${s.btn} ${s.btnPrimary} ${s.btnLarge}`}>
              Tell Me About Your Project
            </a>
            <a href="#work" className={`${s.btn} ${s.btnGhost} ${s.btnLarge}`}>
              Explore My Work
            </a>
          </div>
          <p className={s.heroNote}>
            New sites, redesigns, and care plans for small businesses, service providers, and creators. And I don’t disappear after launch.
          </p>
        </div>

        <div className={s.heroArt}>
          <Blob className={s.heroBlob} />
          <Sparkle className={s.heroSparkleA} />
          <Sparkle className={s.heroSparkleB} />
          <div className={s.portraitArch}>
            <Image
              src="/Alante.PNG"
              alt="Portrait of Alante Velez smiling softly, wearing a black blazer"
              width={1086}
              height={1448}
              preload
              sizes="(max-width: 1000px) 70vw, 420px"
              className={s.portraitImg}
            />
          </div>
          <div className={s.stamp} aria-hidden="true">
            <svg viewBox="0 0 120 120" className={s.stampSvg}>
              <defs>
                <path id="stamp-circle" d="M60,60 m-44,0 a44,44 0 1,1 88,0 a44,44 0 1,1 -88,0" />
              </defs>
              <text>
                <textPath href="#stamp-circle">DESIGN • BUILD • CARE • DESIGN • BUILD • CARE •</textPath>
              </text>
            </svg>
            <Sparkle className={s.stampCenter} />
          </div>
          <p className={s.sticker} aria-hidden="true">
            Here after launch, too
          </p>
        </div>
      </section>

      {/* ---------------- Work ---------------- */}
      <section id="work" className={s.work} aria-labelledby="work-title">
        <div className={s.sectionHead} data-reveal>
          <p className={s.eyebrow}>Selected work</p>
          <h2 id="work-title" className={s.sectionTitle}>
            Three very different brands. <em>Each one feels like itself.</em>
          </h2>
          <p className={s.sectionLede}>A travel planner, an online academy, and a coaching practice, each with its own look and its own job to do.</p>
        </div>
        <ProjectGrid />
      </section>

      {/* ---------------- Services overview ---------------- */}
      <section className={s.servicesPreview} aria-labelledby="services-title">
        <div className={s.servicesIntro} data-reveal>
          <p className={s.eyebrow}>Services</p>
          <h2 id="services-title" className={s.sectionTitle}>
            Whatever stage you’re at, <em>we can start there.</em>
          </h2>
          <p className={s.sectionLede}>From a first website to something fully custom, plus help keeping it running.</p>
          <ul className={s.startingPoints}>
            {packages.map((pk) => (
              <li key={pk.id}>
                <span>{pk.name}</span>
                <strong>from {formatUSD(pk.price)}</strong>
              </li>
            ))}
          </ul>
          <Link href="/services" className={`${s.btn} ${s.btnGhost}`}>
            See Services and Pricing
          </Link>
        </div>
        <ul className={s.serviceTiles}>
          {services.map((sv, i) => (
            <li key={sv.id} className={s.serviceTile} data-reveal style={{ '--i': i } as React.CSSProperties}>
              <span className={s.serviceIcon} data-tone={i % 3}>
                <ServiceIcon id={sv.id} />
              </span>
              <span>
                <span className={s.serviceTileName}>{sv.name}</span>
                <span className={s.serviceTileShort}>{sv.short}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* ---------------- Care teaser ---------------- */}
      <section className={s.careTeaser} aria-labelledby="care-teaser-title" data-reveal>
        <Ring className={s.careRing} />
        <div>
          <p className={s.eyebrowLight}>Website care</p>
          <h2 id="care-teaser-title" className={s.sectionTitleLight}>
            Need a hand after launch?
          </h2>
          <p className={s.careLede}>
            Optional care plans start at {formatUSD(Math.min(...carePlans.map((c) => c.monthly)))} a month and include monthly website checks and a monthly
            health report, with plans that add time for updates and troubleshooting. Prefer to ask only when you need something? Occasional support works
            too.
          </p>
        </div>
        <Link href="/care" className={`${s.btn} ${s.btnLight} ${s.btnLarge}`}>
          See Website Care
        </Link>
      </section>

      {/* ---------------- Contact ---------------- */}
      <section id="contact" className={s.contact} aria-labelledby="contact-title">
        <div className={s.contactIntro} data-reveal>
          <p className={s.eyebrow}>Let’s talk</p>
          <h2 id="contact-title" className={s.contactTitle}>
            Tell me about <em>your project.</em>
          </h2>
          <p className={s.sectionLede}>
            A few quick details is all I need to start. You’ll get the chance to book a short intro call right after, and you’ll work directly with me.
          </p>
          <div className={s.questionnaireCallout}>
            <p className={s.nextStepTitle}>Already know what you need?</p>
            <p>
              Skip ahead and <Link href="/intake">complete the project questionnaire</Link>. It takes about five minutes and leads straight to booking a
              discovery call.
            </p>
          </div>
          <ul className={s.contactAlt}>
            <li>
              Prefer email? <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
            </li>
            <li>
              Curious who you’d be working with? <Link href="/about">Read about me</Link>.
            </li>
          </ul>
        </div>
        <div data-reveal>
          <Suspense fallback={<InquiryForm interestParam={null} />}>
            <InquiryFormFromUrl />
          </Suspense>
        </div>
      </section>
    </>
  )
}
