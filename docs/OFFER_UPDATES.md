# Updating offers, prices, or policies

Prices, care plans, and policies live in one place and appear in three:
the website, the pricing guide PDF, and newly issued documents.

| What changed | Edit | Then |
| --- | --- | --- |
| Website or guide prices, inclusions, care plans, FAQs | `src/content/offers.ts` | Regenerate the PDF (below) |
| Guide only wording (examples, provider costs, guide FAQs) | `src/content/guide.ts` | Regenerate the PDF |
| Hourly rate, payment, revision, or defect wording in new proposals, SOWs, contracts | `src/lib/terms.ts` | Bump `TERMS_VERSION` if the wording of issued documents should stay frozen |
| An unapproved value or policy | Keep it wrapped in `proposed(...)` | Only `approved(...)` values reach production |

## Regenerating the pricing guide PDF (required after any offer change)

`public/Website_Pricing_Guide.pdf` is a generated file. Changing the offer data
does not change an already generated PDF, so `npm run build` runs
`npm run guide:check` first and **fails if the PDF is older than the offer data**.

1. `npm run build && npm run start`
2. In a second terminal: `npm run guide:pdf`
   (needs Playwright: `npm i -D playwright && npx playwright install chromium`)
3. Open the new PDF and read it through.
4. Commit `public/Website_Pricing_Guide.pdf` and `src/content/pricing-guide.stamp.json` together.

Without Playwright: open `http://localhost:3000/pricing-guide` in Chrome, Print, Save as PDF
(Letter, Margins None, Background graphics on), save over `public/Website_Pricing_Guide.pdf`,
then run `npm run guide:stamp`.

## Document terms and the database

New proposals, SOWs, and contracts are stamped with `TERMS_VERSION` and a payment plan.
They need the columns from `supabase/migrations/20261028_terms_version.sql`. If those
columns are missing, the admin refuses to issue documents and shows the migration
to run. Documents issued before the stamp existed keep their original wording.
