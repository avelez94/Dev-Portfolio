import Link from "next/link";
import { notFound } from "next/navigation";
import { CircleAlert, CircleCheck, ExternalLink } from "lucide-react";
import { isAdminRole, requireStaff } from "@/lib/auth";
import { fmtDate, label, verificationStatuses } from "@/config/admin";
import { equipmentOptions } from "@/lib/validation";
import { fmtMoney, pct } from "@/lib/money";
import { businessToday } from "@/lib/metrics/period";
import { PageHeader } from "@/components/admin/page-header";
import { AdminField, EmptyState, Panel, StatusBadge, adminInput, adminTextarea } from "@/components/admin/admin-ui";
import { CarrierLeadForm } from "@/components/admin/record-forms";
import { NotesPanel, TasksPanel } from "@/components/admin/panels";
import { ActivityForm, Timeline, type TimelineEvent } from "@/components/admin/crm-panels";
import { ActionForm } from "@/components/admin/action-form";
import { recordVerification } from "@/app/admin/crm-actions";
import { EmailHistoryPanel } from "@/components/admin/email-history-panel";
import { DocumentsPanel } from "@/components/admin/documents-panel";

export const metadata = { title: "Carrier" };

type Q = { verified_status: boolean; authority_current: boolean; insurance_check_passed: boolean; insurance_in_force: boolean; agreement_signed: boolean; qualified: boolean };

function Rule({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return <li className="flex items-start gap-2 text-sm">{ok ? <CircleCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success" /> : <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning" />}<span>{children}<span className="sr-only">{ok ? " (met)" : " (not met)"}</span></span></li>;
}

export default async function CarrierPage({ params }: { params: Promise<{ id: string }> }) {
  const s = await requireStaff();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { data: c } = await s.db.from("carrier_leads").select("*").eq("id", id).maybeSingle();
  if (!c) notFound();
  const admin = isAdminRole(s.role);
  const [qual, checks, docs, inquiries, acts, shipments, perf, bills] = await Promise.all([
    s.db.rpc("carrier_qualification", { p_carrier: id, p_on: null }),
    s.db.from("carrier_verifications").select("*").eq("carrier_id", id).order("checked_on", { ascending: false }).order("id", { ascending: false }),
    s.db.from("documents").select("*").eq("entity_type", "carrier_lead").eq("entity_id", id).order("received_at", { ascending: false }),
    s.db.from("contact_inquiries").select("id, reference, created_at, message").eq("carrier_lead_id", id).order("created_at", { ascending: false }),
    s.db.from("crm_activities").select("activity_type, direction, outcome, occurred_at, summary").eq("carrier_id", id).order("occurred_at", { ascending: false }).limit(100),
    s.db.from("shipments").select("id, reference, status, origin_city, dest_city, booked_at, actual_delivery_at").eq("carrier_id", id).order("booked_at", { ascending: false }).limit(50),
    s.db.rpc("analytics_carrier", { p_carrier: id }),
    admin ? s.db.from("carrier_bills").select("id, amount, status, due_on, received_on").eq("carrier_id", id).order("received_on", { ascending: false }).limit(50) : Promise.resolve({ data: null }),
  ]);
  const q = (qual.data ?? {}) as Q;
  const m = (perf.data ?? {}) as { assigned?: number; completed?: number; pickup?: Record<string, number>; delivery?: Record<string, number>; exceptions?: number; avg_pod_hours?: number | null };
  const rate = (o?: Record<string, number>) => (o ? pct(o.on_time, o.on_time + o.late) : null);
  const eqLabel = (v: string) => equipmentOptions.find((e) => e.value === v)?.label ?? v;
  const events: TimelineEvent[] = [
    ...(checks.data ?? []).map((v) => ({ at: v.created_at, kind: "verification" as const, title: `${v.check_type} check: ${v.result.replace("_", " ")} (source: ${v.source})`, detail: v.notes })),
    ...(docs.data ?? []).map((d) => ({ at: d.received_at, kind: "document" as const, title: `Document recorded: ${d.doc_type.replace("_", " ")}`, detail: d.reference })),
    ...(inquiries.data ?? []).map((i) => ({ at: i.created_at, kind: "inquiry" as const, title: `Website inquiry ${i.reference}`, detail: i.message, href: `/admin/inquiries/contact/${i.id}` })),
    ...(acts.data ?? []).map((a) => ({ at: a.occurred_at, kind: "activity" as const, title: `${a.direction === "inbound" ? "Inbound" : "Outbound"} ${a.activity_type}: ${a.outcome.replace("_", " ")}`, detail: a.summary })),
    ...(shipments.data ?? []).map((x) => ({ at: x.booked_at, kind: "shipment" as const, title: `Assigned to shipment ${x.reference}`, href: `/admin/shipments/${x.id}` })),
  ];
  const today = businessToday();

  return (
    <>
      <PageHeader title={c.company_name} crumbs={[{ label: "Carriers", href: "/admin/carriers" }, { label: c.company_name }]}
        description={[c.legal_name && `Legal name: ${c.legal_name}`, c.mc_number && `MC ${c.mc_number}`, c.usdot_number && `USDOT ${c.usdot_number}`, (c.equipment ?? []).map(eqLabel).join(", "), c.operating_region].filter(Boolean).join(" · ")}
        actions={<StatusBadge value={c.verification_status} label={label(verificationStatuses, c.verification_status)} />} />

      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <div className="space-y-6">
          <Panel title="Qualification for freight assignment">
            <p className="mb-3 text-sm">Explicit rules checked before any shipment can be assigned to this carrier. The database enforces the same rules.</p>
            <ul className="space-y-1.5">
              <Rule ok={q.authority_current}>Passing authority check recorded within the last 30 days (official FMCSA record)</Rule>
              <Rule ok={q.insurance_check_passed}>Passing insurance check recorded</Rule>
              <Rule ok={q.insurance_in_force}>Insurance in force today{c.insurance_expires_on ? ` (expires ${fmtDate(c.insurance_expires_on)})` : " (no expiration recorded)"}</Rule>
              <Rule ok={q.agreement_signed}>Broker carrier agreement signed{c.agreement_signed_on ? ` on ${fmtDate(c.agreement_signed_on)}` : ""}</Rule>
              <Rule ok={q.verified_status}>Marked Verified by a team member</Rule>
            </ul>
            <p className={`mt-4 rounded-md p-3 text-sm font-semibold ${q.qualified ? "bg-success-soft text-success" : "bg-warning-soft text-warning"}`}>{q.qualified ? "Qualified for assignment today." : "Not yet qualified for assignment."}</p>
            {c.usdot_number && (
              <a href={`https://safer.fmcsa.dot.gov/query.asp?searchtype=ANY&query_type=queryCarrierSnapshot&query_param=USDOT&query_string=${c.usdot_number}`} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-red-dark underline">
                Check USDOT {c.usdot_number} on FMCSA SAFER <ExternalLink aria-hidden="true" className="size-4" />
              </a>
            )}
          </Panel>

          <Panel title="Verification evidence">
            <ActionForm action={recordVerification} submitLabel="Record check" variant="navy" resetOnSuccess className="mb-5">
              <input type="hidden" name="carrier_id" value={id} />
              <div className="grid gap-3 sm:grid-cols-3">
                <AdminField label="Check" htmlFor="v-type"><select id="v-type" name="check_type" className={adminInput}><option value="authority">Operating authority</option><option value="insurance">Insurance</option><option value="safety">Safety record</option><option value="identity">Business identity</option><option value="agreement">Agreement</option></select></AdminField>
                <AdminField label="Result" htmlFor="v-result"><select id="v-result" name="result" className={adminInput}><option value="pass">Pass</option><option value="fail">Fail</option><option value="needs_review">Needs review</option></select></AdminField>
                <AdminField label="Checked on" htmlFor="v-date"><input id="v-date" name="checked_on" type="date" max={today} defaultValue={today} className={adminInput} /></AdminField>
                <AdminField label="Source" htmlFor="v-source" className="sm:col-span-2"><input id="v-source" name="source" required maxLength={200} placeholder="e.g. FMCSA SAFER snapshot, insurer certificate" className={adminInput} /></AdminField>
                <AdminField label="Evidence reference" htmlFor="v-ref"><input id="v-ref" name="evidence_reference" maxLength={300} placeholder="Screenshot name, certificate number" className={adminInput} /></AdminField>
                <AdminField label="Notes" htmlFor="v-notes" className="sm:col-span-3"><textarea id="v-notes" name="notes" maxLength={1000} className={adminTextarea} /></AdminField>
              </div>
            </ActionForm>
            {checks.data?.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <caption className="sr-only">Verification checks</caption>
                  <thead className="text-xs uppercase tracking-wide text-slate-muted"><tr><th scope="col" className="py-2 pr-3">Date</th><th scope="col" className="py-2 pr-3">Check</th><th scope="col" className="py-2 pr-3">Result</th><th scope="col" className="py-2">Source</th></tr></thead>
                  <tbody className="divide-y divide-line">{checks.data.map((v) => <tr key={v.id}><td className="py-2 pr-3 text-xs">{fmtDate(v.checked_on)}</td><td className="py-2 pr-3 capitalize">{v.check_type}</td><td className="py-2 pr-3"><StatusBadge value={v.result} label={v.result.replace("_", " ")} /></td><td className="py-2 text-xs">{v.source}{v.evidence_reference ? ` · ${v.evidence_reference}` : ""}</td></tr>)}</tbody>
                </table>
              </div>
            ) : <EmptyState>No checks recorded yet. Look the carrier up in official FMCSA records and record what you found.</EmptyState>}
            <p className="mt-3 text-xs text-slate-muted">Evidence records cannot be edited or deleted, so the history of what was checked stays trustworthy.</p>
          </Panel>

          <ActivityForm target="carrier" targetId={id} />
          <Timeline events={events} />
        </div>

        <div className="space-y-6">
          <Panel title="Performance">
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div><dt className="text-xs text-slate-muted">Assigned shipments</dt><dd className="font-serif text-xl font-bold text-navy">{m.assigned ?? 0}</dd></div>
              <div><dt className="text-xs text-slate-muted">Completed</dt><dd className="font-serif text-xl font-bold text-navy">{m.completed ?? 0}</dd></div>
              <div><dt className="text-xs text-slate-muted">On time pickup</dt><dd className="font-semibold">{rate(m.pickup) === null ? "Not available" : `${rate(m.pickup)}%`}{m.pickup?.unknown ? <span className="block text-xs font-normal text-slate-muted">{m.pickup.unknown} unknown (no verified time)</span> : null}</dd></div>
              <div><dt className="text-xs text-slate-muted">On time delivery</dt><dd className="font-semibold">{rate(m.delivery) === null ? "Not available" : `${rate(m.delivery)}%`}{m.delivery?.unknown ? <span className="block text-xs font-normal text-slate-muted">{m.delivery.unknown} unknown</span> : null}</dd></div>
              <div><dt className="text-xs text-slate-muted">Exceptions reported</dt><dd className="font-semibold">{m.exceptions ?? 0}</dd></div>
              <div><dt className="text-xs text-slate-muted">POD turnaround</dt><dd className="font-semibold">{m.avg_pod_hours == null ? "Not available" : `${m.avg_pod_hours} hours`}</dd></div>
            </dl>
            <p className="mt-3 text-xs text-slate-muted">Rates use verified timestamps and appointment windows only. There is no automated carrier score.</p>
          </Panel>
          <TasksPanel s={s} entityType="carrier_lead" entityId={id} />
          <NotesPanel s={s} entityType="carrier_lead" entityId={id} />
          <EmailHistoryPanel s={s} kind="carrier" id={id} recipients={c.email ? [{ key: `carrier:${id}`, label: c.contact_name || c.email }] : []} />
          <DocumentsPanel entityType="carrier_lead" entityId={id} docs={docs.data ?? []} docTypes={["insurance_certificate", "carrier_agreement", "w9", "other"]} showExpiry admin={isAdminRole(s.role)} idPrefix="d" note="Files are private. W9 forms open for owners and admins only, and each download is recorded in the audit log." />
          {(shipments.data?.length ?? 0) > 0 && (
            <Panel title="Assigned shipments">
              <ul className="space-y-1.5 text-sm">{shipments.data!.map((x) => <li key={x.id} className="flex justify-between gap-2"><Link href={`/admin/shipments/${x.id}`} className="font-mono text-xs text-brand-red-dark underline">{x.reference}</Link><span className="text-xs">{x.origin_city} to {x.dest_city}</span><StatusBadge value={x.status} label={x.status.replace("_", " ")} /></li>)}</ul>
            </Panel>
          )}
          {bills.data && bills.data.length > 0 && (
            <Panel title="Payables">
              <ul className="space-y-1.5 text-sm">{bills.data.map((b) => <li key={b.id} className="flex justify-between"><span>{fmtMoney(b.amount)}</span><span className="text-xs">Due {fmtDate(b.due_on)}</span><StatusBadge value={b.status} label={b.status} /></li>)}</ul>
              <Link href={`/admin/payables?carrier=${id}`} className="mt-2 inline-block text-xs font-semibold text-brand-red-dark underline">Open payables</Link>
            </Panel>
          )}
          <details className="rounded-xl border border-line bg-white p-5">
            <summary className="cursor-pointer font-sans text-sm font-bold uppercase tracking-wider text-navy">Edit carrier details and status</summary>
            <div className="mt-4"><CarrierLeadForm c={c} /></div>
          </details>
        </div>
      </div>
    </>
  );
}
