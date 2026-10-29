/**
 * Payment to scan demo (preview only). The timeline was recorded from a local
 * end to end run of tests/website-care/payment_e2e.py against the real app,
 * with mock Stripe, GitHub and email services and fictional clients.
 * Regenerate with: python3 tests/website-care/make_demo.py
 */
export type DemoStep = { label: string; at: string; detail: string }
export type DemoScenario = { title: string; what: string; outcome: string }

export const careDemo = {
  recordedAt: 'Oct 29, 2026',
  checksPassed: 96,
  checksTotal: 96,
  plan: 'Business Care',
  steps: [
    { label: "Payment confirmed by Stripe", at: '+0.00 s', detail: "A verified invoice.paid webhook (billing reason subscription_create). Stripe is re-read, not trusted from the event." },
    { label: "Paid review created", at: '+0.00 s', detail: "One review for this paid period with its 30 minute allowance, a draft report and the manual checklist. Added to the admin Schedule calendar." },
    { label: "Scan queued", at: '+0.01 s', detail: "The period’s one initial scan, using the confirmed scope frozen at this moment." },
    { label: "Runner started", at: '+0.05 s', detail: "GitHub workflow dispatch requested straight from the webhook, recorded on the run (attempt 1)." },
    { label: "Scan running", at: '+0.71 s', detail: "The runner claimed the job with a lease. (Here the test started the runner itself; on GitHub Actions it takes longer to start.)" },
    { label: "Results ready", at: '+2.24 s', detail: "Findings saved, the owner emailed that results are ready, and the calendar item moved to Manual review due." },
    { label: "Report waits for review", at: '+2.24 s', detail: "Nothing is sent to the client. The report is approved and sent by hand after the manual review." },
  ] as DemoStep[],
  scenarios: [
    { title: 'Initial payment', what: 'Stripe confirms the first invoice for a confirmed website.', outcome: 'One paid review with its 30 minute allowance, one scan queued and the runner started from the webhook. The report waits for review.' },
    { title: 'Renewal', what: 'Stripe confirms the next month’s invoice.', outcome: 'A new paid review and allowance; its scan is queued and the runner started right away.' },
    { title: 'Duplicate and out of order events', what: 'Stripe retries every event, in any order, and sends the invoice before the subscription.', outcome: 'Still exactly one review, one scan and one runner start per paid period.' },
    { title: 'Runner start fails, then recovers', what: 'GitHub refuses the first two dispatches.', outcome: 'The paid review and queued scan are kept, retried with backoff by the recovery tick, and the third attempt starts it.' },
    { title: 'Runner start stays blocked', what: 'Every dispatch fails.', outcome: 'Stops after 5 attempts, emails the owner once, and offers Retry start. The queued scan is kept.' },
    { title: 'Setup changed, paused or ended', what: 'A renewal arrives while the scope needs confirming again, care is paused, or care has ended.', outcome: 'The paid review is kept, held and flagged to the owner immediately. Nothing outside the confirmed scope is scanned. Confirming or resuming queues it.' },
    { title: 'Failed or incomplete payments', what: 'The first payment fails, a fake paid event arrives for an open invoice, a checkout expires, a renewal fails.', outcome: 'No review, no scan, no runner start.' },
    { title: 'Cancel at period end', what: 'The client cancels future renewals.', outcome: 'The current paid review stays open until the period ends; no prorated refund, no new review. The billing portal is set to cancel at period end.' },
    { title: 'Billing errors and terms', what: 'A duplicate charge, a payment on an unlinked subscription, a refund, and a checkout without recorded terms.', outcome: 'Each is flagged to the owner to check and correct. Nothing is refunded or rejected automatically.' },
  ] as DemoScenario[],
}
