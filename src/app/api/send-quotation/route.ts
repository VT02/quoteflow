import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/admin";
import { logQuotationEvent } from "@/lib/quotation-events";
import { requireAuth } from "@/lib/supabase/require-auth";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    if (!user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 },
      );
    }
    const body: unknown = await request.json();

    if (
      typeof body !== "object" ||
      body === null ||
      !("quotationId" in body) ||
      typeof body.quotationId !== "string"
    ) {
      return NextResponse.json(
        { success: false, message: "Invalid quotation ID" },
        { status: 400 },
      );
    }

    const supabase = createAdminClient();

    const { data: quotation, error: fetchError } = await supabase
      .from("quotations")
      .select("*")
      .eq("id", body.quotationId)
      .single();

    if (fetchError || !quotation) {
      return NextResponse.json(
        { success: false, message: "Quotation not found" },
        { status: 404 },
      );
    }

    if (!quotation.customer_email) {
      return NextResponse.json(
        { success: false, message: "Customer email is missing" },
        { status: 400 },
      );
    }

    if (quotation.status === "accepted" || quotation.status === "rejected") {
      return NextResponse.json(
        {
          success: false,
          message: "This quotation already has a final decision.",
        },
        { status: 409 },
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL;

    if (!baseUrl) {
      return NextResponse.json(
        { success: false, message: "Application URL is not configured." },
        { status: 500 },
      );
    }

    const quotationUrl = `${baseUrl}/quote/${quotation.public_token}`;

    const { data: emailData, error: emailError } = await resend.emails.send({
      from: "QuoteFlow <onboarding@resend.dev>",
      to: [quotation.customer_email],
      subject: `Quotation ${quotation.quote_number} from QuoteFlow`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 24px; color: #111827;">
          <h2 style="color: #4f46e5;">Your quotation is ready</h2>

          <p>Hello ${quotation.customer_name},</p>

          <p>
            Thank you for considering our services.
            Your quotation is ready for review.
          </p>

          <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 24px 0;">
            <p><strong>Quotation:</strong> ${quotation.quote_number}</p>
            <p><strong>Service:</strong> ${quotation.service_description || "As discussed"}</p>
            <p><strong>Total Amount:</strong> ₹${Number(quotation.total_amount).toLocaleString("en-IN")}</p>
            <p><strong>Valid Until:</strong> ${quotation.valid_until}</p>
          </div>

          <a
            href="${quotationUrl}"
            style="display: inline-block; background: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;"
          >
            View Quotation
          </a>

          <p style="margin-top: 32px; font-size: 13px; color: #6b7280;">
            Please review the quotation and submit your decision using the link above.
          </p>
        </div>
      `,
    });

    if (emailError) {
      console.error("Resend email error:", emailError);

      return NextResponse.json(
        { success: false, message: "Could not send quotation email." },
        { status: 500 },
      );
    }

    const { error: updateError } = await supabase
      .from("quotations")
      .update({
        status: "sent",
        updated_at: new Date().toISOString(),
      })
      .eq("id", quotation.id)
      .in("status", ["draft", "sent"]);

    if (updateError) {
      console.error("Quotation status update error:", updateError);

      return NextResponse.json({
        success: true,
        message: "Email sent, but quotation status could not be updated.",
        emailId: emailData?.id,
      });
    }

    // Record quotation email activity
    await logQuotationEvent({
      quotationId: quotation.id,
      eventType: "quotation_sent",
      description: `Quotation ${quotation.quote_number} was emailed to ${quotation.customer_email}.`,
      metadata: {
        quote_number: quotation.quote_number,
        recipient: quotation.customer_email,
        email_id: emailData?.id,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Quotation email sent successfully.",
      emailId: emailData?.id,
    });
  } catch (error) {
    console.error("Quotation email error:", error);

    return NextResponse.json(
      { success: false, message: "Something went wrong." },
      { status: 500 },
    );
  }
}
