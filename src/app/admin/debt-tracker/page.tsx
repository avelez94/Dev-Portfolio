import { supabaseAdmin } from "@/lib/supabase-admin";
import DebtTracker from "./DebtTracker";

export const dynamic = "force-dynamic";

export default async function DebtTrackerPage() {
  const { data: debts, error } = await supabaseAdmin
    .from("debt_payoff")
    .select("*")
    .order("priority", { ascending: true });

  if (error) {
    console.error(error);

    return (
      <main className="flex min-h-screen items-center justify-center">
        <p>Unable to load your debt tracker.</p>
      </main>
    );
  }

  return <DebtTracker initialDebts={debts ?? []} />;
}