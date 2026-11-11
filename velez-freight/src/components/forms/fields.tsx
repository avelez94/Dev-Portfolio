"use client";

import * as React from "react";
import { CircleAlert, CircleCheck, LoaderCircle } from "lucide-react";
import { Label } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** Wraps a control with a label, optional hint and an accessible error message. */
export function Field({
  id,
  label,
  required,
  error,
  hint,
  className,
  showOptional = true,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  className?: string;
  showOptional?: boolean;
  children: React.ReactElement<Record<string, unknown>>;
}) {
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className={className}>
      <Label htmlFor={id}>
        {label}
        {required ? <span className="text-brand-red-dark" aria-hidden="true"> *</span> : showOptional ? <span className="font-normal text-slate-muted"> (optional)</span> : null}
      </Label>
      {React.cloneElement(children, { id, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy, "aria-required": required || undefined })}
      {hint && !error && <p id={`${id}-hint`} className="mt-1 text-xs text-slate-muted">{hint}</p>}
      {error && (
        <p id={`${id}-error`} className="mt-1 flex items-center gap-1 text-xs font-medium text-brand-red-dark">
          <CircleAlert aria-hidden="true" className="size-3.5" /> {error}
        </p>
      )}
    </div>
  );
}

/** Visually hidden trap field. Humans never see or fill it. */
export function Honeypot({ inputRef }: { inputRef: string }) {
  return (
    <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
      <label>
        Website
        <input id={inputRef} type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
      </label>
    </div>
  );
}

export function FormAlert({ tone, children, id }: { tone: "error" | "success"; children: React.ReactNode; id?: string }) {
  return (
    <div
      id={id}
      role={tone === "error" ? "alert" : "status"}
      tabIndex={-1}
      className={cn(
        "flex gap-3 rounded-lg border p-4 text-sm outline-none",
        tone === "error" ? "border-brand-red/40 bg-brand-red/5 text-charcoal" : "border-navy/20 bg-white text-charcoal",
      )}
    >
      {tone === "error" ? <CircleAlert aria-hidden="true" className="size-5 shrink-0 text-brand-red-dark" /> : <CircleCheck aria-hidden="true" className="size-5 shrink-0 text-brand-red" />}
      <div>{children}</div>
    </div>
  );
}

export function SubmitLabel({ pending, idle, busy = "Sending…" }: { pending: boolean; idle: React.ReactNode; busy?: string }) {
  return pending ? (
    <>
      <LoaderCircle aria-hidden="true" className="animate-spin" /> {busy}
    </>
  ) : (
    <>{idle}</>
  );
}

export function PrivacyCheckbox({ id, error, register }: { id: string; error?: string; register: Record<string, unknown> }) {
  return (
    <div>
      <label htmlFor={id} className="flex items-start gap-3 text-sm text-charcoal">
        <input id={id} type="checkbox" className="mt-0.5 size-4 shrink-0 accent-brand-red" aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-error` : undefined} {...register} />
        <span>
          I have read the{" "}
          <a href="/privacy" target="_blank" className="font-semibold text-brand-red-dark underline underline-offset-2">privacy notice</a>{" "}
          and agree that Velez Freight Group may use this information to respond to my inquiry.
        </span>
      </label>
      {error && <p id={`${id}-error`} className="mt-1 text-xs font-medium text-brand-red-dark">{error}</p>}
    </div>
  );
}
