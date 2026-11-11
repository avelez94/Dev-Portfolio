import Link from "next/link";
import { ArrowRight, ChevronDown } from "lucide-react";
import type { PriorityItem } from "@/lib/priorities";
import { TIERS, toTaskView } from "@/lib/priorities";
import { Badge } from "@/components/ui/badge";
import { TaskItem, type Member } from "./task-item";

const GROUP_TEXT: Record<string, (n: number) => string> = {
  invoice: (n) => `${n} invoices are overdue`,
  payable: (n) => `${n} carrier bills are due soon`,
  follow_up: (n) => `${n} shipper follow ups are due`,
  inquiry_review: (n) => `${n} inquiries are waiting for review`,
  document: (n) => `${n} shipments are missing documents`,
  compliance: (n) => `${n} carrier compliance items need attention`,
  "3:quote": (n) => `${n} quotes are waiting for approval`,
  "4:quote": (n) => `${n} sent quotes need a customer decision`,
  quote: (n) => `${n} quotes need attention`,
  shipment: (n) => `${n} shipments need attention`,
  carrier_verification: (n) => `${n} carriers are waiting for verification review`,
};

/**
 * Renders priorities in rule order. Three or more items of the same kind collapse into one
 * summary card (expandable) so a busy day still reads as a short list.
 */
export function PriorityList({ items, team, groupThreshold = 3 }: { items: PriorityItem[]; team: Member[]; groupThreshold?: number }) {
  const counts = new Map<string, number>();
  items.forEach((i) => counts.set(`${i.priority_tier}:${i.category}`, (counts.get(`${i.priority_tier}:${i.category}`) ?? 0) + 1));
  const seen = new Set<string>();
  const blocks: React.ReactNode[] = [];
  for (const it of items) {
    const key = `${it.priority_tier}:${it.category}`;
    const n = counts.get(key) ?? 1;
    if (n < groupThreshold) { blocks.push(<TaskItem key={it.id} t={toTaskView(it)} team={team} />); continue; }
    if (seen.has(key)) continue;
    seen.add(key);
    const group = items.filter((x) => `${x.priority_tier}:${x.category}` === key);
    const tier = TIERS[it.priority_tier] ?? TIERS[5];
    const overdue = group.filter((g) => g.overdue).length;
    blocks.push(
      <li key={key} className="rounded-lg border border-line bg-white px-4 py-3">
        <div className="flex flex-wrap items-start gap-3">
          <Badge tone={tier.tone}>{tier.label}</Badge>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-navy">{(GROUP_TEXT[`${it.priority_tier}:${it.category}`] ?? GROUP_TEXT[it.category] ?? ((c: number) => `${c} ${it.category.replace("_", " ")} tasks`))(group.length)}</p>
            <p className="mt-0.5 text-xs text-slate-muted">{overdue && overdue !== group.length ? `${overdue} overdue. ` : overdue ? "All overdue. " : ""}Most urgent: {group[0].title} ({group[0].dueText.toLowerCase()}).</p>
            {it.recommended_action && <p className="mt-1.5 text-sm text-charcoal"><span className="font-semibold">Next step:</span> {it.recommended_action}</p>}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
          <Link href={`/admin/tasks?view=all&category=${it.category}`} className="inline-flex items-center gap-1 rounded-md bg-navy px-2.5 py-1.5 font-semibold text-white hover:bg-navy-800">Review all {group.length} <ArrowRight aria-hidden="true" className="size-3.5" /></Link>
        </div>
        <details className="group mt-3">
          <summary className="flex cursor-pointer list-none items-center gap-1 text-xs font-semibold text-navy"><ChevronDown aria-hidden="true" className="size-4 transition-transform group-open:rotate-180" /> Show individual items</summary>
          <ul className="mt-3 space-y-2">{group.map((g) => <TaskItem key={g.id} t={toTaskView(g)} team={team} compact />)}</ul>
        </details>
      </li>,
    );
  }
  return <ul className="space-y-3">{blocks}</ul>;
}
