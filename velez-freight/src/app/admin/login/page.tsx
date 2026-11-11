import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getStaff } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { AuthCard } from "@/components/admin/auth-card";
import { LoginForm } from "@/components/admin/auth-forms";
import { NotConfigured } from "@/components/admin/admin-ui";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  if (!isSupabaseConfigured()) return <main className="px-4 py-24"><NotConfigured /></main>;
  if (await getStaff()) redirect("/admin");
  return (
    <AuthCard title="Sign in">
      <LoginForm />
    </AuthCard>
  );
}
