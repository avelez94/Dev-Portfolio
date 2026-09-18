import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { NextRequest, NextResponse } from "next/server";

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -1 : 6);
  return new Date(d.setDate(diff));
}

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function formatDateDisplay(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
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

    // Get last week's range (Saturday to Friday)
    const today = new Date();
    const lastWeekEnd = new Date(today);
    lastWeekEnd.setDate(lastWeekEnd.getDate() - 1);
    const lastWeekStart = getWeekStart(lastWeekEnd);

    // Fetch walks for last week
    const { data: walks, error: fetchError } = await supabase
      .from("walks")
      .select("*")
      .gte("date", formatDate(lastWeekStart))
      .lte("date", formatDate(lastWeekEnd))
      .order("date", { ascending: false });

    if (fetchError) throw fetchError;

    const totalWalks = walks?.length || 0;
    const totalPay = totalWalks * 10;

    // Group walks by date
    const walksByDate = (walks || []).reduce(
      (acc, walk) => {
        acc[walk.date] = (acc[walk.date] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const sortedDates = Object.keys(walksByDate).sort().reverse();
    const walkDetails = sortedDates
      .map((date) => {
        const count = walksByDate[date];
        const displayDate = new Date(date + "T00:00:00");
        return `${formatDateDisplay(displayDate)}: ${count} walk${count > 1 ? "s" : ""} ($${count * 10})`;
      })
      .join("\n");

    const emailBody = `Weekly Walk Summary
${formatDateDisplay(lastWeekStart)} to ${formatDateDisplay(lastWeekEnd)}

Total Walks: ${totalWalks}
Total Pay: $${totalPay}

Daily Breakdown:
${walkDetails || "No walks logged this week"}

Payment due Friday.
`;

    // Send email
    const emailResponse = await resend.emails.send({
      from: "Walk Tracker <onboarding@resend.dev>",
      to: process.env.ALERT_EMAIL || "alante@alantevelez.com",
      subject: `Walk Summary: ${formatDateDisplay(lastWeekStart)} to ${formatDateDisplay(lastWeekEnd)}`,
      text: emailBody,
    });

    if (emailResponse.error) {
      throw emailResponse.error;
    }

    return NextResponse.json({
      success: true,
      totalWalks,
      totalPay,
      emailId: emailResponse.data?.id,
    });
  } catch (error) {
    console.error("Error sending email:", error);
    return NextResponse.json(
      { error: "Failed to send email" },
      { status: 500 }
    );
  }
}