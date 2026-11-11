import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { sessionClient } from "@/lib/supabase/server";
import { AuthCard } from "@/components/admin/auth-card";
import { SetPasswordForm } from "@/components/admin/auth-forms";

export const metadata: Metadata = { title: "Set password" };

export default async function SetPasswordPage() {
  const db = await sessionClient();
  const { data } = (await db?.auth.getUser()) ?? { data: { user: null } };
  if (!data.user) redirect("/admin/login?error=link");
  return (
    <AuthCard title="Choose a password">
      <SetPasswordForm />
    </AuthCard>
  );
}
