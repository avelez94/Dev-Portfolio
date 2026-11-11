import { NextResponse, type NextRequest } from "next/server";
import { getStaff } from "@/lib/auth";
import { audit } from "@/lib/data/audit";
import { resolvePeriod } from "@/lib/metrics/period";
import { REPORTS, buildReport, canView } from "@/lib/reports/build";
import { reportToCsv } from "@/lib/reports/csv";
import { reportToPdf } from "@/lib/reports/pdf";

const isId = (v: string | null) => (v && /^[0-9a-f-]{36}$/.test(v) ? v : undefined);

/** Authenticated report export. Nothing is cached or stored; each export is audited. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const s = await getStaff();
  if (!s) return new NextResponse("Sign in required", { status: 401 });
  const { key } = await params;
  const def = REPORTS.find((r) => r.key === key);
  if (!def) return new NextResponse("Unknown report", { status: 404 });
  if (!canView(def, s)) return new NextResponse("This report requires owner or admin access", { status: 403 });
  const sp = req.nextUrl.searchParams;
  const format = sp.get("format") === "pdf" ? "pdf" : "csv";
  const period = resolvePeriod({ period: sp.get("period") ?? undefined, from: sp.get("from") ?? undefined, to: sp.get("to") ?? undefined });
  const freight = sp.get("freight");
  const report = await buildReport(def, s, period, { shipper: isId(sp.get("shipper")), carrier: isId(sp.get("carrier")), freightType: freight && ["expedited", "dedicated", "general"].includes(freight) ? freight : undefined });
  await audit({ actorType: "admin", actorId: s.userId, action: "report.exported", entityType: "report", entityId: key, metadata: { format, from: period.from, to: period.to } });
  const name = `velez-${key}-${period.from}-to-${period.to}.${format}`;
  const headers = { "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "no-store", "X-Robots-Tag": "noindex" };
  if (format === "pdf") {
    const bytes = await reportToPdf(report);
    return new NextResponse(Buffer.from(bytes), { headers: { ...headers, "Content-Type": "application/pdf" } });
  }
  return new NextResponse(reportToCsv(report), { headers: { ...headers, "Content-Type": "text/csv; charset=utf-8" } });
}
