# Brand assets

## Logo status: interim vector recreation

The approved logo was supplied as a raster image in chat, not as a file in the repository.
`public/brand/logo-primary.svg`, `logo-reverse.svg`, `logo-mark.svg`, `src/app/icon.svg`
and `src/components/site/logo-paths.ts` are a **vector recreation** of that artwork:

* Road symbol: navy road with white dashed center line, navy shoulders, red arcs.
* VELEZ: outlined from Merriweather Black (SIL Open Font License), widened to match.
* FREIGHT GROUP: outlined from Montserrat Bold (SIL Open Font License), letterspaced.
* Red tapered rules on both sides of FREIGHT GROUP.

It closely follows the supplied design but it is **not the original master file**. Before
launch, please provide the designer's original vector (SVG, AI, EPS or PDF) or a high
resolution transparent PNG so the exact letterforms and proportions can replace this
recreation. Swapping it requires updating `logo-paths.ts` (or replacing the `Logo` component
with the supplied SVG) and the files in `public/brand/`.

## Variants

| Variant | Where | File |
| --- | --- | --- |
| Primary (navy and red on light) | Header, admin sign in | `Logo` component, `logo-primary.svg` |
| Reverse (white and red on navy) | Footer, mobile menu, admin sidebar | `Logo variant="reverse"`, `logo-reverse.svg` |
| Road mark | Decorative accents | `LogoMark`, `logo-mark.svg` |
| App icon / favicon | Browser tab, home screen | `src/app/icon.svg` |

## Colors

Signature red `#E1252F`, midnight navy `#142839`, warm ivory `#F7F5F0`, white `#FFFFFF`,
champagne `#C5A46D` (reserved, used only for a subtle admin status tint), charcoal `#22272B`.
For small red text on ivory or white the slightly deeper `#B81B24` is used so text meets
WCAG AA contrast; buttons and graphics use the signature red.
