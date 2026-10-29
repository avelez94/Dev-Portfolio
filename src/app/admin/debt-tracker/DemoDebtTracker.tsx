"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase-admin-browser";
import DemoBar from "../_demo/DemoBar";
import DebtTracker from "./DebtTracker";

/** The debt tracker on demo data: the rows come from this browser's demo session. */
export default function DemoDebtTracker() {
  const [debts, setDebts] = useState<Parameters<typeof DebtTracker>[0]["initialDebts"] | null>(null);
  useEffect(() => {
    supabase.from("debt_payoff").select("*").order("priority", { ascending: true }).then(({ data }) => setDebts(data ?? []));
  }, []);
  return (
    <>
      <DemoBar />
      {debts ? <DebtTracker initialDebts={debts} /> : <p role="status" style={{ padding: 24 }}>Loading the demo…</p>}
    </>
  );
}
