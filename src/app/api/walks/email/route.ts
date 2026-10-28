import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { NextRequest, NextResponse } from "next/server";

interface WalkRow {
  id: string;
  date: string;
  created_at: string;
  lat: number | null;
  lng: number | null;
  accuracy_m: number | null;
  photo_path: string | null;
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDayLabel(isoDate: string): string {
  return new Date(isoDate + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatLoggedAt(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  });
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const resend = new Resend(process.env.RESEND_API_KEY);

    // Saturday through Friday. The cron runs Friday evening, so "today" is the last day.
    const weekEnd = new Date();
    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekEnd.getDate() - 6);
    const startDate = formatDate(weekStart);
    const endDate = formatDate(weekEnd);

    const { data, error: fetchError } = await supabase
      .from("walks")
      .select("id, date, created_at, lat, lng, accuracy_m, photo_path")
      .gte("date", startDate)
      .lte("date", endDate)
      .order("date", { ascending: true })
      .order("created_at", { ascending: true });

    if (fetchError) throw fetchError;

    const walks = (data || []) as WalkRow[];
    const totalWalks = walks.length;
    const totalPay = totalWalks * 10;
    const rangeLabel = `${formatDayLabel(startDate)} to ${formatDayLabel(endDate)}`;

    // Download each photo so it arrives as an attachment you can verify directly.
    const attachments: { filename: string; content: Buffer }[] = [];
    for (const walk of walks) {
      if (!walk.photo_path) continue;
      const { data: file, error: downloadError } = await supabase.storage
        .from("walk-photos")
        .download(walk.photo_path);
      if (downloadError || !file) {
        console.error("Photo download failed:", walk.photo_path, downloadError);
        continue;
      }
      attachments.push({
        filename: `${walk.date}-${walk.id.slice(0, 8)}.jpg`,
        content: Buffer.from(await file.arrayBuffer()),
      });
    }

    const rowsHtml = walks
      .map((walk) => {
        const location =
          walk.lat !== null && walk.lng !== null
            ? `<a href="https://www.google.com/maps?q=${walk.lat},${walk.lng}">${walk.lat.toFixed(5)}, ${walk.lng.toFixed(5)}</a>${walk.accuracy_m !== null ? ` (within ${Math.round(walk.accuracy_m)} m)` : ""}`
            : "No location";
        const photo = walk.photo_path ? "Attached" : "No photo";
        return `<tr>
          <td style="padding:10px;border-bottom:1px solid #f0e6f0">${formatDayLabel(walk.date)}</td>
          <td style="padding:10px;border-bottom:1px solid #f0e6f0">${formatLoggedAt(walk.created_at)}</td>
          <td style="padding:10px;border-bottom:1px solid #f0e6f0">${location}</td>
          <td style="padding:10px;border-bottom:1px solid #f0e6f0">${photo}</td>
        </tr>`;
      })
      .join("");

    const html = `<!DOCTYPE html>
<html><body style="margin:0;background:#fff5f9;font-family:-apple-system,Segoe UI,sans-serif;color:#5a4a63">
  <div style="max-width:640px;margin:0 auto;padding:24px">
    <h1 style="color:#d4669f;font-size:28px;margin:0 0 4px">Walk Summary 🐾</h1>
    <p style="margin:0 0 20px;color:#b896c3;font-size:16px">${rangeLabel}</p>
    <div style="background:#ffffff;border-radius:18px;padding:20px;margin-bottom:24px">
      <p style="margin:0 0 8px;font-size:16px">Total walks: <strong>${totalWalks}</strong></p>
      <p style="margin:0;font-size:16px">Total pay: <strong>$${totalPay}</strong></p>
    </div>
    ${
      totalWalks === 0
        ? "<p>No walks logged this week.</p>"
        : `<table style="width:100%;border-collapse:collapse;background:#ffffff;border-radius:12px;font-size:14px">
      <thead>
        <tr style="text-align:left;color:#b896c3">
          <th style="padding:10px">Day</th>
          <th style="padding:10px">Logged</th>
          <th style="padding:10px">Location</th>
          <th style="padding:10px">Photo</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>`
    }
    <p style="margin-top:24px;font-size:13px;color:#8a7a92">Each photo is attached to this email as a JPG. Location links open in Google Maps.</p>
  </div>
</body></html>`;

    const text = `Walk Summary
${rangeLabel}

Total walks: ${totalWalks}
Total pay: $${totalPay}

${
  walks.length === 0
    ? "No walks logged this week."
    : walks
        .map((walk) => {
          const loc =
            walk.lat !== null && walk.lng !== null
              ? `${walk.lat.toFixed(5)}, ${walk.lng.toFixed(5)} https://www.google.com/maps?q=${walk.lat},${walk.lng}`
              : "No location";
          return `${formatDayLabel(walk.date)} | logged ${formatLoggedAt(walk.created_at)} | ${loc} | ${walk.photo_path ? "photo attached" : "no photo"}`;
        })
        .join("\n")
}
`;

    const emailResponse = await resend.emails.send({
      from: "Walk Tracker <onboarding@resend.dev>",
      to: process.env.ALERT_EMAIL || "alante@alantevelez.com",
      subject: `Walk Summary: ${rangeLabel} (${totalWalks} walks, $${totalPay})`,
      html,
      text,
      attachments,
    });

    if (emailResponse.error) {
      throw emailResponse.error;
    }

    return NextResponse.json({
      success: true,
      totalWalks,
      totalPay,
      photosAttached: attachments.length,
      emailId: emailResponse.data?.id,
    });
  } catch (error) {
    console.error("Error sending walk email:", error);
    return NextResponse.json(
      { error: "Failed to send email" },
      { status: 500 }
    );
  }
}
