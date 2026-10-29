/**
 * Extra content used only in the printable pricing guide (/pricing-guide).
 * Prices, inclusions, care plans, and policies come from ./offers.ts so the
 * guide and the website always match. No dashes in any of this copy.
 */

export const guideFit: Record<'business' | 'booking' | 'custom', { goodFor: string; example: string }> = {
  business: {
    goodFor: 'Hairstylists, consultants, local service providers, independent professionals, and small businesses that need a polished online presence.',
    example: 'A photographer needs visitors to learn about packages, view a portfolio, and send an inquiry. No customer logins or custom database.',
  },
  booking: {
    goodFor: 'Businesses that want visitors to schedule appointments and pay online.',
    example: 'A makeup artist wants customers to reserve a time slot, pay a deposit, and receive a booking confirmation.',
  },
  custom: {
    goodFor: 'Academies, membership businesses, organizations, and teams that need people to log in and use interactive tools.',
    example: 'An academy wants parents and students to sign in, access lessons, follow progress, get announcements, and make payments, with tools for the administrator to manage it all.',
  },
}

export const quoteFactors = [
  { name: 'Number of pages', body: 'A five page website is generally simpler than a site with dozens of unique screens.' },
  { name: 'Accounts and permissions', body: 'Sign in, password resets, and separate admin and customer roles need extra development and testing.' },
  { name: 'Custom workflows', body: 'Scheduling logic, progress tracking, reporting, and automation add complexity.' },
  { name: 'Integrations', body: 'Payment providers, email platforms, AI tools, and existing business software may need setup or custom connections.' },
  { name: 'Content and design', body: 'Custom visual design, copywriting, branding, content moves, and large amounts of content can add scope.' },
]

export const providerCosts = [
  { name: 'Domain name', body: 'Your web address. Usually renewed every year; the amount depends on the domain and registrar.' },
  { name: 'Hosting', body: 'The service that keeps your website online. The plan and its cost depend on what your site needs.' },
  { name: 'Database and storage', body: 'For sites that store accounts, content, uploads, or other data. Charges depend on usage.' },
  { name: 'Email delivery', body: 'For confirmations, reminders, and notifications. Pricing depends on how many emails the site sends.' },
  { name: 'Payment processing', body: 'A fee is usually taken from each online payment. The rate depends on your provider and payment method.' },
]

export const providerExamples = [
  { name: 'A small informational website', body: 'May only need a domain renewal and hosting. It may not need a database, user accounts, or email automation.' },
  { name: 'A student portal', body: 'May need hosting, a database, email delivery, and payment processing, with usage charges that grow as it grows.' },
]

import { careBillingFaq } from './care-terms'

export const guideFaqs = [
  { q: 'Do I have to buy a care plan?', a: 'No. Care plans are optional. Your domain, hosting, and other provider charges still apply either way.' },
  { q: careBillingFaq.q, a: careBillingFaq.a },
  { q: 'Can I request changes later?', a: 'Yes. Changes are estimated first and billed as occasional support or a fixed project quote, once you approve the estimate.' },
  { q: 'Can you give me an exact quote?', a: 'Yes, after we talk through your requirements. A written proposal confirms what is included and what is not.' },
  { q: 'Can you look after a site you didn’t build?', a: 'Possibly. I start with an initial review before agreeing to ongoing support. The review is scoped and quoted like any other work.' },
]
