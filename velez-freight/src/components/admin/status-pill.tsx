export function StatusPill({ tone, children }: { tone: "ok" | "warn" | "muted" | "danger"; children: React.ReactNode }) {
  const cls = { ok: "bg-success/15 text-success", warn: "bg-warning-soft text-warning", muted: "bg-ivory text-slate-muted", danger: "bg-danger-soft text-danger" }[tone];
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}>{children}</span>;
}
