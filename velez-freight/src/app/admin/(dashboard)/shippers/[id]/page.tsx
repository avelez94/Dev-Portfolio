import Link from "next/link";
import { notFound } from "next/navigation";
import { Globe, Mail, MapPin, Phone } from "lucide-react";
import { isAdminRole, requireStaff } from "@/lib/auth";
import { getSettings } from "@/lib/data/settings";
import { fmtDate, industryCategories, label, leadSources, prospectStatuses, quoteStatuses } from "@/config/admin";
import { fmtMoney } from "@/lib/money";
import { PageHeader } from "@/components/admin/page-header";
import { Panel, StatusBadge } from "@/components/admin/admin-ui";
import { ProspectForm } from "@/components/admin/record-forms";
import { NotesPanel, TasksPanel } from "@/components/admin/panels";
import { ActivityForm, ContactsPanel, FollowUpForm, StageForm, StageStepper, Timeline, type TimelineEvent } from "@/components/admin/crm-panels";
import { EmailHistoryPanel } from "@/components/admin/email-history-panel";
import { deleteRecord } from "@/app/admin/actions";

export const metadata = { title: "Shipper" };

export default async function ShipperPage({ params }: { params: Promise<{ id: string }> }) {
  const s = await requireStaff();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { data: p } = await s.db.from("shipper_prospects").select("*").eq("id", id).maybeSingle();
  if (!p) notFound();
  const admin = isAdminRole(s.role);
  const settings = await getSettings();
  const [contacts, stages, acts, notes, tasks, quotes, shipments, invoices, perf, sourceInquiry] = await Promise.all([
    s.db.from("shipper_contacts").select("*").eq("shipper_id", id).order("is_primary", { ascending: false }).order("name"),
    s.db.from("prospect_stage_events").select("from_status, to_status, changed_at").eq("shipper_id", id).order("changed_at"),
    s.db.from("crm_activities").select("activity_type, direction, outcome, got_response, occurred_at, summary").eq("shipper_id", id).order("occurred_at", { ascending: false }).limit(100),
    s.db.from("crm_notes").select("body, created_at").eq("entity_type", "shipper_prospect").eq("entity_id", id).order("created_at", { ascending: false }).limit(100),
    s.db.from("follow_up_tasks").select("title, status, completed_at, resolution").eq("entity_type", "shipper_prospect").eq("entity_id", id).neq("status", "open").limit(100),
    s.db.from("quotes").select("id, reference, status, customer_rate, origin_city, dest_city, created_at, sent_at, decided_at").eq("shipper_id", id).order("created_at", { ascending: false }).limit(50),
    s.db.from("shipments").select("id, reference, status, customer_rate, carrier_cost, origin_city, dest_city, booked_at, actual_delivery_at").eq("shipper_id", id).order("booked_at", { ascending: false }).limit(50),
    admin ? s.db.from("invoices").select("id, number, status, amount, issued_on, due_on").eq("shipper_id", id).order("issued_on", { ascending: false }).limit(50) : Promise.resolve({ data: null }),
    s.db.rpc("analytics_customer", { p_shipper: id }),
    p.source_inquiry_id ? s.db.from("contact_inquiries").select("id, reference, created_at, message").eq("id", p.source_inquiry_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const m = (perf.data ?? {}) as Record<string, number | string | boolean | null>;
  const stageLabel = (v: string | null) => label(prospectStatuses, v);

  const events: TimelineEvent[] = [
    ...(stages.data ?? []).map((e) => ({ at: e.changed_at, kind: "stage" as const, title: e.from_status ? `Stage changed from ${stageLabel(e.from_status)} to ${stageLabel(e.to_status)}` : `Added to the pipeline as ${stageLabel(e.to_status)}` })),
    ...(acts.data ?? []).map((a) => ({ at: a.occurred_at, kind: "activity" as const, title: `${a.direction === "inbound" ? "Inbound" : "Outbound"} ${a.activity_type}: ${a.outcome.replace("_", " ")}${a.got_response ? ", responded" : ""}`, detail: a.summary })),
    ...(notes.data ?? []).map((n) => ({ at: n.created_at, kind: "note" as const, title: "Note added", detail: n.body })),
    ...(tasks.data ?? []).filter((t) => t.completed_at).map((t) => ({ at: t.completed_at as string, kind: "task" as const, title: `Task ${t.resolution === "auto_resolved" ? "closed automatically" : t.status === "cancelled" ? "cancelled" : "completed"}: ${t.title}` })),
    ...(quotes.data ?? []).flatMap((q) => [
      { at: q.created_at, kind: "quote" as const, title: `Quote ${q.reference} created`, href: `/admin/quotes/${q.id}` },
      ...(q.sent_at ? [{ at: q.sent_at, kind: "quote" as const, title: `Quote ${q.reference} marked as sent`, href: `/admin/quotes/${q.id}` }] : []),
      ...(q.decided_at ? [{ at: q.decided_at, kind: "quote" as const, title: `Quote ${q.reference} ${q.status}`, href: `/admin/quotes/${q.id}` }] : []),
    ]),
    ...(shipments.data ?? []).flatMap((x) => [
      { at: x.booked_at, kind: "shipment" as const, title: `Shipment ${x.reference} booked`, href: `/admin/shipments/${x.id}` },
      ...(x.actual_delivery_at ? [{ at: x.actual_delivery_at, kind: "shipment" as const, title: `Shipment ${x.reference} delivered`, href: `/admin/shipments/${x.id}` }] : []),
    ]),
    ...(sourceInquiry.data ? [{ at: sourceInquiry.data.created_at, kind: "inquiry" as const, title: `Website inquiry ${sourceInquiry.data.reference}`, detail: sourceInquiry.data.message, href: `/admin/inquiries/contact/${sourceInquiry.data.id}` }] : []),
  ];

  return (
    <>
      <PageHeader title={p.company} crumbs={[{ label: "Shippers", href: "/admin/shippers" }, { label: p.company }]}
        description={[label(industryCategories, p.industry_category), p.industry, `Source: ${label(leadSources, p.source)}`].filter(Boolean).join(" · ")}
        actions={<StatusBadge value={p.status} label={stageLabel(p.status)} />}>
        <div className="mt-4 space-y-3">
          <StageStepper status={p.status} />
          <p className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-charcoal">
            {p.contact_name && <span>{p.contact_name}</span>}
            {p.email && <a className="inline-flex items-center gap-1 underline" href={`mailto:${p.email}`}><Mail aria-hidden="true" className="size-4 text-navy" />{p.email}</a>}
            {p.phone && <a className="inline-flex items-center gap-1 underline" href={`tel:${String(p.phone).replace(/[^\d+]/g, "")}`}><Phone aria-hidden="true" className="size-4 text-navy" />{p.phone}</a>}
            {p.location && <span className="inline-flex items-center gap-1"><MapPin aria-hidden="true" className="size-4 text-navy" />{p.location}</span>}
            {p.website && <span className="inline-flex items-center gap-1"><Globe aria-hidden="true" className="size-4 text-navy" />{p.website}</span>}
            {p.status === "lost" && p.lost_reason && <span className="text-slate-muted">Lost reason: {p.lost_reason}</span>}
          </p>
        </div>
      </PageHeader>

      <div className="grid gap-6 xl:grid-cols-[1.25fr_1fr]">
        <div className="space-y-6">
          <ActivityForm target="shipper" targetId={id} />
          <Timeline events={events} />
        </div>
        <div className="space-y-6">
          <Panel title="Next steps">
            <div className="space-y-5">
              <FollowUpForm target="shipper" targetId={id} current={p.next_follow_up} />
              <StageForm id={id} status={p.status} />
            </div>
          </Panel>
          <TasksPanel s={s} entityType="shipper_prospect" entityId={id} />
          <NotesPanel s={s} entityType="shipper_prospect" entityId={id} />
          <ContactsPanel shipperId={id} contacts={contacts.data ?? []} canDelete={admin} />
          <EmailHistoryPanel s={s} kind="shipper" id={id} recipients={[
            ...(p.email ? [{ key: `shipper:${id}`, label: p.contact_name || p.email }] : []),
            ...(contacts.data ?? []).filter((c: { email: string | null }) => c.email).map((c: { id: string; name: string }) => ({ key: `contact:${c.id}`, label: c.name })),
          ]} />
          <Panel title="Customer performance">
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div><dt className="text-xs text-slate-muted">Shipments</dt><dd className="font-serif text-xl font-bold text-navy">{String(m.shipments ?? 0)}</dd></div>
              <div><dt className="text-xs text-slate-muted">Completed</dt><dd className="font-serif text-xl font-bold text-navy">{String(m.completed ?? 0)}</dd></div>
              {admin && <>
                <div><dt className="text-xs text-slate-muted">Total revenue</dt><dd className="font-semibold">{fmtMoney(m.revenue as string)}</dd></div>
                <div><dt className="text-xs text-slate-muted">Brokerage margin</dt><dd className="font-semibold">{fmtMoney(m.margin as string)}</dd></div>
                <div><dt className="text-xs text-slate-muted">Average margin per load</dt><dd className="font-semibold">{m.avg_margin === null ? "Not available" : fmtMoney(m.avg_margin as string)}</dd></div>
                <div><dt className="text-xs text-slate-muted">Open balance</dt><dd className="font-semibold">{fmtMoney(m.open_balance as string)}</dd></div>
                <div><dt className="text-xs text-slate-muted">Invoices paid on time</dt><dd className="font-semibold">{Number(m.invoices_paid) > 0 ? `${m.paid_on_time} of ${m.invoices_paid}` : "Not available"}</dd></div>
                <div><dt className="text-xs text-slate-muted">Average days to pay</dt><dd className="font-semibold">{m.avg_days_to_pay ?? "Not available"}</dd></div>
              </>}
              <div><dt className="text-xs text-slate-muted">Repeat customer</dt><dd className="font-semibold">{m.repeat_customer ? "Yes" : "No"}</dd></div>
              <div><dt className="text-xs text-slate-muted">Last business activity</dt><dd className="font-semibold">{m.last_activity_at ? fmtDate(String(m.last_activity_at).slice(0, 10)) : "None yet"}</dd></div>
            </dl>
            {!settings.operational && <p className="mt-3 text-xs text-slate-muted">Shipment and revenue figures begin once brokerage operations are active.</p>}
          </Panel>
          {(quotes.data?.length || shipments.data?.length || invoices.data?.length) ? (
            <Panel title="Quotes, shipments and invoices">
              <ul className="space-y-1.5 text-sm">
                {quotes.data?.map((q) => <li key={q.id} className="flex justify-between gap-2"><Link href={`/admin/quotes/${q.id}`} className="font-mono text-xs text-brand-red-dark underline">{q.reference}</Link><span className="text-xs">{q.origin_city} to {q.dest_city}</span><StatusBadge value={q.status} label={label(quoteStatuses, q.status) || q.status.replace("_", " ")} /></li>)}
                {shipments.data?.map((x) => <li key={x.id} className="flex justify-between gap-2"><Link href={`/admin/shipments/${x.id}`} className="font-mono text-xs text-brand-red-dark underline">{x.reference}</Link><span className="text-xs">{x.origin_city} to {x.dest_city}</span><StatusBadge value={x.status} label={x.status.replace("_", " ")} /></li>)}
                {invoices.data?.map((i) => <li key={i.id} className="flex justify-between gap-2"><Link href={`/admin/invoices/${i.id}`} className="font-mono text-xs text-brand-red-dark underline">{i.number}</Link><span className="text-xs">{fmtMoney(i.amount)}</span><StatusBadge value={i.status} label={i.status} /></li>)}
              </ul>
            </Panel>
          ) : null}
          <details className="rounded-xl border border-line bg-white p-5">
            <summary className="cursor-pointer font-sans text-sm font-bold uppercase tracking-wider text-navy">Edit company details</summary>
            <div className="mt-4"><ProspectForm p={p} /></div>
          </details>
          {admin && (
            <form action={deleteRecord} className="text-right">
              <input type="hidden" name="id" value={p.id} /><input type="hidden" name="table" value="shipper_prospects" />
              <ConfirmDelete label="Delete this shipper" />
            </form>
          )}
        </div>
      </div>
    </>
  );
}

function ConfirmDelete({ label: text }: { label: string }) {
  return (
    <details className="inline-block text-left">
      <summary className="cursor-pointer text-sm font-semibold text-danger hover:underline">{text}</summary>
      <div className="mt-2 rounded-md border border-danger/30 bg-danger-soft p-3 text-sm">
        <p>This permanently removes the record and its contacts and history. Records with quotes, shipments or invoices cannot be deleted.</p>
        <button className="mt-2 rounded-md bg-danger px-3 py-1.5 font-semibold text-white">Yes, delete permanently</button>
      </div>
    </details>
  );
}
