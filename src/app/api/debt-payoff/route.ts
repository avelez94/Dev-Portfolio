import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function PATCH(request: NextRequest) {
  try {
    const { id, completed } = await request.json();

    if (!id || typeof completed !== "boolean") {
      return NextResponse.json(
        { error: "Invalid request." },
        { status: 400 }
      );
    }

    const { data: existingDebt, error: fetchError } =
      await supabaseAdmin
        .from("debt_payoff")
        .select("original_balance")
        .eq("id", id)
        .single();

    if (fetchError || !existingDebt) {
      console.error("Debt lookup error:", fetchError);

      return NextResponse.json(
        { error: "Debt not found." },
        { status: 404 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("debt_payoff")
      .update({
        completed,
        completed_at: completed
          ? new Date().toISOString()
          : null,
        current_balance: completed
          ? 0
          : existingDebt.original_balance,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Debt update error:", error);

      return NextResponse.json(
        { error: "Unable to update debt." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      debt: data,
    });
  } catch (error) {
    console.error("Debt API error:", error);

    return NextResponse.json(
      { error: "Something went wrong." },
      { status: 500 }
    );
  }
}