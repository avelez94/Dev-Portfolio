// Template rendering for outreach email. Pure functions: no I/O, safe to unit test.
//
// Variables look like {{contact.first_name}} or, with a fallback, {{contact.first_name|there}}.
// A variable with no value and no fallback blocks sending, so nobody receives "Hi ," or a raw
// placeholder. Text is escaped before any formatting is applied.

export const TEMPLATE_VARIABLES = [
  { key: "contact.first_name", label: "Contact first name" },
  { key: "contact.name", label: "Contact full name" },
  { key: "company.name", label: "Recipient company" },
  { key: "sender.name", label: "Your name" },
  { key: "sender.title", label: "Your title" },
  { key: "sender.email", label: "Your email" },
  { key: "sender.signature", label: "Your signature" },
  { key: "business.name", label: "Business name" },
  { key: "business.website", label: "Business website" },
] as const;
export type VariableKey = (typeof TEMPLATE_VARIABLES)[number]["key"];
export type Variables = Partial<Record<VariableKey, string | null | undefined>>;

const VAR = /\{\{\s*([a-z_]+\.[a-z_]+)\s*(?:\|([^}]{0,80}))?\}\}/g;
const KNOWN = new Set<string>(TEMPLATE_VARIABLES.map((v) => v.key));

export type Rendered = { text: string; missing: string[]; unknown: string[] };

/** Fills in variables. Reports variables that are missing (no value, no fallback) or unknown. */
export function fillVariables(source: string, vars: Variables): Rendered {
  const missing = new Set<string>();
  const unknown = new Set<string>();
  const text = source.replace(VAR, (_m, key: string, fallback?: string) => {
    if (!KNOWN.has(key)) {
      unknown.add(key);
      return "";
    }
    const value = vars[key as VariableKey]?.toString().trim();
    if (value) return value;
    if (fallback !== undefined && fallback.trim()) return fallback.trim();
    missing.add(key);
    return "";
  });
  // Any brace pair left over is a malformed placeholder; treat it as unknown rather than send it.
  for (const m of text.matchAll(/\{\{[^}]*\}\}/g)) unknown.add(m[0]);
  return { text, missing: [...missing], unknown: [...unknown] };
}

export function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function inline(s: string) {
  let out = escapeHtml(s);
  out = out.replace(/\[([^\]]{1,200})\]\((https:\/\/[^\s)]{1,500}|mailto:[^\s)]{1,300})\)/g, (_m, label, href) => `<a href="${href}" style="color:#B81C25">${label}</a>`);
  out = out.replace(/\*\*([^*]{1,500})\*\*/g, "<strong>$1</strong>");
  out = out.replace(/(^|[^*])\*([^*\s][^*]{0,500})\*/g, "$1<em>$2</em>");
  return out;
}

/** A small, safe subset of Markdown: paragraphs, line breaks, bullet lists, bold, italic, links. */
export function markdownToHtml(md: string) {
  const blocks = md.replace(/\r\n/g, "\n").trim().split(/\n{2,}/);
  return blocks
    .map((block) => {
      const lines = block.split("\n");
      if (lines.every((l) => /^\s*[*-]\s+/.test(l))) {
        return `<ul style="margin:0 0 16px;padding-left:20px">${lines.map((l) => `<li>${inline(l.replace(/^\s*[*-]\s+/, ""))}</li>`).join("")}</ul>`;
      }
      return `<p style="margin:0 0 16px">${lines.map(inline).join("<br>")}</p>`;
    })
    .join("\n");
}

/** Plain text version: Markdown markers removed, links written out. */
export function markdownToText(md: string) {
  return md
    .replace(/\r\n/g, "\n")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1$2")
    .replace(/^\s*[*-]\s+/gm, "• ")
    .trim();
}

export type Footer = { businessName: string; mailingAddress: string | null; unsubscribeUrl: string | null; reason: string };

export type BuiltEmail = { subject: string; html: string; text: string; missing: string[]; unknown: string[] };

/** Builds the full message with the required footer (identity, postal address, unsubscribe). */
export function buildEmail(input: { subject: string; body: string; vars: Variables; footer: Footer }): BuiltEmail {
  const subject = fillVariables(input.subject, input.vars);
  const body = fillVariables(input.body, input.vars);
  const f = input.footer;
  const footerText = [
    "",
    "",
    f.reason,
    `${f.businessName}${f.mailingAddress ? `, ${f.mailingAddress.replace(/\s*\n\s*/g, ", ")}` : ""}`,
    f.unsubscribeUrl ? `Unsubscribe: ${f.unsubscribeUrl}` : "",
  ].join("\n").trimEnd();
  const footerHtml = `<hr style="border:none;border-top:1px solid #E5E1D8;margin:28px 0 16px">
<p style="margin:0 0 6px;font-size:12px;color:#5B6470">${escapeHtml(f.reason)}</p>
<p style="margin:0 0 6px;font-size:12px;color:#5B6470">${escapeHtml(f.businessName)}${f.mailingAddress ? `, ${escapeHtml(f.mailingAddress).replace(/\s*\n\s*/g, ", ")}` : ""}</p>
${f.unsubscribeUrl ? `<p style="margin:0;font-size:12px;color:#5B6470"><a href="${escapeHtml(f.unsubscribeUrl)}" style="color:#5B6470">Unsubscribe</a> from future emails</p>` : ""}`;
  const html = `<!doctype html><html><body style="margin:0;background:#ffffff">
<div style="max-width:600px;margin:0 auto;padding:24px 20px;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#1F2A36">
${markdownToHtml(body.text)}
${footerHtml}
</div></body></html>`;
  return {
    subject: subject.text.replace(/\s+/g, " ").trim(),
    html,
    text: `${markdownToText(body.text)}${footerText}`,
    missing: [...new Set([...subject.missing, ...body.missing])],
    unknown: [...new Set([...subject.unknown, ...body.unknown])],
  };
}

export const firstName = (name: string | null | undefined) => name?.trim().split(/\s+/)[0] || null;
