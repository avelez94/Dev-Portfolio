import { NextResponse, type NextRequest } from "next/server";
import { readUnsubscribeToken } from "@/lib/email/unsubscribe-token";
import { suppress } from "@/lib/email/suppress";

// One click unsubscribe (RFC 8058): mail apps POST here from the List-Unsubscribe header.
export async function POST(request: NextRequest) {
  const email = readUnsubscribeToken(request.nextUrl.searchParams.get("t"));
  if (!email) return NextResponse.json({ ok: false }, { status: 400 });
  const ok = await suppress(email, "unsubscribed", "one click");
  return NextResponse.json({ ok }, { status: ok ? 200 : 500 });
}
