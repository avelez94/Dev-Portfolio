/**
 * Branded email layout. Table based with inline styles so it holds up in Gmail,
 * Apple Mail, Outlook, and phone clients. Every email also gets a plain text
 * version. Fonts fall back to Georgia (headings) and Helvetica/Arial (body).
 */
import { BRAND, COLORS as C, FONTS } from '@/lib/brand'

export function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Escapes user text and keeps their line breaks. */
export function escLines(v: unknown): string {
  return esc(v).replace(/\r?\n/g, '<br>')
}

export type Button = { label: string; href: string; variant?: 'primary' | 'secondary' }

export type Block =
  | { type: 'p'; html: string }
  | { type: 'details'; rows: [string, string][]; title?: string }
  | { type: 'buttons'; items: Button[]; fallbackLink?: boolean }
  | { type: 'note'; html: string }
  | { type: 'callout'; title: string; html: string; tone?: 'teal' | 'coral' }
  | { type: 'lineItems'; rows: [string, string][]; total?: [string, string] }
  | { type: 'divider' }
  /** Prebuilt, already escaped table markup with its own plain text version. */
  | { type: 'html'; html: string; text: string }

export type EmailInput = {
  /** Short summary shown in the inbox preview line. */
  preheader: string
  eyebrow?: string
  title: string
  /** Optional italic coral ending for the title, like the website headings. */
  titleAccent?: string
  blocks: Block[]
  audience?: 'client' | 'admin'
}

export type RenderedEmail = { html: string; text: string }

const td = (style: string, inner: string) => `<td style="${style}">${inner}</td>`

function buttonHtml(b: Button): string {
  const primary = b.variant !== 'secondary'
  const bg = primary ? C.coral : C.paper
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" class="btn" style="border-collapse:separate;margin:0 12px 12px 0;display:inline-table;">
<tr><td class="btn-td" align="center" bgcolor="${bg}" style="background:${bg};border:2px solid ${C.ink};border-radius:999px;mso-padding-alt:14px 26px;">
<a class="btn-a" href="${esc(b.href)}" target="_blank" style="display:inline-block;padding:14px 26px;font-family:${FONTS.body};font-size:16px;font-weight:700;line-height:20px;color:${C.ink};text-decoration:none;border-radius:999px;">${esc(b.label)}</a>
</td></tr></table>`
}

function blockHtml(b: Block): string {
  const p = `margin:0 0 16px;font-family:${FONTS.body};font-size:16px;line-height:26px;color:${C.inkSoft};`
  switch (b.type) {
    case 'html':
      return b.html
    case 'p':
      return `<p style="${p}">${b.html}</p>`
    case 'note':
      return `<p style="margin:0 0 14px;font-family:${FONTS.body};font-size:14px;line-height:22px;color:${C.muted};">${b.html}</p>`
    case 'divider':
      return `<div style="height:1px;line-height:1px;background:${C.line};margin:8px 0 22px;">&nbsp;</div>`
    case 'details': {
      const rows = b.rows
        .map(
          ([label, value], i) =>
            `<tr>${td(
              `padding:${i === 0 ? 0 : 12}px 0 0;font-family:${FONTS.body};`,
              `<div style="font-size:12px;line-height:16px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:${C.teal};">${esc(label)}</div><div style="font-size:16px;line-height:24px;color:${C.ink};">${value}</div>`
            )}</tr>`
        )
        .join('')
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 22px;border-collapse:separate;">
<tr><td style="background:${C.cream};border:1px solid ${C.line};border-left:4px solid ${C.coral};border-radius:14px;padding:18px 20px;">
${b.title ? `<div style="font-family:${FONTS.display};font-size:18px;line-height:24px;font-weight:700;color:${C.ink};margin:0 0 10px;">${esc(b.title)}</div>` : ''}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table>
</td></tr></table>`
    }
    case 'lineItems': {
      const row = (a: string, v: string, strong = false) =>
        `<tr>${td(`padding:10px 0;border-bottom:1px solid ${C.line};font-family:${FONTS.body};font-size:15px;line-height:22px;color:${C.ink};${strong ? 'font-weight:700;' : ''}`, a)}${td(
          `padding:10px 0 10px 12px;border-bottom:1px solid ${C.line};font-family:${FONTS.body};font-size:15px;line-height:22px;color:${C.ink};text-align:right;white-space:nowrap;${strong ? 'font-weight:700;' : ''}`,
          v
        )}</tr>`
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 22px;">${b.rows.map(([a, v]) => row(a, v)).join('')}${b.total ? row(b.total[0], b.total[1], true) : ''}</table>`
    }
    case 'callout': {
      const bg = b.tone === 'coral' ? C.coralSoft : C.tealSoft
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 22px;border-collapse:separate;">
<tr><td style="background:${bg};border:2px solid ${C.ink};border-radius:14px;padding:16px 18px;font-family:${FONTS.body};">
<div style="font-family:${FONTS.display};font-size:17px;line-height:23px;font-weight:700;color:${C.ink};margin:0 0 6px;">${esc(b.title)}</div>
<div style="font-size:15px;line-height:23px;color:${C.ink};">${b.html}</div>
</td></tr></table>`
    }
    case 'buttons': {
      const fallback =
        b.fallbackLink !== false && b.items[0]
          ? `<p style="margin:4px 0 18px;font-family:${FONTS.body};font-size:13px;line-height:20px;color:${C.muted};">Button not working? Copy this link into your browser:<br><a href="${esc(b.items[0].href)}" style="color:${C.coralDeep};word-break:break-all;">${esc(b.items[0].href)}</a></p>`
          : ''
      return `<div style="margin:8px 0 6px;">${b.items.map(buttonHtml).join('')}</div>${fallback}`
    }
  }
}

function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([^<]*)<\/a>/gi, (_m, href, label) => (label === href ? href : `${label} (${href})`))
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

function blockText(b: Block): string {
  switch (b.type) {
    case 'html':
      return b.text
    case 'p':
    case 'note':
      return htmlToText(b.html)
    case 'divider':
      return '----'
    case 'details':
      return (b.title ? `${b.title}\n` : '') + b.rows.map(([l, v]) => `${l}: ${htmlToText(v)}`).join('\n')
    case 'lineItems':
      return [...b.rows, ...(b.total ? [b.total] : [])].map(([a, v]) => `${htmlToText(a)}: ${htmlToText(v)}`).join('\n')
    case 'callout':
      return `${b.title}\n${htmlToText(b.html)}`
    case 'buttons':
      return b.items.map((i) => `${i.label}: ${i.href}`).join('\n')
  }
}

export function renderEmail(input: EmailInput): RenderedEmail {
  const admin = input.audience === 'admin'
  const title = `${esc(input.title)}${input.titleAccent ? ` <em style="font-style:italic;color:${C.coralDeep};">${esc(input.titleAccent)}</em>` : ''}`
  const body = input.blocks.map(blockHtml).join('\n')

  const html = `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light">
<title>${esc(input.title)}${input.titleAccent ? ' ' + esc(input.titleAccent) : ''}</title>
<style>
  body { margin:0; padding:0; background:${C.cream}; }
  a { color:${C.coralDeep}; }
  @media (max-width: 520px) {
    .shell { padding: 20px 12px !important; }
    .card { padding: 26px 20px !important; border-radius: 20px !important; }
    .h1 { font-size: 28px !important; line-height: 34px !important; }
    .btn, .btn-td { display: block !important; width: 100% !important; margin-right: 0 !important; }
    .btn-a { display: block !important; text-align: center !important; }
    .col2 { display: block !important; width: 100% !important; border-right: 0 !important; padding-left: 0 !important; padding-right: 0 !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${C.cream};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${C.cream};">${esc(input.preheader)}&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.cream}" style="background:${C.cream};">
<tr><td class="shell" align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">
<tr><td style="padding:0 4px 18px;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
    <td width="40" height="40" align="center" valign="middle" bgcolor="${C.coral}" style="width:40px;height:40px;background:${C.coral};border:2px solid ${C.ink};border-radius:20px 20px 20px 7px;font-family:${FONTS.display};font-size:15px;font-weight:700;font-style:italic;color:${C.ink};">${BRAND.mark}</td>
    <td style="padding-left:10px;font-family:${FONTS.display};font-size:19px;font-weight:700;color:${C.ink};">${BRAND.name}${admin ? `<span style="font-family:${FONTS.body};font-size:12px;font-weight:700;color:${C.teal};letter-spacing:0.04em;"> &nbsp;STUDIO NOTE</span>` : ''}</td>
  </tr></table>
</td></tr>
<tr><td class="card" bgcolor="${C.paper}" style="background:${C.paper};border:2px solid ${C.ink};border-radius:26px;padding:34px 34px 22px;">
  ${input.eyebrow ? `<div style="font-family:${FONTS.body};font-size:13px;line-height:18px;font-weight:700;color:${C.coralDeep};margin:0 0 10px;">${esc(input.eyebrow)}</div>` : ''}
  <h1 class="h1" style="margin:0 0 18px;font-family:${FONTS.display};font-size:32px;line-height:38px;font-weight:700;color:${C.ink};letter-spacing:-0.3px;">${title}</h1>
  ${body}
</td></tr>
<tr><td style="padding:18px 8px 0;font-family:${FONTS.body};font-size:13px;line-height:20px;color:${C.muted};">
  ${admin ? 'Internal notification for your records.' : 'Questions? Just reply to this email and it comes straight to me.'}<br>
  <a href="mailto:${BRAND.email}" style="color:${C.muted};">${BRAND.email}</a> &nbsp;&bull;&nbsp; <a href="https://${BRAND.site}" style="color:${C.muted};">${BRAND.site}</a>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`

  const text = [
    BRAND.name,
    '',
    `${input.title}${input.titleAccent ? ' ' + input.titleAccent : ''}`,
    '',
    ...input.blocks.map(blockText).flatMap((t) => [t, '']),
    admin ? 'Internal notification.' : 'Questions? Just reply to this email.',
    `${BRAND.email} | ${BRAND.site}`,
  ].join('\n')

  return { html, text }
}

/** Formats a dollar amount the same way everywhere. */
export function usd(n: unknown): string {
  return `$${Number(n || 0).toLocaleString('en-US')}`
}
