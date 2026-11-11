# Brand assets

## Logo source

The owner supplied the logo as a high resolution PNG (2172 by 724 pixels, transparent
background). It is kept unchanged as the master file in
`brand-source/velez-freight-logo-supplied.png`.

The website uses an exact vector trace of that file, so the logo stays sharp at every size
and works in both color variants:

* `scripts/brand/trace_logo.py` traces the navy, red and white areas of the PNG (potrace).
* `scripts/brand/generate_logo_files.py` writes `src/components/site/logo-paths.ts`,
  `public/brand/logo-primary.svg`, `logo-reverse.svg`, `logo-mark.svg` and `src/app/icon.svg`.

The shapes come from the supplied artwork; the fills use the brand palette (navy `#142839`,
red `#E1252F`), which differs only slightly from the navy in the PNG. If the designer's
original vector file (SVG, AI, EPS or PDF) becomes available, it can replace the trace.

## Variants

| Variant | Where | File |
| --- | --- | --- |
| Primary (navy and red on light) | Header, admin sign in | `Logo` component, `logo-primary.svg` |
| Reverse (white and red on navy) | Footer, mobile menu, admin sidebar | `Logo variant="reverse"`, `logo-reverse.svg` |
| Road mark | Decorative accents | `LogoMark`, `logo-mark.svg` |
| App icon / favicon (road symbol on navy) | Browser tab, home screen | `src/app/icon.svg` |
| Social share image | Link previews | `public/og-image.jpg` |

## Colors

Signature red `#E1252F`, midnight navy `#142839`, warm ivory `#F7F5F0`, white `#FFFFFF`,
champagne `#C5A46D` (reserved, used only for a subtle admin status tint), charcoal `#22272B`.
For small red text on ivory or white the slightly deeper `#B81B24` is used so text meets
WCAG AA contrast; buttons and graphics use the signature red.
