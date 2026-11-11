import { Download, FileText, Lock } from "lucide-react";
import { fmtDate, fmtDateTime } from "@/config/admin";
import { env } from "@/lib/env";
import { DOC_TYPE_LABELS, RESTRICTED_DOC_TYPES, formatBytes } from "@/lib/documents";
import { Panel } from "@/components/admin/admin-ui";
import { DocumentUploadForm } from "@/components/admin/document-upload-form";

export type DocumentRow = {
  id: string; doc_type: string; reference: string | null; received_at: string; expires_on: string | null;
  storage_path: string | null; file_name: string | null; file_size: number | null;
};

/** Document list with private file links, plus the upload form. */
export function DocumentsPanel({ entityType, entityId, docs, docTypes, showExpiry, admin, idPrefix, note }: {
  entityType: "shipment" | "carrier_lead" | "shipper_prospect";
  entityId: string;
  docs: DocumentRow[];
  docTypes: string[];
  showExpiry?: boolean;
  admin: boolean;
  idPrefix: string;
  note?: string;
}) {
  return (
    <Panel title="Documents">
      <DocumentUploadForm
        entityType={entityType}
        entityId={entityId}
        docTypes={docTypes.map((value) => ({ value, label: DOC_TYPE_LABELS[value] ?? value }))}
        showExpiry={showExpiry}
        idPrefix={idPrefix}
        storageUrl={env.supabaseUrl}
        storageKey={env.supabaseAnonKey}
      />
      {docs.length ? (
        <ul className="divide-y divide-border text-sm">
          {docs.map((d) => {
            const restricted = RESTRICTED_DOC_TYPES.has(d.doc_type) && !admin;
            return (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2">
                <span className="min-w-0">
                  <span className="font-medium text-navy">{DOC_TYPE_LABELS[d.doc_type] ?? d.doc_type}</span>
                  {d.reference && <span className="text-slate-muted"> · {d.reference}</span>}
                  <span className="block text-xs text-slate-muted">
                    {d.expires_on ? `Expires ${fmtDate(d.expires_on)} · ` : ""}Received {fmtDateTime(d.received_at)}
                  </span>
                </span>
                {d.storage_path ? (
                  restricted ? (
                    <span className="flex items-center gap-1 text-xs text-slate-muted"><Lock aria-hidden="true" className="size-3.5" />Owner or admin only</span>
                  ) : (
                    <a href={`/admin/documents/${d.id}`} className="flex items-center gap-1.5 text-xs font-semibold text-navy underline-offset-4 hover:underline" aria-label={`Download ${DOC_TYPE_LABELS[d.doc_type] ?? "document"}${d.file_name ? `, ${d.file_name}` : ""}`}>
                      <Download aria-hidden="true" className="size-3.5" />
                      <span className="max-w-48 truncate">{d.file_name ?? "Download"}</span>
                      {d.file_size ? <span className="font-normal text-slate-muted">({formatBytes(d.file_size)})</span> : null}
                    </a>
                  )
                ) : (
                  <span className="flex items-center gap-1 text-xs text-slate-muted"><FileText aria-hidden="true" className="size-3.5" />No file attached</span>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-slate-muted">No documents yet.</p>
      )}
      <p className="mt-3 text-xs text-slate-muted">{note ?? "Files are private. Each download is recorded in the audit log."} Bank account details are never stored here.</p>
    </Panel>
  );
}
