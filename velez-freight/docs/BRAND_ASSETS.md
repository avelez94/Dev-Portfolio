# Brand assets: Mary’s Logistics Group

## Logo source

The owner supplied the Mary’s Logistics Group logo as a high resolution PNG with a transparent
background (1536 by 1024 pixels). It is kept unchanged as the master file in
`brand-source/marys-logistics-group-logo-supplied.png`.

The website uses an exact vector trace of that file (the shapes come from the artwork; small
specks in the PNG are dropped). Fills use the brand palette.

* `scripts/brand/trace_logo.py` traces the symbol, MARY’S, LOGISTICS GROUP and the red rules.
* `scripts/brand/generate_logo_files.py` writes `src/components/site/logo-paths.ts` and every
  file below.

The original designer vector file (SVG, AI, EPS or PDF) would still be preferable for print.

## Variants

| Variant | Where | File |
| --- | --- | --- |
| Full stacked logo, navy (light backgrounds) | Footer (white version), sign in card | `public/brand/mlg-logo-stacked.svg`, `mlg-logo-stacked.png` |
| Full stacked logo, white (navy backgrounds) | Footer, social preview | `public/brand/mlg-logo-stacked-reverse.svg` |
| Compact horizontal header logo, navy | Site header | `public/brand/mlg-logo-horizontal.svg`, `Logo` component |
| Compact horizontal logo, white | Mobile menu, dashboard sidebar | `public/brand/mlg-logo-horizontal-reverse.svg` |
| Icon only symbol (ML with road) | Collapsed sidebar, decorative accents, PDF report header | `public/brand/mlg-mark.svg`, `LogoMark` |
| Favicon and app icon | Browser tab, home screen, web manifest | `src/app/icon.svg`, `src/app/apple-icon.png`, `public/brand/mlg-icon-512.png` |
| Social media profile | Profile pictures | `public/brand/mlg-social-profile.png` (1080 square), `.svg` |
| Link preview image | Open Graph and X cards | `public/og-image.jpg` |

## Archive

The previous Velez Freight Group logo files (supplied PNG, SVG variants, favicon, path data and
link preview image) are preserved in `brand-source/archive/velez-freight-group/`. They are not
served by the website and must not be used for current branding.

## Colors

Signature red `#E1252F`, midnight navy `#142839`, warm ivory `#F7F5F0`, white `#FFFFFF`,
charcoal `#22272B`, champagne `#C5A46D` (used sparingly). For small red text on light
backgrounds the deeper `#B81B24` meets WCAG AA contrast.

## Name use

* Public brand: **Mary’s Logistics Group** (with the curly apostrophe), set in `src/config/brand.ts`.
* Legal entity name: recorded in Dashboard > Settings > Business identity and shown publicly
  only after it is confirmed as registered.
* Do not describe the name as trademarked or registered until clearance is complete (see the
  launch checklist in Settings).
