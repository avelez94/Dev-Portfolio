import s from '@/components/site/site.module.css'
import SiteHeader from '@/components/site/SiteHeader'
import SiteFooter from '@/components/site/SiteFooter'
import RevealObserver from '@/components/site/RevealObserver'
import { CONTACT_EMAIL, SITE_URL, services } from '@/content/site'

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'ProfessionalService',
  name: 'Alante Velez',
  url: SITE_URL,
  email: CONTACT_EMAIL,
  image: `${SITE_URL}/Alante.PNG`,
  description:
    'Website design, website redesigns, custom web development, and ongoing website care for small businesses, service providers, consultants, and creators.',
  areaServed: { '@type': 'Country', name: 'United States' },
  founder: { '@type': 'Person', name: 'Alante Velez', url: `${SITE_URL}/about` },
  knowsAbout: services.map((sv) => sv.name),
}

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={s.page}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <RevealObserver />
      <SiteHeader />
      <main id="main" tabIndex={-1} className={s.main}>
        {children}
      </main>
      <SiteFooter />
    </div>
  )
}
