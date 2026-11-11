"use client";

import { startTransition, useActionState, useEffect, useRef } from "react";
import { CircleAlert, CircleCheck, LoaderCircle } from "lucide-react";
import type { ActionState } from "@/app/admin/actions";
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
}: {
  action: (state: ActionState, fd: FormData) => Promise<ActionState>;
  children: React.ReactNode;
  submitLabel: string;
  className?: string;
  variant?: "primary" | "navy" | "outline";
  resetOnSuccess?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok && resetOnSuccess) formRef.current?.reset();
  }, [state, resetOnSuccess]);
  return (
    <form
      ref={formRef}
      // Submit through onSubmit so React does not reset the fields automatically: if the server
      // rejects the input, the person keeps what they typed. Successful saves reset only when asked.
      onSubmit={(e) => {
        e.preventDefault();
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
        <p role="status" aria-live="polite" className="text-sm">
          {state?.error && <span className="flex items-center gap-1.5 font-medium text-brand-red-dark"><CircleAlert aria-hidden="true" className="size-4" />{state.error}</span>}
          {state?.ok && state.message && <span className="flex items-center gap-1.5 text-navy"><CircleCheck aria-hidden="true" className="size-4 text-brand-red" />{state.message}</span>}
        </p>
      </div>
    </form>
  );
}
