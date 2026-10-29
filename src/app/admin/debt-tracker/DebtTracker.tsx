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
    <main style={{ fontFamily: "var(--font-body), Helvetica, Arial, sans-serif" }} className="min-h-screen bg-[#1C1614] px-4 py-10 text-[#FBF3E8] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <nav aria-label="Admin" className="mb-8 flex items-center gap-3">
          <span aria-hidden="true" className="flex h-10 w-10 items-center justify-center rounded-[13px] border-2 border-[#FBF3E8] bg-[#FF6B4F] font-[family-name:var(--font-display)] text-sm font-bold text-[#1A1412]">AV</span>
          <span className="rounded-full bg-[rgba(255,107,79,0.18)] px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[#FF8A70]">Admin</span>
          <a href="/admin" className="ml-auto rounded-full border border-[rgba(251,243,232,0.3)] px-4 py-2 text-sm font-semibold text-[#FBF3E8] hover:border-[#FBF3E8] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[#FF8A70]">Back to Dashboard</a>
        </nav>

        <div className="mb-10">
          <p className="mb-3 text-sm font-bold uppercase tracking-[0.18em] text-[#FF8A70]">
            Debt Freedom Plan
          </p>

          <h1 className="font-[family-name:var(--font-display)] text-4xl font-semibold tracking-tight sm:text-5xl">
            Debt Tracker
          </h1>

          <p className="mt-4 max-w-2xl text-base leading-7 text-[#E4D7C6]">
            Every balance you eliminate gets you one step closer
            to being completely debt free.
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

        <section className="mt-6 rounded-3xl border border-[rgba(251,243,232,0.16)] bg-[#10302D] p-6">
          <div className="mb-3 flex items-end justify-between">
            <div>
              <p className="text-sm font-medium text-[#E4D7C6]">
                Overall progress
              </p>

              <p className="mt-1 text-2xl font-semibold">
                {percentComplete}% complete
              </p>
            </div>

            <p className="text-sm font-semibold text-[#FF8A70]">
              {formatMoney(amountPaid)} paid
            </p>
          </div>

          <div className="h-3 overflow-hidden rounded-full bg-[#244F49]">
            <div
              className="h-full rounded-full bg-[#FF6B4F] transition-all duration-500 motion-reduce:transition-none"
              style={{
                width: `${percentComplete}%`,
              }}
            />
          </div>
        </section>

        <section className="mt-10">
          <div className="mb-5">
            <p className="text-sm font-bold uppercase tracking-[0.14em] text-[#FF8A70]">
              Payoff order
            </p>

            <h2 className="mt-1 font-[family-name:var(--font-display)] text-2xl font-semibold">
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
                        ? "border-[#2F6B66] bg-[#173D2C]"
                        : "border-[rgba(251,243,232,0.16)] bg-[#10302D]",
                    ].join(" ")}
                  >
                    <div className="flex items-start gap-4 sm:gap-5">
                      <button
                        onClick={() => toggleDebt(debt)}
                        disabled={updating === debt.id}
                        className={[
                          "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 transition",
                          debt.completed
                            ? "border-[#9BE3B6] bg-[#9BE3B6] text-[#1A1412]"
                            : "border-[rgba(251,243,232,0.4)] bg-transparent hover:border-[#FF8A70]",
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
                              <span className="text-xs font-bold uppercase tracking-widest text-[#FF8A70]">
                                #{debt.priority}
                              </span>

                              <h3
                                className={[
                                  "font-semibold",
                                  debt.completed
                                    ? "text-[#C3B5A3] line-through"
                                    : "text-[#FBF3E8]",
                                ].join(" ")}
                              >
                                {debt.creditor}
                              </h3>
                            </div>

                            {debt.promo_name && (
                              <p className="mt-1 text-sm text-[#E4D7C6]">
                                {debt.promo_name}
                              </p>
                            )}

                            <div className="mt-2 flex items-center gap-2 text-sm text-[#E4D7C6]">
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

                            <p className="mt-1 text-xs uppercase tracking-wider text-[#C3B5A3]">
                              {debt.completed
                                ? "Paid off ✓"
                                : "Remaining"}
                            </p>
                          </div>
                        </div>

                        <div className="mt-5">
                          <div className="mb-2 flex justify-between text-sm">
                            <span className="text-[#E4D7C6]">
                              Paid: {formatMoney(paid)}
                            </span>

                            <span className="font-medium text-[#E4D7C6]">
                              {debtProgress}%
                            </span>
                          </div>

                          <div className="h-2 overflow-hidden rounded-full bg-[#244F49]">
                            <div
                              className="h-full rounded-full bg-[#9BE3B6] transition-all duration-500 motion-reduce:transition-none"
                              style={{
                                width: `${debtProgress}%`,
                              }}
                            />
                          </div>
                        </div>

                        {!debt.completed && (
                          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                            <div className="relative flex-1">
                              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#C3B5A3]">
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
                                className="w-full rounded-2xl border-[1.5px] border-[rgba(251,243,232,0.3)] bg-[#173B37] py-3 pl-8 pr-4 text-[#FBF3E8] placeholder:text-[#C3B5A3] outline-none transition focus:border-[#FF8A70] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#FF8A70]"
                              />
                            </div>

                            <button
                              onClick={() => addPayment(debt)}
                              disabled={updating === debt.id}
                              className="flex items-center justify-center gap-2 rounded-full bg-[#FF6B4F] px-5 py-3 font-bold text-[#1A1412] transition hover:bg-[#FF8467] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[#FBF3E8] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <Plus size={18} />

                              {updating === debt.id
                                ? "Saving..."
                                : "Add Payment"}
                            </button>
                          </div>
                        )}

                        <div className="mt-3 text-xs text-[#C3B5A3]">
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
          <section className="mt-8 rounded-3xl border border-[#2F6B66] bg-[#173D2C] p-8 text-center text-[#FBF3E8]">
            <Trophy className="mx-auto mb-4" size={36} />

            <h2 className="font-[family-name:var(--font-display)] text-3xl font-semibold">
              You did it.
            </h2>

            <p className="mx-auto mt-3 max-w-lg text-[#E4D7C6]">
              {formatMoney(totalDebt)} eliminated.
              You are officially debt free.
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
    <div className="rounded-3xl border border-[rgba(251,243,232,0.16)] bg-[#10302D] p-6">
      <div className="mb-7 flex h-10 w-10 items-center justify-center rounded-full bg-[rgba(255,107,79,0.18)] text-[#FF8A70]">
        {icon}
      </div>

      <p className="text-sm text-[#E4D7C6]">
        {title}
      </p>

      <p className="mt-1 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight">
        {amount}
      </p>
    </div>
  );
}