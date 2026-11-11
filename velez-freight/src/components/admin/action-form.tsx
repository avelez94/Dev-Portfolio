"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { CircleAlert, CircleCheck, LoaderCircle } from "lucide-react";
import type { ActionState } from "@/app/admin/form-helpers";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Form bound to a server action with pending state and accessible success or error feedback. */
export function ActionForm({
  action,
  children,
  submitLabel,
  className,
  variant = "primary",
  resetOnSuccess = false,
  confirm,
  trackChanges = true,
}: {
  action: (state: ActionState, fd: FormData) => Promise<ActionState>;
  children: React.ReactNode;
  submitLabel: string;
  className?: string;
  variant?: "primary" | "navy" | "outline";
  resetOnSuccess?: boolean;
  /** Asks before submitting (for changes that affect the public website or operations). */
  confirm?: string;
  /** Shows an unsaved changes marker with Cancel, and warns before leaving the page. */
  trackChanges?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const [dirty, setDirty] = useState(false);
  // Clear the unsaved marker once the server confirms the save (state changes only after a submit).
  const [seenState, setSeenState] = useState(state);
  if (state !== seenState) {
    setSeenState(state);
    if (state?.ok) setDirty(false);
  }
  useEffect(() => {
    if (state?.ok && resetOnSuccess) formRef.current?.reset();
  }, [state, resetOnSuccess]);
  useEffect(() => {
    if (!dirty || !trackChanges) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, trackChanges]);
  return (
    <form
      ref={formRef}
      // Submit through onSubmit so React does not reset the fields automatically: if the server
      // rejects the input, the person keeps what they typed. Successful saves reset only when asked.
      onChange={() => trackChanges && setDirty(true)}
      onSubmit={(e) => {
        e.preventDefault();
        if (confirm && !window.confirm(confirm)) return;
        const fd = new FormData(e.currentTarget);
        startTransition(() => formAction(fd));
      }}
      className={cn("space-y-4", className)}
    >
      {children}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant={variant} size="sm" disabled={pending}>
          {pending && <LoaderCircle aria-hidden="true" className="animate-spin" />} {submitLabel}
        </Button>
        {trackChanges && dirty && !pending && (
          <>
            <Button type="button" variant="outline" size="sm" onClick={() => { formRef.current?.reset(); setDirty(false); }}>Cancel</Button>
            <span className="rounded-full bg-warning-soft px-2.5 py-0.5 text-xs font-semibold text-navy" data-unsaved>Unsaved changes</span>
          </>
        )}
        <p role="status" aria-live="polite" className="text-sm">
          {state?.error && <span className="flex items-center gap-1.5 font-medium text-brand-red-dark"><CircleAlert aria-hidden="true" className="size-4" />{state.error}</span>}
          {state?.ok && state.message && <span className="flex items-center gap-1.5 text-navy"><CircleCheck aria-hidden="true" className="size-4 text-brand-red" />{state.message}</span>}
        </p>
      </div>
    </form>
  );
}
