"use client";

import { useRef, useState, useTransition } from "react";
import { CircleAlert, CircleCheck, LoaderCircle, Paperclip } from "lucide-react";
import { prepareDocumentUpload, recordDocument } from "@/app/admin/document-actions";
import { AdminField, adminInput } from "@/components/admin/admin-ui";
import { Button } from "@/components/ui/button";
import { DOCUMENT_ACCEPT, DOCUMENT_BUCKET, DOCUMENT_TYPES, MAX_DOCUMENT_BYTES, formatBytes } from "@/lib/documents";

type Props = {
  entityType: "shipment" | "carrier_lead" | "shipper_prospect" | "regulatory_credential";
  entityId: string;
  docTypes: { value: string; label: string }[];
  showExpiry?: boolean;
  idPrefix: string;
  /** Project URL and publishable key: public values, used only with a one time upload token. */
  storageUrl: string;
  storageKey: string;
};

/**
 * Records a document and, optionally, uploads its file. The server issues a one time upload
 * link for a random file name under this record, the browser sends the file directly to
 * private storage, then the server checks the stored file before saving the record.
 */
export function DocumentUploadForm({ entityType, entityId, docTypes, showExpiry, idPrefix, storageUrl, storageKey }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<{ ok?: boolean; text: string } | null>(null);
  const [step, setStep] = useState("");

  async function submit(form: HTMLFormElement) {
    const fd = new FormData(form);
    const file = fd.get("file");
    fd.delete("file");
    if (file instanceof File && file.size > 0) {
      if (!(file.type in DOCUMENT_TYPES)) return setStatus({ text: "Upload a PDF or a photo (JPG, PNG, WEBP or HEIC)." });
      if (file.size > MAX_DOCUMENT_BYTES) return setStatus({ text: `That file is ${formatBytes(file.size)}. Files can be up to 15 MB.` });
      setStep("Uploading");
      const ticket = await prepareDocumentUpload({ entityType, entityId, fileName: file.name, contentType: file.type, size: file.size });
      if (!ticket.ok) return setStatus({ text: ticket.error });
      const { createClient } = await import("@supabase/supabase-js");
      const client = createClient(storageUrl, storageKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
      const { error } = await client.storage.from(DOCUMENT_BUCKET).uploadToSignedUrl(ticket.path, ticket.token, file, { contentType: file.type });
      if (error) return setStatus({ text: "The upload did not finish. Check your connection and try again." });
      fd.set("storage_path", ticket.path);
      fd.set("file_name", file.name.slice(0, 200));
    }
    setStep("Saving");
    const result = await recordDocument(undefined, fd);
    if (result?.error) return setStatus({ text: result.error });
    form.reset();
    setStatus({ ok: true, text: result?.message ?? "Saved." });
  }

  return (
    <form
      ref={formRef}
      className="mb-4 space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        setStatus(null);
        startTransition(async () => {
          try {
            await submit(form);
          } catch {
            setStatus({ text: "Something went wrong. Please try again." });
          } finally {
            setStep("");
          }
        });
      }}
    >
      <input type="hidden" name="entity_type" value={entityType} />
      <input type="hidden" name="entity_id" value={entityId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <AdminField label="Type" htmlFor={`${idPrefix}-type`}>
          <select id={`${idPrefix}-type`} name="doc_type" className={adminInput}>
            {docTypes.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
        </AdminField>
        {showExpiry && (
          <AdminField label="Expires on" htmlFor={`${idPrefix}-exp`}>
            <input id={`${idPrefix}-exp`} name="expires_on" type="date" className={adminInput} />
          </AdminField>
        )}
        <AdminField label="Reference (optional)" htmlFor={`${idPrefix}-ref`} className={showExpiry ? "sm:col-span-2" : undefined}>
          <input id={`${idPrefix}-ref`} name="reference" maxLength={200} placeholder="Policy, BOL or document number" className={adminInput} />
        </AdminField>
        <AdminField label="File (PDF or photo, up to 15 MB)" htmlFor={`${idPrefix}-file`} className="sm:col-span-2">
          <input
            id={`${idPrefix}-file`}
            name="file"
            type="file"
            accept={DOCUMENT_ACCEPT}
            aria-describedby={`${idPrefix}-file-help`}
            className="block w-full text-sm text-charcoal file:mr-3 file:rounded-md file:border-0 file:bg-navy file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-navy/90"
          />
          <p id={`${idPrefix}-file-help`} className="mt-1 text-xs text-slate-muted">Stored privately. Leave empty to record the document without a file.</p>
        </AdminField>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="navy" size="sm" disabled={pending}>
          {pending ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Paperclip aria-hidden="true" />} {pending && step ? `${step}…` : "Save document"}
        </Button>
        <p role="status" aria-live="polite" className="text-sm">
          {status && !status.ok && <span className="flex items-center gap-1.5 font-medium text-brand-red-dark"><CircleAlert aria-hidden="true" className="size-4" />{status.text}</span>}
          {status?.ok && <span className="flex items-center gap-1.5 text-navy"><CircleCheck aria-hidden="true" className="size-4 text-brand-red" />{status.text}</span>}
        </p>
      </div>
    </form>
  );
}
