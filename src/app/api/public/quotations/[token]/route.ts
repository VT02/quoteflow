import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logQuotationEvent } from "@/lib/quotation-events";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;

    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("quotations")
      .select(
        "id, quote_number, customer_name, service_description, items, subtotal, tax_rate, tax_amount, total_amount, status, valid_until, created_at",
      )
      .eq("public_token", token)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { success: false, message: "Quotation not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      quotation: {
        ...data,
        is_expired:
          new Date(`${data.valid_until}T23:59:59Z`).getTime() < Date.now(),
      },
    });
  } catch (error) {
    console.error("Public quotation retrieval error:", error);

    return NextResponse.json(
      { success: false, message: "Could not retrieve quotation" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;
    const body: unknown = await request.json();

    if (
      typeof body !== "object" ||
      body === null ||
      !("decision" in body) ||
      (body.decision !== "accepted" && body.decision !== "rejected")
    ) {
      return NextResponse.json(
        { success: false, message: "Invalid quotation decision" },
        { status: 400 },
      );
    }

    const decision = body.decision;
    const supabase = createAdminClient();
    const { data: existingQuotation, error: fetchError } = await supabase
      .from("quotations")
      .select("id, quote_number, status, valid_until")
      .eq("public_token", token)
      .single();

    if (fetchError || !existingQuotation) {
      return NextResponse.json(
        { success: false, message: "Quotation not found" },
        { status: 404 },
      );
    }

    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
    }).format(new Date());
    if (existingQuotation.valid_until < today) {
      return NextResponse.json(
        { success: false, message: "This quotation has expired" },
        { status: 400 },
      );
    }

    if (["accepted", "rejected"].includes(existingQuotation.status)) {
      return NextResponse.json(
        {
          success: false,
          message: `This quotation has already been ${existingQuotation.status}`,
        },
        { status: 409 },
      );
    }

    if (!["draft", "sent"].includes(existingQuotation.status)) {
      return NextResponse.json(
        { success: false, message: "This quotation cannot be updated" },
        { status: 409 },
      );
    }

    const { data: updatedQuotation, error: updateError } = await supabase
      .from("quotations")
      .update({ status: decision, updated_at: new Date().toISOString() })
      .eq("id", existingQuotation.id)
      .in("status", ["draft", "sent"])
      .select()
      .single();

    if (updateError || !updatedQuotation) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Could not update quotation. It may already have a decision.",
        },
        { status: 409 },
      );
    }

    // Record customer decision activity
    await logQuotationEvent({
      quotationId: updatedQuotation.id,
      eventType:
        decision === "accepted" ? "customer_accepted" : "customer_rejected",
      description: `Customer ${decision} quotation ${existingQuotation.quote_number}.`,
      metadata: {
        quote_number: existingQuotation.quote_number,
        previous_status: existingQuotation.status,
        new_status: decision,
        decision_source: "public_quotation_page",
      },
    });

    return NextResponse.json({
      success: true,
      message: `Quotation ${decision} successfully`,
      quotation: updatedQuotation,
    });
  } catch (error) {
    console.error("Public quotation decision error:", error);
    return NextResponse.json(
      { success: false, message: "Something went wrong" },
      { status: 500 },
    );
  }
}
