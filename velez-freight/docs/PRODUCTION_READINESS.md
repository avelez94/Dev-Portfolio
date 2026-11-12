# Production readiness checklist

Nothing below has been done to the live site or database without the owner's approval. Each
item says who acts and where.

## 1. Database (applied 2026-11-11 with owner approval)

Applied in order to the live Supabase project; each is additive with a rollback script in
`supabase/rollback/`. Verified after applying: 11 credential rows, 7 templates with versions,
7 agents all disabled, sending not approved, operations off, Row Level Security on all 13 new
tables, and the task refresh runs.

| Migration | Adds |
| --- | --- |
| `20261120000100_settings_center.sql` | Company profile and contact fields, regulatory credentials and history, display preferences, versioned website text |
| `20261121000100_outreach.sql` | Email templates (seven starters), sender identities, messages, delivery events, do not email list, sending controls |
| `20261122000100_priorities_and_agents.sql` | Priority rules for outreach, carrier verification and credential renewals; agent registry (all disabled), runs, approval requests |

Deployed to production on 2026-11-11 with owner approval (commit 3863954). Checked after
deploying: public pages load, signed out visitors are sent to sign in, the unsubscribe page
rejects invalid links, and no runtime errors.

### Pending approval

| Migration | Adds |
| --- | --- |
| `20261123000100_inquiry_attribution.sql` | Landing page, channel and search engine for website inquiries (Insights, Search & SEO). Until it is applied, inquiries still save normally and the SEO tab shows no attributed inquiries |

## 2. Hosting environment (owner approval required)

| Variable | Purpose | Status |
| --- | --- | --- |
| `UNSUBSCRIBE_SECRET` | Signs unsubscribe links | Not set (falls back to `FORM_TOKEN_SECRET`) |
| `RESEND_API_KEY` | Email provider | Not set |
| `NOTIFY_EMAIL_FROM`, `NOTIFY_EMAIL_TO` | Internal alerts | Not set |
| `RESEND_WEBHOOK_SECRET` | Delivery updates | Not set; create the webhook first |
| `BROKER_AUTHORITY_ACTIVE` | Brokerage master switch | `false`; stays false until authority is verified |
| `GSC_SITE_URL`, `GSC_CLIENT_EMAIL`, `GSC_PRIVATE_KEY` | Search Console data in Insights (read only) | Not set; see `docs/SEO_STRATEGY.md` |

## 3. Domain and email

1. Chosen domain: `maryslogisticsgroup.com` (not yet purchased). Register it, then record it in
   Business Settings > Company Profile.
2. Connect it in Vercel and update `NEXT_PUBLIC_SITE_URL` (see `docs/REBRAND_GAP_ANALYSIS.md`).
3. Add the domain in Resend; add its SPF and DKIM records at the registrar; add a DMARC record.
4. Outreach > Sending Setup: enter the domain, then "Check domain status" until it is verified.
5. Add a sender identity on that domain (name, title, signature).
6. Business Settings > Company Profile: add the mailing address for email footers (CAN-SPAM).
7. Create the Resend webhook to `https://<domain>/api/webhooks/resend` (delivered, delayed,
   bounced, complained) and set `RESEND_WEBHOOK_SECRET`.
8. Send one test email to yourself through the full approval flow before any outreach.
9. Only then type APPROVE SENDING. Every message still needs individual approval.

## 4. Brokerage launch (owner)

1. Business Settings > Regulatory & Compliance: enter and verify the MC and USDOT numbers,
   broker authority, BMC 84 or 85, BOC 3 and insurance, each with source, date and evidence.
2. Complete the launch checklist (name approval, trademark, banking, insurance, templates).
3. Review the site in the launch preview.
4. With approval: set `BROKER_AUTHORITY_ACTIVE=true`, redeploy, then enable operations in the
   dashboard (typed confirmation).
5. Choose which verified credentials appear in the footer (Public Website tab).

## 5. Before inviting staff

* Confirm each person's role (owner, admin, staff) against the permissions table in Business
  Settings > Team & Permissions.
* Staff can draft outreach but not approve or send it.

## 6. Not connected (by design, until approved)

* AI provider for the six AI agents. None is connected or paid for.
* Inbound email (reply tracking). Replies go to the regular inbox.
* Automatic FMCSA lookups. The dashboard links to official records for manual checks.
* Scheduled agent runs. The executive brief runs on demand.

## 7. Verified before this handoff

| Check | Result |
| --- | --- |
| Unit tests (rendering, signatures, validation, tokens) | 24 passing |
| Database tests (RLS, constraints, history, gates, rollbacks) | 54 passing |
| Browser tests, prelaunch and operating builds, including accessibility scans | See the phase report |
| Type check and lint | Clean |
| Real email sent | None; tests use a local stand in for the provider |
