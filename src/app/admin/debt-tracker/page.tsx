import { supabaseAdmin } from "@/lib/supabase-admin";
import DebtTracker from "./DebtTracker";
import { demoDeployment } from "@/lib/demo/mode";
import DemoDebtTracker from "./DemoDebtTracker";

export const dynamic = "force-dynamic";

export default async function DebtTrackerPage() {
  // Demo mode: fictional debts from the demo session, never the real table.
  if (demoDeployment()) return <DemoDebtTracker />;

  const { data: debts, error } = await supabaseAdmin
    .from("debt_payoff")
    .select("*")
    .order("priority", { ascending: true });

  if (error) {
    console.error(error);

    return (
      <main className="flex min-h-screen items-center justify-center bg-[#1C1614] px-4 text-[#FBF3E8]">
        <div role="alert" className="max-w-md rounded-3xl border border-[rgba(251,243,232,0.16)] bg-[#10302D] p-6 text-center">
          <p className="font-semibold">Unable to load your debt tracker.</p>
          <p className="mt-2 text-sm text-[#E4D7C6]">Refresh to try again.</p>
          <a href="/admin" className="mt-4 inline-block rounded-full border border-[rgba(251,243,232,0.3)] px-4 py-2 text-sm font-semibold">Back to Dashboard</a>
        </div>
      </main>
    );
  }

  return <DebtTracker initialDebts={debts ?? []} />;
}