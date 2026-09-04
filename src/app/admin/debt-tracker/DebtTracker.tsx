"use client";

import { useMemo, useState } from "react";
import {
  Check,
  Circle,
  CalendarDays,
  Trophy,
  Target,
  WalletCards,
} from "lucide-react";

type Debt = {
  id: string;
  debt_name: string;
  promo_balance: number;
  due_date: string;
  priority: number;
  completed: boolean;
  completed_at?: string | null;
};

export default function DebtTracker({
  initialDebts,
}: {
  initialDebts: Debt[];
}) {
  const [debts, setDebts] = useState(initialDebts);
  const [updating, setUpdating] = useState<string | null>(null);

  const totalDebt = useMemo(
    () => debts.reduce((sum, debt) => sum + Number(debt.promo_balance), 0),
    [debts]
  );

  const amountPaid = useMemo(
    () =>
      debts
        .filter((debt) => debt.completed)
        .reduce((sum, debt) => sum + Number(debt.promo_balance), 0),
    [debts]
  );

  const remaining = totalDebt - amountPaid;

  const percentComplete =
    totalDebt > 0 ? Math.round((amountPaid / totalDebt) * 100) : 0;

  async function toggleDebt(debt: Debt) {
    const newCompleted = !debt.completed;

    setUpdating(debt.id);

    // Optimistic update
    setDebts((current) =>
      current.map((item) =>
        item.id === debt.id
          ? { ...item, completed: newCompleted }
          : item
      )
    );

    try {
      const response = await fetch("/api/debt-payoff", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: debt.id,
          completed: newCompleted,
        }),
      });

      if (!response.ok) {
        throw new Error("Unable to update debt.");
      }
    } catch (error) {
      console.error(error);

      // Reverse optimistic update on failure
      setDebts((current) =>
        current.map((item) =>
          item.id === debt.id
            ? { ...item, completed: debt.completed }
            : item
        )
      );

      alert("I couldn't save that change. Please try again.");
    } finally {
      setUpdating(null);
    }
  }

  function formatMoney(amount: number) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(amount);
  }

  function formatDate(date: string) {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(`${date}T00:00:00Z`));
  }

  return (
    <main className="min-h-screen bg-[#f7f3ee] px-4 py-10 text-[#211d1a] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">

        {/* Header */}
        <div className="mb-10">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.25em] text-[#9a7455]">
            Atlanta Freedom Plan
          </p>

          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Debt Freedom
          </h1>

          <p className="mt-4 max-w-2xl text-base leading-7 text-[#6c625a]">
            Every balance you eliminate gets you one step closer to moving
            completely debt-free.
          </p>
        </div>

        {/* Summary cards */}
        <div className="grid gap-4 sm:grid-cols-3">
          <SummaryCard
            icon={<WalletCards size={20} />}
            title="Starting Debt"
            amount={formatMoney(totalDebt)}
          />

          <SummaryCard
            icon={<Target size={20} />}
            title="Remaining"
            amount={formatMoney(remaining)}
          />

          <SummaryCard
            icon={<Trophy size={20} />}
            title="Paid Off"
            amount={formatMoney(amountPaid)}
          />
        </div>

        {/* Progress */}
        <section className="mt-6 rounded-3xl border border-black/5 bg-white p-6 shadow-sm">
          <div className="mb-3 flex items-end justify-between">
            <div>
              <p className="text-sm font-medium text-[#766b63]">
                Overall progress
              </p>

              <p className="mt-1 text-2xl font-semibold">
                {percentComplete}% complete
              </p>
            </div>

            <p className="text-sm font-semibold text-[#9a7455]">
              {formatMoney(amountPaid)} paid
            </p>
          </div>

          <div className="h-3 overflow-hidden rounded-full bg-[#ece6df]">
            <div
              className="h-full rounded-full bg-[#211d1a] transition-all duration-500"
              style={{ width: `${percentComplete}%` }}
            />
          </div>
        </section>

        {/* Debts */}
        <section className="mt-10">
          <div className="mb-5 flex items-end justify-between">
            <div>
              <p className="text-sm font-medium text-[#9a7455]">
                Payoff order
              </p>

              <h2 className="mt-1 text-2xl font-semibold">
                Promotional balances
              </h2>
            </div>

            <p className="hidden text-sm text-[#766b63] sm:block">
              Pay by expiration date
            </p>
          </div>

          <div className="space-y-3">
            {debts
              .sort((a, b) => a.priority - b.priority)
              .map((debt) => (
                <button
                  key={debt.id}
                  onClick={() => toggleDebt(debt)}
                  disabled={updating === debt.id}
                  className={[
                    "group w-full rounded-3xl border p-5 text-left transition-all duration-200 sm:p-6",
                    debt.completed
                      ? "border-[#a6bba5] bg-[#edf3ec]"
                      : "border-black/5 bg-white hover:-translate-y-0.5 hover:shadow-md",
                  ].join(" ")}
                >
                  <div className="flex items-center gap-4 sm:gap-5">

                    {/* checkbox */}
                    <div
                      className={[
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 transition",
                        debt.completed
                          ? "border-[#637d62] bg-[#637d62] text-white"
                          : "border-[#d5ccc4] bg-white group-hover:border-[#9a7455]",
                      ].join(" ")}
                    >
                      {debt.completed ? (
                        <Check size={20} strokeWidth={3} />
                      ) : (
                        <Circle size={16} className="text-transparent" />
                      )}
                    </div>

                    {/* main content */}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold uppercase tracking-widest text-[#a38771]">
                              #{debt.priority}
                            </span>

                            <h3
                              className={[
                                "font-semibold",
                                debt.completed
                                  ? "text-[#6d756a] line-through"
                                  : "text-[#211d1a]",
                              ].join(" ")}
                            >
                              {debt.debt_name}
                            </h3>
                          </div>

                          <div className="mt-2 flex items-center gap-2 text-sm text-[#7a7068]">
                            <CalendarDays size={15} />
                            Pay off by {formatDate(debt.due_date)}
                          </div>
                        </div>

                        <div className="mt-3 sm:mt-0 sm:text-right">
                          <p
                            className={[
                              "text-2xl font-semibold",
                              debt.completed
                                ? "text-[#637d62] line-through"
                                : "text-[#211d1a]",
                            ].join(" ")}
                          >
                            {formatMoney(Number(debt.promo_balance))}
                          </p>

                          <p className="mt-1 text-xs uppercase tracking-wider text-[#9b9088]">
                            {debt.completed ? "Paid off ✓" : "Remaining"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
          </div>
        </section>

        {remaining === 0 && (
          <section className="mt-8 rounded-3xl bg-[#211d1a] p-8 text-center text-white">
            <Trophy className="mx-auto mb-4" size={36} />

            <h2 className="text-3xl font-semibold">
              You did it.
            </h2>

            <p className="mx-auto mt-3 max-w-lg text-white/70">
              $20,595 eliminated. Atlanta gets the debt-free version of you.
            </p>
          </section>
        )}

        <footer className="mt-12 text-center text-xs uppercase tracking-[0.2em] text-[#a09790]">
          Emergency fund stays untouched · $21,000
        </footer>
      </div>
    </main>
  );
}

function SummaryCard({
  icon,
  title,
  amount,
}: {
  icon: React.ReactNode;
  title: string;
  amount: string;
}) {
  return (
    <div className="rounded-3xl border border-black/5 bg-white p-6 shadow-sm">
      <div className="mb-7 flex h-10 w-10 items-center justify-center rounded-full bg-[#f2ebe4] text-[#8d6c51]">
        {icon}
      </div>

      <p className="text-sm text-[#80756d]">{title}</p>

      <p className="mt-1 text-3xl font-semibold tracking-tight">
        {amount}
      </p>
    </div>
  );
}