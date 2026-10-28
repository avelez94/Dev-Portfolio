# Regenerating the pricing guide PDF

The guide at `public/Website_Pricing_Guide.pdf` is printed from the `/pricing-guide`
page, which reads the same offer data as the website (`src/content/offers.ts` and
`src/content/guide.ts`). Regenerate it whenever prices, plans, or policies change.

1. `npm run build && npm run start`
2. Open `http://localhost:3000/pricing-guide` in Chrome.
3. Print, then Save as PDF with: Paper size Letter, Margins None, Background graphics on.
4. Save over `public/Website_Pricing_Guide.pdf` and commit it.

Headless alternative (Playwright installed):

```
npx playwright pdf http://localhost:3000/pricing-guide public/Website_Pricing_Guide.pdf --paper-format Letter
```
