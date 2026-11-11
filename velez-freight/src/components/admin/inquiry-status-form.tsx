import { updateInquiry } from "@/app/admin/actions";
import { contactStatuses, quoteStatuses } from "@/config/admin";
import { ActionForm } from "./action-form";
import { AdminField, Panel, adminInput } from "./admin-ui";

export function InquiryStatusForm({ kind, id, status, followUp }: { kind: "contact" | "quote"; id: string; status: string; followUp: string | null }) {
  const list = kind === "contact" ? contactStatuses : quoteStatuses;
  return (
    <Panel title="Status and follow up">
      <ActionForm action={updateInquiry} submitLabel="Save">
        <input type="hidden" name="kind" value={kind} />
        <input type="hidden" name="id" value={id} />
        <div className="grid gap-3 sm:grid-cols-2">
          <AdminField label="Status" htmlFor="inq-status">
            <select id="inq-status" name="status" defaultValue={status} className={adminInput}>
              {list.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </AdminField>
          <AdminField label="Follow up date" htmlFor="inq-follow">
            <input id="inq-follow" type="date" name="follow_up_date" defaultValue={followUp ?? ""} className={adminInput} />
          </AdminField>
        </div>
        <p className="text-xs text-slate-muted">Choose Resolved to mark this inquiry complete.</p>
      </ActionForm>
    </Panel>
  );
}

export function DetailList({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
      {rows.filter(([, v]) => v !== null && v !== undefined && v !== "").map(([k, v]) => (
        <div key={k}><dt className="text-xs font-semibold uppercase tracking-wide text-slate-muted">{k}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-sm text-charcoal">{v}</dd></div>
      ))}
    </dl>
  );
}
