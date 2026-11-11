import { NextResponse, type NextRequest } from "next/server";
import { sessionClient } from "@/lib/supabase/server";

/** Handles invitation and password reset links from Supabase Auth (PKCE code exchange). */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next");
  // Only allow same site relative redirects into the admin area.
  const safeNext = next && next.startsWith("/admin/") && !next.startsWith("//") ? next : "/admin";
  const db = await sessionClient();
  if (code && db) {
    const { error } = await db.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(safeNext, url.origin));
  }
  return NextResponse.redirect(new URL("/admin/login?error=link", url.origin));
}
