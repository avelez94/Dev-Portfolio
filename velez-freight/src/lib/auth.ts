import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { sessionClient } from "@/lib/supabase/server";

export type Role = "owner" | "admin" | "staff";
export type StaffSession = {
  userId: string;
  email: string;
  name: string | null;
  role: Role;
  db: NonNullable<Awaited<ReturnType<typeof sessionClient>>>;
};

/**
 * Authoritative server side check. Verifies the session with Supabase Auth (getUser contacts the
 * Auth server) and requires an ACTIVE staff profile. Call it at the top of every admin page and
 * every admin server action. Returns a client bound to the user, so RLS still applies.
 */
export const getStaff = cache(async (): Promise<StaffSession | null> => {
  const db = await sessionClient();
  if (!db) return null;
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return null;
  const { data: profile } = await db.from("profiles").select("role, is_active, full_name, email").eq("id", auth.user.id).maybeSingle();
  if (!profile || !profile.is_active) return null;
  return { userId: auth.user.id, email: profile.email, name: profile.full_name, role: profile.role as Role, db };
});

export async function requireStaff(): Promise<StaffSession> {
  const s = await getStaff();
  if (!s) redirect("/admin/login");
  return s;
}

export async function requireAdmin(): Promise<StaffSession> {
  const s = await requireStaff();
  if (s.role !== "owner" && s.role !== "admin") redirect("/admin?denied=1");
  return s;
}

export async function requireOwner(): Promise<StaffSession> {
  const s = await requireStaff();
  if (s.role !== "owner") redirect("/admin?denied=1");
  return s;
}

export const isAdminRole = (r: Role) => r === "owner" || r === "admin";
