# Admin portal redesign: inventory

The admin uses the public brand turned dark: deep teal and warm charcoal surfaces, cream text, coral primary actions, Fraunces and Figtree, rounded cards, and an "Admin" label. Colors live in `src/lib/admin-theme.ts`. Client facing pages, emails, and documents keep the light brand.

Before this change every admin screen used the earlier look (Playfair Display, DM Sans, brown and tan palette, a light/dark switch). Nothing in the admin had received the website redesign.

| Area | Route or location | Before | Now | Verified by |
|---|---|---|---|---|
| Login | `/admin/login` | Old brown card | Updated: brand mark, Admin label, labeled password field | Automated: empty, wrong, and correct password; safe return path |
| Login errors | same | "Incorrect password" only | Updated: empty, wrong, too many attempts (new 8 per 15 min limit), server, offline | Automated: empty and wrong |
| Session expired, signed out | `/admin/login?expired=1`, `?signedout=1`, in page prompt | None (silent empty lists) | Updated: notice on login; prompt in the dashboard on any 401 | Automated |
| Navigation | sidebar; bottom bar on phones | Old icons, emoji theme switch | Updated: Admin label, current page marker, skip link, teal/charcoal surface switch kept, log out labeled | Automated: keyboard, focus ring |
| Dashboard | Home | Old | Updated: stats, accepted proposals, overdue invoices, projects, calls, leads with progress | Automated |
| Lead and intake details | Home, right panel | Old | Updated: progress chips, original note, questionnaire answers | Automated |
| Booking details | Home, right panel | Old | Updated: time, countdown, host link, progress | Automated |
| Pipeline | Pipeline | Old stage colors | Updated stage pills (readable on dark) | Automated |
| Client panel | Pipeline, right panel | Old | Updated: stage actions, email, invoices, meetings, documents, notes | Automated: opens, email modal, invoice forms |
| Invoice forms | client panel | Old | Updated: milestone, fixed fee, project, revision | Automated: fixed fee form reachable; PDF downloads |
| Meeting scheduling | client panel | Old; fixed summer time offset | Updated; uses the real Eastern offset all year | Visual only |
| Revenue | Revenue | Old | Updated: stats, chart, platform split, projects and invoices tables (scroll sideways on phones) | Automated |
| Invoice detail modal | Revenue | Old | Updated dialog: focus, Escape | Automated: PDF download |
| Project detail modal | Revenue | Old | Updated dialog | Automated |
| Pricing cards | Docs | Old | Updated | Visual |
| Proposal builder and preview | Docs | Old | Updated; preview dialog | Automated: preview, PDF, send |
| Contract builder | Docs | Old | Updated; 12 clause summary | Automated: PDF download |
| Templates and uploads | Docs | Old | Updated | Visual (upload not automated) |
| Schedule | Schedule | Old | Updated: calendar, day blocks, hours, blocked dates | Automated: block a day |
| Email modal | client panel | Old | Updated dialog | Automated |
| Active project prompt | Pipeline | Old | Updated dialog | Visual |
| Loading, empty, error states | everywhere | Old | Updated | Visual; errors use readable red on dark |
| Debt tracker | `/admin/debt-tracker` | Light, separate look | Updated: dark brand, Admin label, back link, error state | Automated: loads |

## Not changed

- Business rules, legal wording, document versions, permissions, and authentication. The only behavior changes are the login attempt limit, the safe return path after sign in, and the Eastern Time offset for scheduled meetings.
- The SOW PDF builder remains unused and out of the workflow.

## Not verified automatically

- Document upload to storage, and real file download from Supabase Storage.
- Sending real emails and creating real Zoom meetings from the admin (tested only against local fakes).
- The debt tracker's payment and toggle actions.
- Screen reader output beyond the automated accessibility scan.
