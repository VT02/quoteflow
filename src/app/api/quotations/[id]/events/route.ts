import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/supabase/require-auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth();

    if (!user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 },
      );
    }
    const { id } = await params;

    const supabase = createAdminClient();

    // Check whether the quotation exists
    const { data: quotation, error: quotationError } = await supabase
      .from("quotations")
      .select("id")
      .eq("id", id)
      .single();

    if (quotationError || !quotation) {
      return NextResponse.json(
        { success: false, message: "Quotation not found" },
        { status: 404 },
      );
    }

    // Retrieve quotation activity
    const { data: events, error: eventsError } = await supabase
      .from("quotation_events")
      .select("*")
      .eq("quotation_id", id)
      .order("created_at", { ascending: false });

    if (eventsError) {
      console.error("Quotation events retrieval error:", eventsError);

      return NextResponse.json(
        { success: false, message: "Could not retrieve quotation activity" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      count: events.length,
      events,
    });
  } catch (error) {
    console.error("Quotation events API error:", error);

    return NextResponse.json(
      { success: false, message: "Something went wrong" },
      { status: 500 },
    );
  }
}
