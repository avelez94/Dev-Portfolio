'use client'

import { COLORS as C, FONTS as F } from '@/lib/brand'

/**
 * Wrapper for the client facing proposal, SOW, and contract pages.
 *
 * Documents issued under the current terms get the studio styling layered on
 * top of the page's original stylesheet. Documents issued before that keep the
 * original stylesheet only, so a client reopening an older proposal or signed
 * contract sees it exactly as it was issued. Loading and error screens aren't
 * documents, so they always use the studio styling.
 */

const BRANDED_DOC_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght,SOFT@9..144,500..700,100&family=Figtree:wght@400;500;600;700&display=swap');
  html, body { background: ${C.cream} !important; color: ${C.ink}; font-family: ${F.body}; font-weight: 400; }
  .doc-bg { background: ${C.cream} !important; }
  .shell { padding-top: 40px; }

  .top-bar { display: grid; grid-template-columns: auto 1fr; column-gap: 14px; align-items: center; margin-bottom: 32px; padding-bottom: 22px; border-bottom: 2px solid ${C.line}; }
  .top-bar::before { content: 'AV'; grid-row: span 2; width: 46px; height: 46px; border-radius: 14px; background: ${C.coral}; color: ${C.ink}; border: 2px solid ${C.ink}; box-shadow: 3px 3px 0 ${C.ink}; display: flex; align-items: center; justify-content: center; font: 700 17px/1 ${F.display}; letter-spacing: 0.02em; }
  .logo { font-family: ${F.display}; font-variation-settings: 'SOFT' 100; font-size: 22px; font-weight: 650; color: ${C.ink}; margin: 0; }
  .logo-sub { font-family: ${F.body}; font-size: 12px; font-weight: 700; color: ${C.coralDeep}; letter-spacing: 0.14em; }

  .card { background: ${C.paper}; border: 1.5px solid ${C.line}; border-radius: 18px; padding: 24px; margin-bottom: 14px; }
  .accent-card { background: ${C.tealDeep}; border-color: ${C.tealDeep}; }
  .eyebrow, .clause-title { font-family: ${F.body}; font-size: 11px; font-weight: 700; color: ${C.coralDeep}; letter-spacing: 0.14em; }
  .card-title, .party-name, .milestone-name, .ms-name, .done-title, .total-row span { font-family: ${F.display}; font-variation-settings: 'SOFT' 100; font-weight: 650; color: ${C.ink}; }
  .card-sub, .party-label, .party-sub, .milestone-due, .ms-due, .deposit-note, .sig-label, .loading, .error-msg, .payment-value { font-family: ${F.body}; }
  .card-sub, .party-label, .party-sub, .milestone-due, .ms-due, .deposit-note, .sig-label, .legal-note { color: ${C.muted}; }
  .deposit-note { font-size: 13px; line-height: 1.75; }
  .deposit-note strong, .payment-value { color: ${C.ink}; font-weight: 600; }
  .body-text, .clause-body, .milestone-deliverables, .ms-deliverables, .payment-label, .line-desc { color: ${C.inkSoft}; }
  .line-item, .payment-row, .ms { border-color: ${C.line} !important; }
  .total-row { border-top: 2px solid ${C.ink}; }
  .total-amount, .payment-value.accent { color: ${C.tealDeep} !important; }
  .milestone { border: 1.5px solid ${C.line}; border-radius: 14px; background: ${C.cream}; }
  .milestone-fee, .ms-fee { font-family: ${F.body}; color: ${C.tealDeep}; font-weight: 700; }
  .done-mark { color: ${C.coral}; }
  .done-body { color: ${C.inkSoft}; }
  .error-msg { color: ${C.coralDeep}; font-size: 13px; }

  .btn-accept, .btn-sign, .btn-decline, .btn-ghost { font-family: ${F.body}; font-size: 15px; font-weight: 700; letter-spacing: 0; text-transform: none; border-radius: 999px; padding: 13px 28px; border: 2px solid ${C.ink}; transition: transform 0.15s, box-shadow 0.15s, background 0.2s; }
  .btn-accept, .btn-sign { background: ${C.coral}; color: ${C.ink}; box-shadow: 3px 3px 0 ${C.ink}; }
  .btn-accept:hover:not(:disabled), .btn-sign:hover:not(:disabled) { background: ${C.coral}; transform: translate(-1px, -1px); box-shadow: 4px 4px 0 ${C.ink}; }
  .btn-decline { background: ${C.ink}; color: ${C.cream}; }
  .btn-ghost { background: transparent; color: ${C.ink}; }
  .btn-ghost:hover { color: ${C.coralDeep}; border-color: ${C.ink}; }
  .btn-clear { font-family: ${F.body}; font-size: 13px; font-weight: 600; text-transform: none; letter-spacing: 0; color: ${C.inkSoft}; text-decoration: underline; text-underline-offset: 3px; }
  .btn-clear:hover { color: ${C.coralDeep}; }

  .name-input, .decline-input { background: ${C.cream}; border: 2px solid ${C.line}; border-radius: 12px; font-family: ${F.body}; color: ${C.ink}; }
  .name-input:focus, .decline-input:focus { border-color: ${C.ink}; }
  .canvas-wrap { border: 2px solid ${C.line}; border-radius: 14px; background: #FFFFFF; }
  .sig-placeholder { font-family: ${F.display}; color: rgba(179, 58, 38, 0.3); }

  button:focus-visible, a:focus-visible, input:focus-visible, textarea:focus-visible { outline: 3px solid ${C.teal}; outline-offset: 3px; }

  @media (max-width: 560px) {
    .shell { padding: 28px 16px 72px; }
    .card { padding: 20px 18px; }
    .party-row { grid-template-columns: 1fr; gap: 16px; }
    .action-row { flex-direction: column-reverse; align-items: stretch; }
    .action-row button { width: 100%; }
    .done-title { font-size: 28px; }
  }
  @media (prefers-reduced-motion: reduce) {
    .btn-accept, .btn-sign, .btn-decline, .btn-ghost { transition: none; }
    .btn-accept:hover:not(:disabled), .btn-sign:hover:not(:disabled) { transform: none; }
  }
`

export function DocShell({ legacyStyles, branded, children }: { legacyStyles: string; branded: boolean; children: React.ReactNode }) {
  return (
    <>
      <style>{legacyStyles}</style>
      {branded && <style>{BRANDED_DOC_CSS}</style>}
      <div className="doc-bg" style={{ background: '#FAF3E8', minHeight: '100vh' }} data-doc-style={branded ? 'studio' : 'original'}>
        <div className="shell">{children}</div>
      </div>
    </>
  )
}
