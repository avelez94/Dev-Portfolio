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
  const diff = d.getDate() - day + (day === 0 ? -1 : 6);
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
        maxWidth: "500px",
        margin: "0 auto",
        padding: "20px",
        minHeight: "100vh",
      }}
    >
      <div style={{ marginBottom: "40px" }}>
        <h1 style={{ fontSize: "28px", fontWeight: "700", marginBottom: "8px" }}>
          Walk Tracker
        </h1>
        {weekRange && (
          <p style={{ fontSize: "14px", color: "#666666", margin: 0 }}>
            {formatDateDisplay(weekRange.start)} to {formatDateDisplay(weekRange.end)}
          </p>
        )}
      </div>

      {error && (
        <div
          style={{
            background: "#fee",
            color: "#c33",
            padding: "12px",
            borderRadius: "4px",
            marginBottom: "16px",
            fontSize: "14px",
          }}
        >
          {error}
        </div>
      )}

      {success && (
        <div
          style={{
            background: "#efe",
            color: "#3c3",
            padding: "12px",
            borderRadius: "4px",
            marginBottom: "16px",
            fontSize: "14px",
          }}
        >
          Walk logged!
        </div>
      )}

      <button
        onClick={handleLogWalk}
        disabled={submitting || loading}
        style={{
          width: "100%",
          padding: "16px",
          background: submitting || loading ? "#cccccc" : "#111111",
          color: "#ffffff",
          border: "none",
          borderRadius: "8px",
          fontSize: "16px",
          fontWeight: "600",
          cursor: submitting || loading ? "not-allowed" : "pointer",
          marginBottom: "16px",
        }}
      >
        {submitting ? "Logging..." : "Log Walk"}
      </button>

      <div
        style={{
          background: "#f5f5f5",
          borderRadius: "8px",
          padding: "16px",
          marginBottom: "32px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: "12px",
          }}
        >
          <span style={{ fontSize: "14px", color: "#666666" }}>
            Walks this week
          </span>
          <span style={{ fontSize: "24px", fontWeight: "700" }}>
            {totalWalks}
          </span>
        </div>
        <div style={{ height: "1px", background: "#e0e0e0", margin: "12px 0" }} />
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
          }}
        >
          <span style={{ fontSize: "14px", color: "#666666" }}>Total pay</span>
          <span style={{ fontSize: "24px", fontWeight: "700" }}>
            ${totalPay}
          </span>
        </div>
      </div>

      {sortedDates.length > 0 && (
        <div>
          <h2
            style={{
              fontSize: "14px",
              fontWeight: "600",
              color: "#666666",
              marginBottom: "12px",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            Logged Walks
          </h2>
          {sortedDates.map((date) => {
            const count = walksByDate[date];
            const displayDate = new Date(date + "T00:00:00");
            return (
              <div
                key={date}
                style={{
                  padding: "12px 0",
                  borderBottom: "1px solid #f0f0f0",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: "14px",
                }}
              >
                <span style={{ color: "#666666" }}>
                  {formatDateDisplay(displayDate)}
                </span>
                <span style={{ fontWeight: "600", color: "#111111" }}>
                  {count} walk{count > 1 ? "s" : ""} ({count * 10} dollars)
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}