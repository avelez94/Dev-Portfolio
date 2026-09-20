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
  const daysBack = (day + 1) % 7;
  return new Date(d.setDate(d.getDate() - daysBack));
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

function getDailySaying(date: Date): string {
  const dayOfWeek = date.getDay();
  const sayings = [
    "💪 Slay Sunday",
    "💰 Money Monday",
    "✨ Tuesday the Shiny",
    "🐕 Pup Pup Wednesday",
    "🌟 Thriving Thursday",
    "💖 Fabulous Friday",
    "🎉 Saturday Strong",
  ];
  return sayings[dayOfWeek];
}

export default function Home() {
  const [walks, setWalks] = useState<Walk[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
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

      const alreadyLogged = walks.some((walk) => walk.date === today);
      if (alreadyLogged) {
        setError("Already got your steps in today, queen! 👑");
        setSubmitting(false);
        return;
      }

      const { error: insertError } = await supabase
        .from("walks")
        .insert([{ date: today }]);

      if (insertError) throw insertError;

      setSuccess(true);
      setCelebrate(true);
      if (weekRange) {
        await fetchWalks(weekRange.start, weekRange.end);
      }

      setTimeout(() => setSuccess(false), 4000);
      setTimeout(() => setCelebrate(false), 5000);
    } catch (err) {
      console.error("Error logging walk:", err);
      setError("Oops! Try again babe 💕");
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

  const celebrationEmojis = Array.from({ length: 20 }).map((_, i) => ({
    id: i,
    emoji: i % 2 === 0 ? "💰" : "🐕",
    left: Math.random() * 100,
    delay: Math.random() * 0.3,
  }));

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
        overflow: "hidden",
        position: "relative",
      }}
    >
      <style>{`
        @keyframes fall {
          to {
            transform: translateY(100vh) rotate(360deg);
            opacity: 0;
          }
        }
        .falling-emoji {
          position: fixed;
          font-size: 48px;
          animation: fall 3s ease-in forwards;
          pointer-events: none;
          z-index: 1000;
        }
      `}</style>

      {celebrate &&
        celebrationEmojis.map((item) => (
          <div
            key={item.id}
            className="falling-emoji"
            style={{
              left: `${item.left}%`,
              top: "-60px",
              animationDelay: `${item.delay}s`,
            }}
          >
            {item.emoji}
          </div>
        ))}

      <div style={{ marginBottom: "32px" }}>
        <h1
          style={{
            fontSize: "52px",
            fontWeight: "800",
            marginBottom: "4px",
            color: "#d4669f",
            letterSpacing: "-1px",
          }}
        >
          🚶‍♀️ Walk Tracker
        </h1>
        {weekRange && (
          <p style={{ fontSize: "18px", color: "#b896c3", margin: "0", fontWeight: "500" }}>
            {formatDateDisplay(weekRange.start)} to {formatDateDisplay(weekRange.end)}
          </p>
        )}
        <p style={{ fontSize: "16px", color: "#d4669f", margin: "12px 0 0 0", fontWeight: "600" }}>
          {getDailySaying(new Date())}
        </p>
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
            background: "linear-gradient(135deg, #e8f5e9 0%, #f1f8f6 100%)",
            color: "#6ba587",
            padding: "20px",
            borderRadius: "16px",
            marginBottom: "20px",
            fontSize: "18px",
            fontWeight: "600",
            textAlign: "center",
          }}
        >
          ✨ YES QUEEN! ✨ Walk logged! Make that money girl 💰
        </div>
      )}

      <button
        onClick={handleLogWalk}
        disabled={submitting || loading || alreadyLoggedToday}
        style={{
          width: "100%",
          padding: "32px 28px",
          background: alreadyLoggedToday
            ? "linear-gradient(135deg, #e0d5e8 0%, #e8ddf0 100%)"
            : "linear-gradient(135deg, #d4669f 0%, #c54a8a 100%)",
          color: "#ffffff",
          border: "none",
          borderRadius: "24px",
          fontSize: "26px",
          fontWeight: "800",
          cursor: alreadyLoggedToday || submitting || loading ? "not-allowed" : "pointer",
          marginBottom: "28px",
          transition: "all 0.2s",
          opacity: alreadyLoggedToday ? 0.7 : 1,
          boxShadow: alreadyLoggedToday ? "none" : "0 8px 24px rgba(212, 102, 159, 0.3)",
        }}
      >
        {submitting ? "Logging..." : alreadyLoggedToday ? "💅 Logged Today!" : "🚶‍♀️ Log Walk"}
      </button>

      <div
        style={{
          background: "rgba(255, 255, 255, 0.9)",
          borderRadius: "24px",
          padding: "32px",
          marginBottom: "32px",
          backdropFilter: "blur(10px)",
          boxShadow: "0 8px 32px rgba(212, 102, 159, 0.1)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "24px",
          }}
        >
          <span style={{ fontSize: "20px", color: "#b896c3", fontWeight: "700" }}>
            This Week 📊
          </span>
          <span
            style={{
              fontSize: "56px",
              fontWeight: "900",
              color: "#d4669f",
            }}
          >
            {totalWalks}
          </span>
        </div>
        <div style={{ height: "2px", background: "rgba(212, 102, 159, 0.15)", margin: "16px 0" }} />
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: "20px", color: "#b896c3", fontWeight: "700" }}>
            Your Earnings 💵
          </span>
          <span
            style={{
              fontSize: "56px",
              fontWeight: "900",
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
              fontSize: "18px",
              fontWeight: "800",
              color: "#b896c3",
              marginBottom: "16px",
              textTransform: "uppercase",
              letterSpacing: "1.5px",
            }}
          >
            💖 Recent Walks
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {sortedDates.map((date) => {
              const count = walksByDate[date];
              const displayDate = new Date(date + "T00:00:00");
              return (
                <div
                  key={date}
                  style={{
                    padding: "18px 20px",
                    background: "rgba(255, 255, 255, 0.9)",
                    borderRadius: "18px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: "18px",
                    backdropFilter: "blur(10px)",
                    boxShadow: "0 4px 12px rgba(212, 102, 159, 0.08)",
                  }}
                >
                  <span style={{ color: "#b896c3", fontWeight: "600" }}>
                    🚶‍♀️ {formatDateDisplay(displayDate)}
                  </span>
                  <span style={{ fontWeight: "800", color: "#d4669f", fontSize: "20px" }}>
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