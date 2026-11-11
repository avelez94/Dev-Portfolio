import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { restoreSiteContent, saveSiteContent } from "@/app/admin/settings-actions";
import { CONTENT_SLOTS } from "@/config/content-slots";
import { fmtDateTime } from "@/config/admin";
import { ActionForm } from "@/components/admin/action-form";
import { AdminField, Panel, adminTextarea } from "@/components/admin/admin-ui";

type Version = { id: number; key: string; version: number; value: string | null; restored_from: number | null; created_at: string; created_by: string | null };

/** Editable page text with full history. Each save is a new version; any version can be restored. */
export async function SiteTextEditor({ canEdit }: { canEdit: boolean }) {
  const s = await requireStaff();
  const [{ data: rows }, { data: versions }, { data: people }] = await Promise.all([
    s.db.from("site_content").select("key, value, version, updated_at"),
    s.db.from("site_content_versions").select("id, key, version, value, restored_from, created_at, created_by").order("id", { ascending: false }).limit(200),
    s.db.from("profiles").select("id, full_name, email"),
  ]);
  const current = new Map((rows ?? []).map((r) => [r.key, r]));
  const who = (id: string | null) => people?.find((p) => p.id === id)?.full_name || people?.find((p) => p.id === id)?.email || "Unknown";
  return (
    <Panel title="Page text" className="mt-6">
      <div id="page-text" className="scroll-mt-24" />
      <p className="mb-4 text-sm leading-relaxed">
        Edit key homepage text. Clearing a box, or leaving the approved wording, uses the approved default. Changes go live within a minute; check them first in the{" "}
        <Link href="/admin/preview" className="font-semibold text-brand-red-dark underline">launch preview</Link>. Please keep claims factual: no invented experience, shipment counts, testimonials or capabilities.
      </p>
      <ActionForm action={saveSiteContent} submitLabel="Save page text" confirm="Publish these text changes to the public website?">
        <fieldset disabled={!canEdit} className="space-y-5">
          {CONTENT_SLOTS.map((slot) => {
            const row = current.get(slot.key);
            return (
              <AdminField key={slot.key} label={`${slot.page}: ${slot.label}${row?.value ? " (edited)" : ""}`} htmlFor={`sc-${slot.key}`}>
                <textarea id={`sc-${slot.key}`} name={slot.key} maxLength={slot.max} defaultValue={row?.value ?? slot.default} className={adminTextarea} />
              </AdminField>
            );
          })}
        </fieldset>
      </ActionForm>
      <details className="mt-6 rounded-md border border-line bg-white">
        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-navy">Version history ({versions?.length ?? 0})</summary>
        {versions?.length ? (
          <ol className="divide-y divide-line border-t border-line">
            {(versions as Version[]).map((v) => {
              const slot = CONTENT_SLOTS.find((x) => x.key === v.key);
              const live = current.get(v.key)?.version === v.version;
              return (
                <li key={v.id} className="grid gap-2 px-4 py-3 text-sm sm:grid-cols-[1fr_auto] sm:items-start">
                  <div>
                    <p className="font-semibold text-navy">{slot?.label ?? v.key} <span className="text-xs font-normal text-slate-muted">version {v.version}{live ? ", live now" : ""}{v.restored_from ? ", restored" : ""}</span></p>
                    <p className="text-xs text-slate-muted">{fmtDateTime(v.created_at)} by {who(v.created_by)}</p>
                    <p className="mt-1 whitespace-pre-line text-charcoal">{v.value ?? <em>Approved default text</em>}</p>
                  </div>
                  {canEdit && !live && (
                    <ActionForm action={restoreSiteContent} submitLabel="Restore" variant="outline" trackChanges={false} confirm="Restore this version on the public website?">
                      <input type="hidden" name="version_id" value={v.id} />
                    </ActionForm>
                  )}
                </li>
              );
            })}
          </ol>
        ) : <p className="border-t border-line px-4 py-3 text-sm text-slate-muted">No edits yet. The website uses the approved text.</p>}
      </details>
    </Panel>
  );
}
