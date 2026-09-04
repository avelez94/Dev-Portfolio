import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();

    const { id, action } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Debt ID is required." },
        { status: 400 }
      );
    }

    const { data: existingDebt, error: fetchError } =
      await supabaseAdmin
        .from("debt_payoff")
        .select("*")
        .eq("id", id)
        .single();

    if (fetchError || !existingDebt) {
      console.error("Debt lookup error:", fetchError);

      return NextResponse.json(
        { error: "Debt not found." },
        { status: 404 }
      );
    }

    if (action === "payment") {
      const payment = Number(body.payment);

      if (!payment || payment <= 0) {
        return NextResponse.json(
          { error: "Payment must be greater than zero." },
          { status: 400 }
        );
      }

      const currentBalance = Number(
        existingDebt.current_balance
      );

      if (payment > currentBalance) {
        return NextResponse.json(
          {
            error:
              "Payment cannot be greater than the remaining balance.",
          },
          { status: 400 }
        );
      }

      const newBalance = Math.max(
        0,
        currentBalance - payment
      );

      const isCompleted = newBalance === 0;

      const { data, error } = await supabaseAdmin
        .from("debt_payoff")
        .update({
          current_balance: newBalance,
          completed: isCompleted,
          completed_at: isCompleted
            ? new Date().toISOString()
            : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();

      if (error) {
        console.error("Payment update error:", error);

        return NextResponse.json(
          { error: "Unable to save payment." },
          { status: 500 }
        );
      }

      return NextResponse.json({
        debt: data,
      });
    }

    if (action === "toggle") {
      const completed = Boolean(body.completed);

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
        console.error("Debt toggle error:", error);

        return NextResponse.json(
          { error: "Unable to update debt." },
          { status: 500 }
        );
      }

      return NextResponse.json({
        debt: data,
      });
    }

    return NextResponse.json(
      { error: "Invalid action." },
      { status: 400 }
    );
  } catch (error) {
    console.error("Debt API error:", error);

    return NextResponse.json(
      { error: "Something went wrong." },
      { status: 500 }
    );
  }
}