/**
 * Website Care payments for Revenue. Every payment is counted exactly once:
 *
 *   stripe   the amount Stripe collected for that period's invoice (one
 *            period per Stripe invoice, enforced by a unique key).
 *   invoice  nothing here. The period was paid by one of your invoices, which
 *            Revenue already counts when it's marked paid.
 *   direct   the amount you recorded as received outside invoices (Zelle,
 *            check, cash), on the date you received it.
 *
 * Never counted: test websites, Stripe test mode payments, periods without a
 * recorded payment, and included plan minutes (time, not money).
 */

export type CarePaymentSource = {
  id: string
  site_id: string
  source: string
  is_test?: boolean | null
  payment_method?: string | null
  payment_invoice_id?: string | null
  payment_amount_cents?: number | null
  payment_received_on?: string | null
  payment_reference?: string | null
  amount_paid?: number | null
  currency?: string | null
  paid_at?: string | null
  period_start: string
  period_end: string
  plan?: string | null
  billing_flag?: string | null
  included_minutes?: number | null
}

export type CarePaymentRow = {
  cycle_id: string
  site_id: string
  site_label: string
  period_start: string
  period_end: string
  method: 'stripe' | 'invoice' | 'direct' | 'not_recorded'
  /** What Revenue counts for this row, in dollars. Zero for invoice, test, and unrecorded rows. */
  counted: number
  /** The amount paid, in dollars, even when it isn't counted here (test rows). Null for invoice and unrecorded rows. */
  amount: number | null
  /** When the money was received (YYYY-MM-DD). */
  received_on: string | null
  invoice_id: string | null
  invoice_number: string | null
  reference: string | null
  test: boolean
  note: string
  flag: string | null
}

const day = (v: string | null | undefined) => (v ? String(v).slice(0, 10) : null)

export function carePayments(
  cycles: CarePaymentSource[],
  sites: { id: string; label: string; is_test?: boolean | null }[],
  invoices: { id: string; invoice_number: string }[] = [],
): CarePaymentRow[] {
  const siteOf = new Map(sites.map((s) => [s.id, s]))
  const invOf = new Map(invoices.map((i) => [i.id, i]))
  return cycles.map((c) => {
    const site = siteOf.get(c.site_id)
    const test = !!c.is_test || !!site?.is_test
    const method: CarePaymentRow['method'] = c.payment_method === 'invoice' || c.payment_method === 'direct' || c.payment_method === 'stripe'
      ? c.payment_method
      : c.source === 'stripe' ? 'stripe' : 'not_recorded'
    let amount: number | null = null
    let received: string | null = null
    let note = ''
    if (method === 'stripe') {
      amount = typeof c.amount_paid === 'number' ? c.amount_paid / 100 : null
      received = day(c.paid_at)
      note = (c.currency || 'usd').toLowerCase() === 'usd' ? 'Stripe subscription payment' : `Stripe payment in ${String(c.currency).toUpperCase()} (not converted)`
    } else if (method === 'direct') {
      amount = typeof c.payment_amount_cents === 'number' ? c.payment_amount_cents / 100 : null
      received = day(c.payment_received_on)
      note = 'Paid directly'
    } else if (method === 'invoice') {
      const inv = c.payment_invoice_id ? invOf.get(c.payment_invoice_id) : undefined
      note = inv ? `Counted once, in invoice ${inv.invoice_number}` : 'Counted once, in its invoice'
    } else {
      note = 'No payment recorded for this period'
    }
    const countable = !test && amount !== null && (method === 'direct' || (method === 'stripe' && (c.currency || 'usd').toLowerCase() === 'usd'))
    return {
      cycle_id: c.id, site_id: c.site_id, site_label: site?.label || 'Website', period_start: day(c.period_start)!, period_end: day(c.period_end)!,
      method, counted: countable ? amount! : 0, amount: method === 'invoice' ? null : amount, received_on: received,
      invoice_id: c.payment_invoice_id || null, invoice_number: c.payment_invoice_id ? invOf.get(c.payment_invoice_id)?.invoice_number || null : null,
      reference: c.payment_reference || null, test, note: test ? `${note}. Test, not counted` : note, flag: c.billing_flag || null,
    }
  })
}
