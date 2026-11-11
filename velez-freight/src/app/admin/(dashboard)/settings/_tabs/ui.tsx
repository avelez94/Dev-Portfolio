import { CircleAlert, CircleCheck } from "lucide-react";
import type { StaffSession } from "@/lib/auth";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SettingsRow = Record<string, any>;
export type TabProps = { s: StaffSession; b: SettingsRow; canEdit: boolean };

export const val = (x: string | null | undefined) => x ?? "";

export function Toggle({ name, label, checked, disabled }: { name: string; label: React.ReactNode; checked: boolean; disabled?: boolean }) {
  return (
    <label className="flex items-center gap-3 rounded-md border border-line bg-white px-3 py-2.5 text-sm">
      <input type="checkbox" name={name} defaultChecked={checked} disabled={disabled} className="size-4 accent-brand-red" /> {label}
    </label>
  );
}

export function Check({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-sm">
      {ok ? <CircleCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success" /> : <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning" />}
      <span>{children}<span className="sr-only">{ok ? " (done)" : " (not done)"}</span></span>
    </li>
  );
}

export function Pill({ tone, children }: { tone: "ok" | "warn" | "muted" | "danger"; children: React.ReactNode }) {
  const cls = { ok: "bg-success/15 text-success", warn: "bg-warning-soft text-warning", muted: "bg-ivory text-slate-muted", danger: "bg-danger-soft text-danger" }[tone];
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}>{children}</span>;
}

export function ReadOnlyNote({ canEdit }: { canEdit: boolean }) {
  return canEdit ? null : <p className="mb-4 rounded-md bg-ivory p-3 text-sm">You can view these settings. Owners and admins can change them.</p>;
}
