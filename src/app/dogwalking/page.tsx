"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Walk {
  id: string;
  date: string;
  created_at: string;
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day - 1;
  return new Date(d.setDate(diff));
}

function getWeekEnd(date: Date): Date {
  const start = getWeekStart(date);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return end;
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

export default function Home() {
  const [walks, setWalks] = useState<Walk[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [weekRange, setWeekRange] = useState<{
    start: Date;
    end: Date;
  } | null>(null);

  useEffect(() => {
    const today = new Date();
    const start = getWeekStart(today);
    const end = getWeekEnd(today);
    setWeekRange({ start, end });
    fetchWalks(start, end);
  }, []);

  const fetchWalks = async (start: Date, end: Date) => {
    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from("walks")
        .select("*")
        .gte("date", formatDate(start))
        .lte("date", formatDate(end))
        .order("date", { ascending: false });

      if (fetchError) throw fetchError;
      setWalks(data || []);
    } catch (err) {
      console.error("Error fetching walks:", err);
      setError("Failed to load walks");
    } finally {
      setLoading(false);
    }
  };

  const handleLogWalk = async () => {
    try {
      setSubmitting(true);
      setError("");
      setSuccess(false);

      const today = formatDate(new Date());

      // Check if already logged today
      const alreadyLogged = walks.some((walk) => walk.date === today);
      if (alreadyLogged) {
        setError("You already logged a walk today!");
        setSubmitting(false);
        return;
      }

      const { error: insertError } = await supabase
        .from("walks")
        .insert([{ date: today }]);

      if (insertError) throw insertError;

      setSuccess(true);
      if (weekRange) {
        await fetchWalks(weekRange.start, weekRange.end);
      }

      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error("Error logging walk:", err);
      setError("Failed to log walk. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const today = formatDate(new Date());
  const alreadyLoggedToday = walks.some((walk) => walk.date === today);

  const totalWalks = walks.length;
  const totalPay = totalWalks * 10;

  const walksByDate = walks.reduce(
    (acc, walk) => {
      acc[walk.date] = (acc[walk.date] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const sortedDates = Object.keys(walksByDate).sort().reverse();

  return (
    <div
      style={{
        width: "100%",
        maxWidth: "100vw",
        minHeight: "100vh",
        margin: "0",
        padding: "24px 16px 32px 16px",
        background: "linear-gradient(135deg, #fff5f9 0%, #f5f0ff 100%)",
        fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ marginBottom: "32px" }}>
        <h1
          style={{
            fontSize: "48px",
            fontWeight: "700",
            marginBottom: "8px",
            color: "#d4669f",
            letterSpacing: "-1px",
          }}
        >
          Walk Tracker
        </h1>
        {weekRange && (
          <p style={{ fontSize: "18px", color: "#b896c3", margin: "0" }}>
            {formatDateDisplay(weekRange.start)} to {formatDateDisplay(weekRange.end)}
          </p>
        )}
      </div>

      {error && (
        <div
          style={{
            background: "#fde7eb",
            color: "#d4669f",
            padding: "16px",
            borderRadius: "16px",
            marginBottom: "20px",
            fontSize: "16px",
            fontWeight: "500",
          }}
        >
          {error}
        </div>
      )}

      {success && (
        <div
          style={{
            background: "#e8f5e9",
            color: "#6ba587",
            padding: "16px",
            borderRadius: "16px",
            marginBottom: "20px",
            fontSize: "16px",
            fontWeight: "500",
          }}
        >
          Great work! Walk logged!
        </div>
      )}

      <button
        onClick={handleLogWalk}
        disabled={submitting || loading || alreadyLoggedToday}
        style={{
          width: "100%",
          padding: "28px",
          background: alreadyLoggedToday ? "#e0d5e8" : "#d4669f",
          color: "#ffffff",
          border: "none",
          borderRadius: "20px",
          fontSize: "24px",
          fontWeight: "700",
          cursor: alreadyLoggedToday || submitting || loading ? "not-allowed" : "pointer",
          marginBottom: "28px",
          transition: "all 0.2s",
          opacity: alreadyLoggedToday ? 0.7 : 1,
        }}
      >
        {submitting ? "Logging..." : alreadyLoggedToday ? "Logged Today!" : "Log Walk"}
      </button>

      <div
        style={{
          background: "rgba(255, 255, 255, 0.8)",
          borderRadius: "20px",
          padding: "28px",
          marginBottom: "32px",
          backdropFilter: "blur(10px)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "20px",
          }}
        >
          <span style={{ fontSize: "18px", color: "#b896c3", fontWeight: "600" }}>
            This Week
          </span>
          <span
            style={{
              fontSize: "48px",
              fontWeight: "800",
              color: "#d4669f",
            }}
          >
            {totalWalks}
          </span>
        </div>
        <div style={{ height: "2px", background: "rgba(212, 102, 159, 0.1)", margin: "16px 0" }} />
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: "18px", color: "#b896c3", fontWeight: "600" }}>
            Total Pay
          </span>
          <span
            style={{
              fontSize: "48px",
              fontWeight: "800",
              color: "#d4669f",
            }}
          >
            ${totalPay}
          </span>
        </div>
      </div>

      {sortedDates.length > 0 && (
        <div>
          <h2
            style={{
              fontSize: "16px",
              fontWeight: "700",
              color: "#b896c3",
              marginBottom: "16px",
              textTransform: "uppercase",
              letterSpacing: "1px",
            }}
          >
            Recent Walks
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {sortedDates.map((date) => {
              const count = walksByDate[date];
              const displayDate = new Date(date + "T00:00:00");
              return (
                <div
                  key={date}
                  style={{
                    padding: "16px",
                    background: "rgba(255, 255, 255, 0.8)",
                    borderRadius: "16px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: "16px",
                    backdropFilter: "blur(10px)",
                  }}
                >
                  <span style={{ color: "#b896c3", fontWeight: "500" }}>
                    {formatDateDisplay(displayDate)}
                  </span>
                  <span style={{ fontWeight: "700", color: "#d4669f" }}>
                    ${count * 10}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}