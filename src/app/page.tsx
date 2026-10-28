import type { Metadata } from 'next'
import Image from 'next/image'
import s from './home.module.css'
import SiteHeader from '@/components/home/SiteHeader'
import InquiryForm from '@/components/home/InquiryForm'
import RevealObserver from '@/components/home/RevealObserver'
import Year from '@/components/home/Year'
import { Blob, Sparkle, Squiggle, Ring, ServiceIcon, ArrowUpRight, Check, NotIncluded, Wave } from '@/components/home/Shapes'
import {
  CONTACT_EMAIL,
  SHOW_DRAFTS,
  SITE_URL,
  UPTIME_MONITORING_CONFIGURED,
  careExcludes,
  careIncludes,
  carePlans,
  faqs,
  formatUSD,
  packages,
  processSteps,
  projects,
  services,
  techGroups,
  youllNeed,
} from '@/content/site'

export const metadata: Metadata = {
  alternates: { canonical: '/' },
}

function Draft({ children = 'Draft' }: { children?: React.ReactNode }) {
  if (!SHOW_DRAFTS) return null
  return <span className={s.draft}>{children}</span>
}

function Price({ value, suffix }: { value: number | null; suffix?: string }) {
  if (value !== null) {
    return (
      <p className={s.price}>
        <span className={s.priceLabel}>Starting at</span>
        <span className={s.priceValue}>
          {formatUSD(value)}
          {suffix && <span className={s.priceSuffix}>{suffix}</span>}
        </span>
      </p>
    )
  }
  return (
    <p className={s.price}>
      <span className={s.priceLabel}>Starting at</span>
      {SHOW_DRAFTS ? (
        <span className={`${s.priceValue} ${s.pricePending}`}>
          $ TBD{suffix && <span className={s.priceSuffix}>{suffix}</span>}
          <Draft>Price pending approval</Draft>
        </span>
      ) : (
        <span className={`${s.priceValue} ${s.priceQuote}`}>Quote on request</span>
      )}
    </p>
  )
}

export default function Home() {
  const visibleFaqs = faqs.filter((f) => SHOW_DRAFTS || !f.draft)

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ProfessionalService',
    name: 'Alante Velez',
    url: SITE_URL,
    email: CONTACT_EMAIL,
    image: `${SITE_URL}/Alante.PNG`,
    description:
      'Website design, website redesigns, custom web development, and ongoing website care for small businesses, service providers, consultants, and creators.',
    founder: { '@type': 'Person', name: 'Alante Velez', url: SITE_URL },
    knowsAbout: services.map((sv) => sv.name),
  }

  return (
    <div className={s.page} id="top">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <RevealObserver />
      <SiteHeader />

      <main id="main">
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
              I design, rebuild, and look after websites that help people understand what you do and take the next step,
              whether that’s booking, buying, or simply getting in touch.
            </p>
            <div className={s.heroActions}>
              <a href="#contact" className={`${s.btn} ${s.btnPrimary} ${s.btnLarge}`}>
                Tell Me About Your Website
              </a>
              <a href="#work" className={`${s.btn} ${s.btnGhost} ${s.btnLarge}`}>
                Explore My Work
              </a>
            </div>
            <p className={s.heroNote}>
              New sites, redesigns, and care plans for small businesses, service providers, and creators.
              And I don’t disappear after launch.
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
                sizes="(max-width: 900px) 78vw, 420px"
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
            <p className={s.sectionLede}>
              A travel planner, an online academy, and a coaching practice. Here’s who each site serves and what visitors can do there.
            </p>
          </div>

          <div className={s.projects}>
            {projects.map((p, i) => (
              <article
                key={p.slug}
                className={`${s.project} ${i === 0 ? s.projectFeature : ''}`}
                style={{ '--brand-bg': p.brand.bg, '--brand-ink': p.brand.ink, '--brand-accent': p.brand.accent } as React.CSSProperties}
                aria-labelledby={`proj-${p.slug}`}
                data-reveal
              >
                <div className={s.projectShot}>
                  <span className={s.browserBar}>
                    <span />
                    <span />
                    <span />
                    <span className={s.browserUrl}>{p.urlLabel}</span>
                  </span>
                  <Image
                    src={p.image.src}
                    alt={p.image.alt}
                    width={p.image.width}
                    height={p.image.height}
                    sizes={i === 0 ? '(max-width: 900px) 92vw, 760px' : '(max-width: 900px) 92vw, 560px'}
                    className={s.projectImg}
                  />
                </div>
                <div className={s.projectBody}>
                  <div className={s.projectMeta}>
                    <span className={s.kicker}>{p.kicker}</span>
                    {p.concept && <span className={s.conceptTag}>Concept project</span>}
                    <span className={s.swatches} aria-label={`Brand colors: ${p.brand.swatches.join(', ')}`} role="img">
                      {p.brand.swatches.map((c) => (
                        <span key={c} style={{ background: c }} />
                      ))}
                    </span>
                  </div>
                  <h3 id={`proj-${p.slug}`} className={s.projectName}>
                    {p.name}
                  </h3>
                  {p.role && <p className={s.projectRole}>My role: {p.role}</p>}
                  <dl className={s.projectFacts}>
                    <div>
                      <dt>Who it’s for</dt>
                      <dd>{p.whoFor}</dd>
                    </div>
                    <div>
                      <dt>What I built</dt>
                      <dd>{p.whatIBuilt}</dd>
                    </div>
                  </dl>
                  <p className={s.actionsLabel}>Visitors can</p>
                  <ul className={s.chips}>
                    {p.visitorActions.map((a) => (
                      <li key={a}>{a}</li>
                    ))}
                  </ul>
                  <a href={p.url} target="_blank" rel="noopener noreferrer" className={s.projectLink}>
                    Visit {p.name}
                    <ArrowUpRight />
                    <span className={s.srOnly}> (opens in a new tab)</span>
                  </a>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* ---------------- Services ---------------- */}
        <section id="services" className={s.services} aria-labelledby="services-title">
          <div className={s.servicesIntro} data-reveal>
            <p className={s.eyebrow}>Services</p>
            <h2 id="services-title" className={s.sectionTitle}>
              Whatever stage you’re at, <em>we can start there.</em>
            </h2>
            <p className={s.sectionLede}>
              Brand new, long overdue for a refresh, or needing something custom. I keep the scope clear and the language plain.
            </p>
            <a href="#contact" className={`${s.btn} ${s.btnGhost}`}>
              Not sure which? Ask me
            </a>
          </div>
          <ul className={s.serviceList}>
            {services.map((sv, i) => (
              <li key={sv.id} className={s.serviceItem} data-reveal style={{ '--i': i } as React.CSSProperties}>
                <span className={s.serviceIcon} data-tone={i % 3}>
                  <ServiceIcon id={sv.id} />
                </span>
                <div>
                  <h3 className={s.serviceName}>{sv.name}</h3>
                  <p className={s.serviceBody}>{sv.body}</p>
                  {sv.href && (
                    <a href={sv.href} className={s.inlineLink}>
                      {sv.hrefLabel}
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* ---------------- Pricing ---------------- */}
        <section id="pricing" className={s.pricing} aria-labelledby="pricing-title">
          <div className={s.sectionHead} data-reveal>
            <p className={s.eyebrow}>Pricing</p>
            <h2 id="pricing-title" className={s.sectionTitle}>
              Clear starting points, <em>no guesswork.</em>
            </h2>
            <p className={s.sectionLede}>
              Every project gets a written proposal with the exact scope and price before any work begins. These packages give you a sense of where things start.
            </p>
            {SHOW_DRAFTS && (
              <p className={s.draftBanner}>
                <strong>Preview only.</strong> Prices, page limits, and revision rounds below are proposals awaiting approval. They are not live offers.
              </p>
            )}
          </div>

          <div className={s.packages}>
            {packages.map((pk, i) => (
              <article key={pk.id} className={s.packageCard} data-tone={i} data-reveal aria-labelledby={`pkg-${pk.id}`}>
                <h3 id={`pkg-${pk.id}`} className={s.packageName}>
                  {pk.name}
                </h3>
                <p className={s.packageFor}>{pk.forWho}</p>
                <Price value={pk.startingAt} />
                <dl className={s.packageSpecs}>
                  <div>
                    <dt>Pages</dt>
                    <dd>{pk.pages}</dd>
                  </div>
                  <div>
                    <dt>Revisions</dt>
                    <dd>{pk.revisions}</dd>
                  </div>
                  <div>
                    <dt>Writing your copy</dt>
                    <dd>{pk.copywriting}</dd>
                  </div>
                  <div>
                    <dt>Adding your content</dt>
                    <dd>{pk.contentEntry}</dd>
                  </div>
                </dl>
                <ul className={s.checkList}>
                  {pk.includes.map((x) => (
                    <li key={x}>
                      <Check />
                      <span>{x}</span>
                    </li>
                  ))}
                </ul>
                <a href="#contact" className={`${s.btn} ${i === 1 ? s.btnPrimary : s.btnGhost} ${s.btnBlock}`}>
                  Ask About {pk.name}
                </a>
              </article>
            ))}
          </div>

          <div className={s.pricingNotes} data-reveal>
            <p>
              <strong>Good to know:</strong> extra pages, online stores, and integrations beyond a package are quoted separately. Third party
              subscriptions like domains, hosting, booking tools, or email services are paid to those providers and may add monthly costs.
            </p>
          </div>
        </section>

        {/* ---------------- Care ---------------- */}
        <section id="care" className={s.care} aria-labelledby="care-title">
          <Ring className={s.careRing} />
          <div className={s.careIntro} data-reveal>
            <p className={s.eyebrowLight}>Website care</p>
            <h2 id="care-title" className={s.sectionTitleLight}>
              Launch day isn’t goodbye.
            </h2>
            <p className={s.careLede}>
              If you’d like me to keep looking after your site, a care plan covers the small stuff each month so things keep running smoothly and you always know who to call.
            </p>
          </div>

          <div className={s.carePlans}>
            {carePlans.map((cp) => (
              <article key={cp.id} className={s.carePlan} data-reveal aria-labelledby={`care-${cp.id}`}>
                <h3 id={`care-${cp.id}`} className={s.carePlanName}>
                  {cp.name}
                </h3>
                <p className={s.packageFor}>{cp.forWho}</p>
                <Price value={cp.monthly} suffix=" / month" />
                <ul className={s.checkList}>
                  <li>
                    <Check />
                    <span>
                    {cp.updatesPerMonth !== null ? (
                      <>Up to {cp.updatesPerMonth} small content updates a month</>
                    ) : SHOW_DRAFTS ? (
                      <>
                        Up to <span className={s.blank}>__</span> small content updates a month <Draft />
                      </>
                    ) : (
                      <>A set number of small content updates each month</>
                    )}
                    </span>
                  </li>
                  {careIncludes.map((x) => (
                    <li key={x}>
                      <Check />
                      <span>{x}</span>
                    </li>
                  ))}
                  {UPTIME_MONITORING_CONFIGURED && (
                    <li>
                      <Check />
                      <span>Uptime monitoring, so I hear about outages quickly</span>
                    </li>
                  )}
                  {cp.extras.map((x) => (
                    <li key={x}>
                      <Check />
                      <span>
                        {x} <Draft />
                      </span>
                    </li>
                  ))}
                </ul>
                {cp.responseTime ? (
                  <p className={s.careResponse}>Response time: {cp.responseTime}</p>
                ) : (
                  SHOW_DRAFTS && (
                    <p className={s.careResponse}>
                      Response time: <span className={s.blank}>pending</span> <Draft />
                    </p>
                  )
                )}
              </article>
            ))}

            <aside className={s.careNot} data-reveal aria-labelledby="care-not-title">
              <h3 id="care-not-title" className={s.careNotTitle}>
                What care plans don’t cover
              </h3>
              <ul className={s.minusList}>
                {careExcludes.map((x) => (
                  <li key={x}>
                    <NotIncluded />
                    <span>{x}</span>
                  </li>
                ))}
              </ul>
              <p className={s.careNotNote}>
                Those are quoted as their own projects. Care plans also don’t include unlimited edits or around the clock support, and no one can promise a site will never have a problem. What I can promise is that you won’t be figuring it out alone.
              </p>
            </aside>
          </div>
        </section>

        {/* ---------------- Process ---------------- */}
        <section id="process" className={s.process} aria-labelledby="process-title">
          <div className={s.sectionHead} data-reveal>
            <p className={s.eyebrow}>How it works</p>
            <h2 id="process-title" className={s.sectionTitle}>
              Four steps, <em>zero mystery.</em>
            </h2>
          </div>
          <ol className={s.steps}>
            {processSteps.map((st, i) => (
              <li key={st.name} className={s.step} data-reveal style={{ '--i': i } as React.CSSProperties}>
                <span className={s.stepNum} aria-hidden="true">
                  {i + 1}
                </span>
                <h3 className={s.stepName}>{st.name}</h3>
                <p className={s.stepBody}>{st.body}</p>
              </li>
            ))}
          </ol>
          <div className={s.needCard} data-reveal>
            <h3 className={s.needTitle}>What I’ll need from you</h3>
            <ul>
              {youllNeed.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </div>
        </section>

        {/* ---------------- About ---------------- */}
        <section id="about" className={s.about} aria-labelledby="about-title">
          <div className={s.aboutPhotoWrap} data-reveal>
            <div className={s.aboutPhoto}>
              <Image
                src="/Alante.PNG"
                alt="Alante Velez"
                width={1086}
                height={1448}
                sizes="(max-width: 900px) 60vw, 320px"
                className={s.aboutImg}
              />
            </div>
            <Sparkle className={s.aboutSparkle} />
          </div>
          <div className={s.aboutCopy} data-reveal>
            <p className={s.eyebrow}>About</p>
            <h2 id="about-title" className={s.sectionTitle}>
              Hi, I’m Alante. <em>You’ll be working with me.</em>
            </h2>
            <p>
              I’m a designer and developer who loves the moment a business owner clicks through their new site and says, “That’s us.”
              I keep my client list small on purpose, so you talk to me directly from the first call through launch and beyond.
            </p>
            <p>
              I’ll explain things in plain language, tell you honestly what you need and what you can skip, and build something you’re
              proud to send people to. The technical side is the part I nerd out on, so you don’t have to.
            </p>
            <ul className={s.aboutPoints}>
              <li>
                <strong>Plain language.</strong> No jargon unless you ask for it.
              </li>
              <li>
                <strong>Clear scope.</strong> You know what’s included before anything starts.
              </li>
              <li>
                <strong>Still here later.</strong> Care plans keep the help going after launch.
              </li>
            </ul>
          </div>

          <details className={s.techDetails} data-reveal>
            <summary>
              <span>For the technically curious</span>
              <span className={s.summaryIcon} aria-hidden="true" />
            </summary>
            <div className={s.techBody}>
              <p>
                Most of my builds use Next.js and React with TypeScript, hosted on Vercel, with Supabase for databases and logins. Payments run
                through Stripe or PayPal and email through Resend. I also connect tools like Zoom, Calendly, AI APIs, and webhooks when a project calls for it.
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

        {/* ---------------- FAQ ---------------- */}
        <section id="faq" className={s.faq} aria-labelledby="faq-title">
          <div className={s.faqIntro} data-reveal>
            <p className={s.eyebrow}>Questions</p>
            <h2 id="faq-title" className={s.sectionTitle}>
              Good questions <em>to ask.</em>
            </h2>
            <p className={s.sectionLede}>Don’t see yours? Ask it in the form below. There are no silly ones.</p>
          </div>
          <div className={s.faqList}>
            {visibleFaqs.map((f) => (
              <details key={f.q} className={s.faqItem}>
                <summary>
                  <span>
                    {f.q} {f.draft && <Draft>Needs your review</Draft>}
                  </span>
                  <span className={s.summaryIcon} aria-hidden="true" />
                </summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* ---------------- Contact ---------------- */}
        <section id="contact" className={s.contact} aria-labelledby="contact-title">
          <div className={s.contactIntro} data-reveal>
            <p className={s.eyebrow}>Let’s talk</p>
            <h2 id="contact-title" className={s.contactTitle}>
              Tell me about <em>your website.</em>
            </h2>
            <p className={s.sectionLede}>
              A few quick details is all I need to start. You’ll get the chance to book a short intro call right after.
            </p>
            <ul className={s.contactAlt}>
              <li>
                Prefer email? <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
              </li>
              <li>
                Planning something bigger? Use the <a href="/intake">detailed project questionnaire</a>.
              </li>
            </ul>
          </div>
          <div data-reveal>
            <InquiryForm />
          </div>
        </section>
      </main>

      <footer className={s.footer}>
        <div className={s.footerTop}>
          <div>
            <p className={s.footerName}>Alante Velez</p>
            <p className={s.footerTag}>Websites people are excited to share.</p>
          </div>
          <nav aria-label="Footer" className={s.footerNav}>
            <ul>
              <li><a href="#work">Work</a></li>
              <li><a href="#services">Services</a></li>
              <li><a href="#pricing">Pricing</a></li>
              <li><a href="#care">Care Plans</a></li>
              <li><a href="#about">About</a></li>
              <li><a href="#faq">FAQ</a></li>
              <li><a href="#contact">Let’s Talk</a></li>
            </ul>
          </nav>
          <div className={s.footerWork}>
            <p className={s.footerLabel}>Recent sites</p>
            <ul>
              {projects.map((p) => (
                <li key={p.slug}>
                  <a href={p.url} target="_blank" rel="noopener noreferrer">
                    {p.name}
                    <span className={s.srOnly}> (opens in a new tab)</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className={s.footerBottom}>
          <p>
            © <Year initial={new Date().getFullYear()} /> Alante Velez. All rights reserved.
          </p>
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
        </div>
      </footer>
    </div>
  )
}
