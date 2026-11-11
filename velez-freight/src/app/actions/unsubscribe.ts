"use server";

import { redirect } from "next/navigation";
import { readUnsubscribeToken } from "@/lib/email/unsubscribe-token";
import { suppress } from "@/lib/email/suppress";

export async function unsubscribe(fd: FormData) {
  const token = String(fd.get("t") ?? "");
  const email = readUnsubscribeToken(token);
  if (!email) redirect("/unsubscribe?invalid=1");
  const ok = await suppress(email, "unsubscribed", "email link");
  redirect(`/unsubscribe?t=${encodeURIComponent(token)}&${ok ? "done=1" : "error=1"}`);
}
