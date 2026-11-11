"use client";

import { useMemo, useRef, useState } from "react";
import { Monitor, Smartphone } from "lucide-react";
import { TEMPLATE_VARIABLES, buildEmail, type Footer, type Variables } from "@/lib/email/render";
import { adminInput, adminTextarea } from "@/components/admin/admin-ui";
import { cn } from "@/lib/utils";

/** Rendered email in an isolated frame (no scripts), at desktop or phone width. */
export function EmailPreview({ html, subject }: { html: string; subject: string }) {
  const [mobile, setMobile] = useState(false);
  return (
    <div className="rounded-lg border border-line bg-ivory p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="min-w-0 truncate text-sm"><span className="text-slate-muted">Subject:</span> <strong className="text-navy">{subject || "(no subject)"}</strong></p>
        <div role="group" aria-label="Preview width" className="flex shrink-0 gap-1">
          <button type="button" aria-pressed={!mobile} onClick={() => setMobile(false)} className={cn("rounded p-1.5", !mobile ? "bg-navy text-white" : "text-navy hover:bg-white")}><Monitor aria-hidden="true" className="size-4" /><span className="sr-only">Desktop</span></button>
          <button type="button" aria-pressed={mobile} onClick={() => setMobile(true)} className={cn("rounded p-1.5", mobile ? "bg-navy text-white" : "text-navy hover:bg-white")}><Smartphone aria-hidden="true" className="size-4" /><span className="sr-only">Phone</span></button>
        </div>
      </div>
      <iframe title="Email preview" sandbox="" srcDoc={html} className={cn("mx-auto block h-[28rem] rounded border border-line bg-white transition-[width]", mobile ? "w-[375px] max-w-full" : "w-full")} />
    </div>
  );
}

/** Subject and body fields with variable buttons and a live preview using real or sample values. */
export function EmailComposer({ subject: initialSubject, body: initialBody, vars, footer, idPrefix = "em" }: { subject: string; body: string; vars: Variables; footer: Footer; idPrefix?: string }) {
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const built = useMemo(() => buildEmail({ subject, body, vars, footer }), [subject, body, vars, footer]);

  const insert = (key: string) => {
    const el = bodyRef.current;
    const token = `{{${key}}}`;
    if (!el) return setBody((b) => b + token);
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    const next = body.slice(0, start) + token + body.slice(end);
    setBody(next);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(start + token.length, start + token.length); });
  };

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <div className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor={`${idPrefix}-subject`} className="block text-xs font-semibold uppercase tracking-wide text-navy">Subject</label>
          <input id={`${idPrefix}-subject`} name="subject" required maxLength={200} value={subject} onChange={(e) => setSubject(e.target.value)} className={adminInput} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor={`${idPrefix}-body`} className="block text-xs font-semibold uppercase tracking-wide text-navy">Message</label>
          <textarea id={`${idPrefix}-body`} ref={bodyRef} name="body" required maxLength={20000} value={body} onChange={(e) => setBody(e.target.value)} className={cn(adminTextarea, "min-h-72 font-mono text-[0.85rem]")} />
          <p className="text-xs text-slate-muted">Blank line for a new paragraph. **bold**, *italic*, [link text](https://example.com), and lines starting with * for a list. Add a fallback with a bar, for example {"{{contact.first_name|there}}"}.</p>
        </div>
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-navy">Insert information</p>
          <div className="flex flex-wrap gap-1.5">
            {TEMPLATE_VARIABLES.map((v) => (
              <button key={v.key} type="button" onClick={() => insert(v.key)} className="rounded-full border border-line bg-white px-2.5 py-1 text-xs hover:border-navy">{v.label}</button>
            ))}
          </div>
        </div>
        {(built.missing.length > 0 || built.unknown.length > 0) && (
          <p role="status" className="rounded-md bg-warning-soft p-3 text-sm">
            {built.missing.length > 0 && <>Missing information: {built.missing.join(", ")}. Add it to the record or use a fallback. </>}
            {built.unknown.length > 0 && <>Unknown placeholders: {built.unknown.join(", ")}.</>}
          </p>
        )}
      </div>
      <div>
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-navy">Preview</p>
        <EmailPreview html={built.html} subject={built.subject} />
        <details className="mt-2 text-xs">
          <summary className="cursor-pointer font-semibold text-navy">Plain text version</summary>
          <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded bg-white p-3 font-sans">{built.text}</pre>
        </details>
      </div>
    </div>
  );
}
