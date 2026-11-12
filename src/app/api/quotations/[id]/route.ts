import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logQuotationEvent } from "@/lib/quotation-events";
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

    const { data, error } = await supabase
      .from("quotations")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json(
          {
            success: false,
            message: "Quotation not found",
          },
          { status: 404 },
        );
      }

      console.error("Quotation retrieval error:", error);

      return NextResponse.json(
        {
          success: false,
          message: "Could not retrieve quotation",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      quotation: data,
    });
  } catch (error) {
    console.error("Quotation API error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Something went wrong",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(
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
    const body = await request.json();

    const allowedStatuses = ["draft", "sent", "accepted", "rejected"];

    if (
      typeof body.status !== "string" ||
      !allowedStatuses.includes(body.status)
    ) {
      return NextResponse.json(
        { success: false, message: "Invalid quotation status" },
        { status: 400 },
      );
    }

    const supabase = createAdminClient();

    // Fetch the current quotation status
    const { data: existingQuotation, error: fetchError } = await supabase
      .from("quotations")
      .select("id, quote_number, status")
      .eq("id", id)
      .single();

    if (fetchError || !existingQuotation) {
      return NextResponse.json(
        { success: false, message: "Quotation not found" },
        { status: 404 },
      );
    }

    const previousStatus = existingQuotation.status;
    const newStatus = body.status;

    // Update quotation status
    const { data, error } = await supabase
      .from("quotations")
      .update({
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Quotation update error:", error);

      return NextResponse.json(
        { success: false, message: "Could not update quotation" },
        { status: 500 },
      );
    }

    // Record activity only if the status actually changed
    if (previousStatus !== newStatus) {
      await logQuotationEvent({
        quotationId: id,
        eventType: "status_changed",
        description: `Quotation ${existingQuotation.quote_number} status changed from ${previousStatus} to ${newStatus}.`,
        metadata: {
          quote_number: existingQuotation.quote_number,
          previous_status: previousStatus,
          new_status: newStatus,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: "Quotation status updated successfully",
      quotation: data,
    });
  } catch (error) {
    console.error("Quotation PATCH error:", error);

    return NextResponse.json(
      { success: false, message: "Something went wrong" },
      { status: 500 },
    );
  }
}
