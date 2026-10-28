import type { MetadataRoute } from 'next'
import { SITE_URL, navLinks } from '@/content/site'

export default function sitemap(): MetadataRoute.Sitemap {
  return navLinks.map((l) => ({
    url: `${SITE_URL}${l.href === '/' ? '/' : l.href}`,
    changeFrequency: 'monthly' as const,
    priority: l.href === '/' ? 1 : 0.8,
  }))
}
