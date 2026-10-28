import type { Metadata } from 'next'
import s from './guide.module.css'
import {
  HOURLY_RATE,
  carePlans,
  careBoundaries,
  costs,
  costsNote,
  formatUSD,
  occasionalSupport,
  packages,
  projectTerms,
  updateExamples,
} from '@/content/offers'
import { guideFaqs, guideFit, providerCosts, providerExamples, quoteFactors } from '@/content/guide'

/**
 * Printable pricing guide. Source for public/Website_Pricing_Guide.pdf.
 * Regenerate the PDF after changing offers: open /pricing-guide and print to PDF
 * (Letter, no margins, background graphics on). Steps: scripts/build-pricing-guide.md.
 */

export const metadata: Metadata = {
  title: 'Pricing Guide',
  robots: { index: false, follow: false },
}

const TOTAL = 5

function Sheet({ n, kicker, children }: { n: number; kicker: string; children: React.ReactNode }) {
  return (
    <section className={s.sheet} data-tone={n}>
      <header className={s.top}>
        <span className={s.mark}>AV</span>
        <span className={s.brand}>Alante Velez</span>
        <span className={s.kicker}>{kicker}</span>
      </header>
      <div className={s.body}>{children}</div>
      <footer className={s.foot}>
        <span>Website design, redesigns, and care • alantevelez.com</span>
        <span>
          {String(n).padStart(2, '0')} / {String(TOTAL).padStart(2, '0')}
        </span>
      </footer>
    </section>
  )
}

function Ticks({ items, cols = 1 }: { items: string[]; cols?: 1 | 2 }) {
  return (
    <ul className={`${s.ticks} ${cols === 2 ? s.twoCol : ''}`}>
      {items.map((x) => (
        <li key={x}>{x}</li>
      ))}
    </ul>
  )
}

function ProjectCard({ index }: { index: 0 | 1 | 2 }) {
  const pk = packages[index]
  const fit = guideFit[pk.id]
  return (
    <article className={s.card} data-tone={index}>
      <div className={s.cardHead}>
        <div>
          <p className={s.num}>{String(index + 1).padStart(2, '0')}</p>
          <h2 className={s.cardTitle}>{pk.name}</h2>
        </div>
        <p className={s.price}>
          <span>{pk.priceLabel}</span>
          <strong>{formatUSD(pk.price)}</strong>
        </p>
      </div>
      <p className={s.text}>
        <b>Good fit for:</b> {fit.goodFor}
      </p>
      <p className={s.label}>{pk.listLabel}</p>
      <Ticks items={pk.items} cols={2} />
      {pk.notes.map((n) => (
        <p key={n} className={s.note}>
          {n}
        </p>
      ))}
      <p className={s.example}>
        <b>Example:</b> {fit.example}
      </p>
    </article>
  )
}

export default function PricingGuide() {
  return (
    <div className={s.doc}>
      {/* 1 */}
      <Sheet n={1} kicker="Client pricing guide">
        <p className={s.eyebrow}>Website pricing guide</p>
        <h1 className={s.h1}>
          A website that fits <em>your business.</em>
        </h1>
        <p className={s.lede}>
          Every business needs something different. This guide explains the types of projects I take on, what each starting price includes, and how
          ongoing costs work.
        </p>
        <ProjectCard index={0} />
        <ProjectCard index={1} />
      </Sheet>

      {/* 2 */}
      <Sheet n={2} kicker="Custom projects">
        <h1 className={s.h2}>
          When a website <em>becomes a platform.</em>
        </h1>
        <ProjectCard index={2} />
        <h2 className={s.h3}>What affects the final quote?</h2>
        <dl className={s.table}>
          {quoteFactors.map((f) => (
            <div key={f.name}>
              <dt>{f.name}</dt>
              <dd>{f.body}</dd>
            </div>
          ))}
        </dl>
        <p className={s.callout}>
          <b>Good to know</b>
          Starting prices cover the baseline scope listed for each project type. Your final price depends on your requirements and is confirmed
          in a written proposal before any work begins.
        </p>
      </Sheet>

      {/* 3 */}
      <Sheet n={3} kicker="What you’ll pay for">
        <h1 className={s.h2}>
          Three costs, <em>kept separate.</em>
        </h1>
        <ol className={s.costs}>
          {costs.map((c, i) => (
            <li key={c.name}>
              <span className={s.costNum}>{i + 1}</span>
              <span>
                <b>{c.name}</b>
                <span>{c.body}</span>
              </span>
            </li>
          ))}
        </ol>
        <p className={s.text}>{costsNote}</p>
        <h2 className={s.h3}>Common provider costs</h2>
        <dl className={s.table}>
          {providerCosts.map((f) => (
            <div key={f.name}>
              <dt>{f.name}</dt>
              <dd>{f.body}</dd>
            </div>
          ))}
        </dl>
        <h2 className={s.h3}>Two quick examples</h2>
        <div className={s.pair}>
          {providerExamples.map((e) => (
            <div key={e.name} className={s.mini}>
              <b>{e.name}</b>
              <p>{e.body}</p>
            </div>
          ))}
        </div>
        <p className={s.callout}>
          Provider costs are separate from the project fee and from any care plan. There’s no one size monthly figure, because the services and
          charges depend on what your site uses.
        </p>
      </Sheet>

      {/* 4 */}
      <Sheet n={4} kicker="After launch">
        <h1 className={s.h2}>
          Launch day <em>isn’t goodbye.</em>
        </h1>
        <p className={s.lede}>Care plans are optional. Every plan includes scheduled checks and a brief monthly status update.</p>
        <div className={s.plans}>
          {carePlans.map((p, i) => (
            <article key={p.id} className={s.plan} data-tone={i}>
              <h2 className={s.planName}>{p.name}</h2>
              <p className={s.planPrice}>
                <strong>{formatUSD(p.monthly)}</strong> / month
              </p>
              <Ticks items={p.items} />
            </article>
          ))}
        </div>
        <div className={s.pair}>
          <div className={s.mini}>
            <b>Examples of content updates</b>
            <Ticks items={updateExamples} />
          </div>
          <div className={s.mini}>
            <b>How included time works</b>
            <ul className={s.dots}>
              {careBoundaries.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </div>
        </div>
        <div className={s.callout}>
          <b>Occasional support, no plan required</b>
          <ul className={s.dots}>
            {occasionalSupport.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </div>
      </Sheet>

      {/* 5 */}
      <Sheet n={5} kicker="What to expect">
        <h1 className={s.h2}>
          From idea <em>to launch.</em>
        </h1>
        <ol className={s.steps}>
          <li>
            <b>Discovery and proposal</b>
            <span>We talk through goals, features, timeline, and budget. You get a written scope and quote.</span>
          </li>
          <li>
            <b>Deposit and development</b>
            <span>{projectTerms[0].body}</span>
          </li>
          <li>
            <b>Review and launch</b>
            <span>{projectTerms[1].body} {projectTerms[2].body}</span>
          </li>
          <li>
            <b>The first 30 days</b>
            <span>{projectTerms[3].body}</span>
          </li>
          <li>
            <b>Ongoing support</b>
            <span>
              Choose an optional care plan, or ask for help as needed at {formatUSD(HOURLY_RATE)} an hour with a one hour minimum, or a fixed quote.
            </span>
          </li>
        </ol>
        <h2 className={s.h3}>Common questions</h2>
        <dl className={s.table}>
          {guideFaqs.map((f) => (
            <div key={f.q}>
              <dt>{f.q}</dt>
              <dd>{f.a}</dd>
            </div>
          ))}
        </dl>
        <div className={s.closing}>
          <p className={s.closingTitle}>
            Let’s build something <em>useful.</em>
          </p>
          <p>alante@alantevelez.com • alantevelez.com</p>
        </div>
        <p className={s.fine}>
          Starting prices cover the baseline scope described in this guide. Final features, fees, and terms are confirmed in your written proposal
          and agreement.
        </p>
      </Sheet>
    </div>
  )
}
