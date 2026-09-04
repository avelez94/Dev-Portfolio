"use client";

import { useMemo, useState } from "react";
import {
  Check,
  Circle,
  CalendarDays,
  Trophy,
  Target,
  WalletCards,
  Plus,
} from "lucide-react";

type Debt = {
  id: string;
  creditor: string;
  promo_name: string | null;
  original_balance: number;
  current_balance: number;
  promo_deadline: string | null;
  deadline_is_estimated: boolean;
  priority: number;
  completed: boolean;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export default function DebtTracker({
  initialDebts,
}: {
  initialDebts: Debt[];
}) {
  const [debts, setDebts] = useState(initialDebts);
  const [updating, setUpdating] = useState<string | null>(null);
  const [paymentAmounts, setPaymentAmounts] = useState<Record<string, string>>(
    {}
  );

  const totalDebt = useMemo(
    () =>
      debts.reduce(
        (sum, debt) => sum + Number(debt.original_balance),
        0
      ),
    [debts]
  );

  const remaining = useMemo(
    () =>
      debts.reduce(
        (sum, debt) => sum + Number(debt.current_balance),
        0
      ),
    [debts]
  );

  const amountPaid = totalDebt - remaining;

  const percentComplete =
    totalDebt > 0
      ? Math.round((amountPaid / totalDebt) * 100)
      : 0;

  async function toggleDebt(debt: Debt) {
    const newCompleted = !debt.completed;

    setUpdating(debt.id);

    try {
      const response = await fetch("/api/debt-payoff", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: debt.id,
          action: "toggle",
          completed: newCompleted,
        }),
      });

      if (!response.ok) {
        throw new Error("Unable to update debt.");
      }

      const result = await response.json();

      setDebts((current) =>
        current.map((item) =>
          item.id === debt.id ? result.debt : item
        )
      );
    } catch (error) {
      console.error(error);
      alert("Unable to save your change. Please try again.");
    } finally {
      setUpdating(null);
    }
  }

  async function addPayment(debt: Debt) {
    const payment = Number(paymentAmounts[debt.id]);

    if (!payment || payment <= 0) {
      alert("Enter a valid payment amount.");
      return;
    }

    if (payment > Number(debt.current_balance)) {
      alert(
        `That payment is more than the remaining balance of ${formatMoney(
          Number(debt.current_balance)
        )}.`
      );
      return;
    }

    setUpdating(debt.id);

    try {
      const response = await fetch("/api/debt-payoff", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: debt.id,
          action: "payment",
          payment,
        }),
      });

      if (!response.ok) {
        throw new Error("Unable to add payment.");
      }

      const result = await response.json();

      setDebts((current) =>
        current.map((item) =>
          item.id === debt.id ? result.debt : item
        )
      );

      setPaymentAmounts((current) => ({
        ...current,
        [debt.id]: "",
      }));
    } catch (error) {
      console.error(error);
      alert("Unable to save your payment. Please try again.");
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

  function formatDeadline(
    date: string | null,
    estimated: boolean
  ) {
    if (!date) return "No deadline set";

    const parsedDate = new Date(`${date}T00:00:00Z`);

    if (Number.isNaN(parsedDate.getTime())) {
      return "Deadline unavailable";
    }

    if (estimated) {
      return new Intl.DateTimeFormat("en-US", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      }).format(parsedDate);
    }

    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    }).format(parsedDate);
  }

  return (
    <main className="min-h-screen bg-[#f7f3ee] px-4 py-10 text-[#211d1a] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">

        <div className="mb-10">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.25em] text-[#9a7455]">
            Debt Freedom Plan
          </p>

          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Debt Tracker
          </h1>

          <p className="mt-4 max-w-2xl text-base leading-7 text-[#6c625a]">
            Every balance you eliminate gets you one step closer
            to being completely debt-free.
          </p>
        </div>

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
              style={{
                width: `${percentComplete}%`,
              }}
            />
          </div>
        </section>

        <section className="mt-10">
          <div className="mb-5">
            <p className="text-sm font-medium text-[#9a7455]">
              Payoff order
            </p>

            <h2 className="mt-1 text-2xl font-semibold">
              Promotional balances
            </h2>
          </div>

          <div className="space-y-4">
            {[...debts]
              .sort((a, b) => a.priority - b.priority)
              .map((debt) => {
                const paid =
                  Number(debt.original_balance) -
                  Number(debt.current_balance);

                const debtProgress =
                  Number(debt.original_balance) > 0
                    ? Math.round(
                        (paid /
                          Number(debt.original_balance)) *
                          100
                      )
                    : 0;

                return (
                  <div
                    key={debt.id}
                    className={[
                      "rounded-3xl border p-5 transition-all duration-200 sm:p-6",
                      debt.completed
                        ? "border-[#a6bba5] bg-[#edf3ec]"
                        : "border-black/5 bg-white shadow-sm",
                    ].join(" ")}
                  >
                    <div className="flex items-start gap-4 sm:gap-5">
                      <button
                        onClick={() => toggleDebt(debt)}
                        disabled={updating === debt.id}
                        className={[
                          "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 transition",
                          debt.completed
                            ? "border-[#637d62] bg-[#637d62] text-white"
                            : "border-[#d5ccc4] bg-white hover:border-[#9a7455]",
                        ].join(" ")}
                        aria-label={
                          debt.completed
                            ? "Mark debt unpaid"
                            : "Mark debt paid"
                        }
                      >
                        {debt.completed ? (
                          <Check size={20} strokeWidth={3} />
                        ) : (
                          <Circle
                            size={16}
                            className="text-transparent"
                          />
                        )}
                      </button>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
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
                                {debt.creditor}
                              </h3>
                            </div>

                            {debt.promo_name && (
                              <p className="mt-1 text-sm text-[#81766e]">
                                {debt.promo_name}
                              </p>
                            )}

                            <div className="mt-2 flex items-center gap-2 text-sm text-[#7a7068]">
                              <CalendarDays size={15} />

                              <span>
                                Pay off by{" "}
                                {formatDeadline(
                                  debt.promo_deadline,
                                  debt.deadline_is_estimated
                                )}
                              </span>
                            </div>
                          </div>

                          <div className="sm:text-right">
                            <p className="text-2xl font-semibold">
                              {formatMoney(
                                Number(debt.current_balance)
                              )}
                            </p>

                            <p className="mt-1 text-xs uppercase tracking-wider text-[#9b9088]">
                              {debt.completed
                                ? "Paid off ✓"
                                : "Remaining"}
                            </p>
                          </div>
                        </div>

                        <div className="mt-5">
                          <div className="mb-2 flex justify-between text-sm">
                            <span className="text-[#766b63]">
                              Paid: {formatMoney(paid)}
                            </span>

                            <span className="font-medium text-[#766b63]">
                              {debtProgress}%
                            </span>
                          </div>

                          <div className="h-2 overflow-hidden rounded-full bg-[#eee7e0]">
                            <div
                              className="h-full rounded-full bg-[#637d62] transition-all duration-500"
                              style={{
                                width: `${debtProgress}%`,
                              }}
                            />
                          </div>
                        </div>

                        {!debt.completed && (
                          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                            <div className="relative flex-1">
                              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#82766e]">
                                $
                              </span>

                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="Payment amount"
                                value={
                                  paymentAmounts[debt.id] ?? ""
                                }
                                onChange={(e) =>
                                  setPaymentAmounts(
                                    (current) => ({
                                      ...current,
                                      [debt.id]:
                                        e.target.value,
                                    })
                                  )
                                }
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    addPayment(debt);
                                  }
                                }}
                                className="w-full rounded-2xl border border-[#ddd3ca] bg-white py-3 pl-8 pr-4 outline-none transition focus:border-[#9a7455]"
                              />
                            </div>

                            <button
                              onClick={() => addPayment(debt)}
                              disabled={updating === debt.id}
                              className="flex items-center justify-center gap-2 rounded-2xl bg-[#211d1a] px-5 py-3 font-medium text-white transition hover:bg-[#403932] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <Plus size={18} />

                              {updating === debt.id
                                ? "Saving..."
                                : "Add Payment"}
                            </button>
                          </div>
                        )}

                        <div className="mt-3 text-xs text-[#9b9088]">
                          Original balance:{" "}
                          {formatMoney(
                            Number(debt.original_balance)
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </section>

        {remaining === 0 && (
          <section className="mt-8 rounded-3xl bg-[#211d1a] p-8 text-center text-white">
            <Trophy className="mx-auto mb-4" size={36} />

            <h2 className="text-3xl font-semibold">
              You did it.
            </h2>

            <p className="mx-auto mt-3 max-w-lg text-white/70">
              {formatMoney(totalDebt)} eliminated.
              You are officially debt-free.
            </p>
          </section>
        )}
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

      <p className="text-sm text-[#80756d]">
        {title}
      </p>

      <p className="mt-1 text-3xl font-semibold tracking-tight">
        {amount}
      </p>
    </div>
  );
}