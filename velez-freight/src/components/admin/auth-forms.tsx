"use client";

import { useActionState, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { requestPasswordReset, setPassword, signIn } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { FormAlert } from "@/components/forms/fields";

export function LoginForm() {
  const [mode, setMode] = useState<"signin" | "reset">("signin");
  const [state, action, pending] = useActionState(signIn, undefined);
  const [resetState, resetAction, resetPending] = useActionState(requestPasswordReset, undefined);
  if (mode === "reset") {
    return (
      <form action={resetAction} className="space-y-4">
        <div><Label htmlFor="reset-email">Email</Label><Input id="reset-email" name="email" type="email" autoComplete="email" required /></div>
        {resetState?.message && <FormAlert tone="success">{resetState.message}</FormAlert>}
        <Button type="submit" className="w-full" disabled={resetPending}>{resetPending && <LoaderCircle className="animate-spin" aria-hidden="true" />} Send reset link</Button>
        <button type="button" onClick={() => setMode("signin")} className="w-full text-sm font-semibold text-brand-red-dark hover:underline">Back to sign in</button>
      </form>
    );
  }
  return (
    <form action={action} className="space-y-4">
      <div><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" autoComplete="username" required /></div>
      <div><Label htmlFor="password">Password</Label><Input id="password" name="password" type="password" autoComplete="current-password" required /></div>
      {state?.error && <FormAlert tone="error">{state.error}</FormAlert>}
      <Button type="submit" className="w-full" disabled={pending}>{pending && <LoaderCircle className="animate-spin" aria-hidden="true" />} Sign in</Button>
      <button type="button" onClick={() => setMode("reset")} className="w-full text-sm font-semibold text-brand-red-dark hover:underline">Forgot password?</button>
    </form>
  );
}

export function SetPasswordForm() {
  const [state, action, pending] = useActionState(setPassword, undefined);
  return (
    <form action={action} className="space-y-4">
      <div><Label htmlFor="password">New password</Label><Input id="password" name="password" type="password" autoComplete="new-password" minLength={12} required aria-describedby="pw-hint" /><p id="pw-hint" className="mt-1 text-xs text-slate-muted">At least 12 characters. A passphrase works well.</p></div>
      <div><Label htmlFor="confirm">Confirm password</Label><Input id="confirm" name="confirm" type="password" autoComplete="new-password" required /></div>
      {state?.error && <FormAlert tone="error">{state.error}</FormAlert>}
      <Button type="submit" className="w-full" disabled={pending}>{pending && <LoaderCircle className="animate-spin" aria-hidden="true" />} Save password</Button>
    </form>
  );
}
