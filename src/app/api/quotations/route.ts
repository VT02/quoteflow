import { logQuotationEvent } from "@/lib/quotation-events";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/supabase/require-auth";

// Validate incoming quotation data
const quotationSchema = z.object({
  customer_name: z.string().trim().min(1).max(150),

  customer_email: z.string().trim().email().optional().or(z.literal("")),

  customer_phone: z.string().trim().max(30).optional(),

  service_description: z.string().trim().max(2000).optional(),

  items: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(200),
        description: z.string().max(500).optional(),
        quantity: z.number().positive().finite(),
        unit_price: z.number().nonnegative().finite(),
      }),
    )
    .min(1)
    .max(100),

  tax_rate: z.number().min(0).max(100).default(18),

  validity_days: z.number().int().min(1).max(365).default(15),
});

// Generate a quotation number
function generateQuoteNumber() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = crypto.randomUUID().slice(0, 6).toUpperCase();

  return `QT-${timestamp}-${random}`;
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    if (!user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 },
      );
    }
    // 1. Read incoming request
    const body = await request.json();

    // 2. Validate the request
    const validation = quotationSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid quotation data",
          errors: validation.error.flatten(),
        },
        { status: 400 },
      );
    }

    const input = validation.data;

    // 3. Calculate quotation amounts on the server
    const subtotal = input.items.reduce((total, item) => {
      return total + item.quantity * item.unit_price;
    }, 0);

    const taxAmount = Number(((subtotal * input.tax_rate) / 100).toFixed(2));

    const totalAmount = Number((subtotal + taxAmount).toFixed(2));

    // 4. Calculate quotation validity
    const validUntil = new Date();

    validUntil.setUTCDate(validUntil.getUTCDate() + input.validity_days);

    // 5. Prepare database record
    const quotation = {
      quote_number: generateQuoteNumber(),

      customer_name: input.customer_name,
      customer_email: input.customer_email || null,
      customer_phone: input.customer_phone || null,

      service_description: input.service_description || null,

      items: input.items,

      subtotal: Number(subtotal.toFixed(2)),
      tax_rate: input.tax_rate,
      tax_amount: taxAmount,
      total_amount: totalAmount,

      status: "draft",

      valid_until: validUntil.toISOString().slice(0, 10),
    };

    // 6. Save quotation to Supabase
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("quotations")
      .insert(quotation)
      .select()
      .single();

    if (error) {
      console.error("Supabase quotation creation error:", error);

      return NextResponse.json(
        {
          success: false,
          message: "Could not save quotation",
        },
        { status: 500 },
      );
    }

    // 7. Record quotation creation activity
    await logQuotationEvent({
      quotationId: data.id,
      eventType: "quotation_created",
      description: `Quotation ${data.quote_number} was created.`,
      metadata: {
        quote_number: data.quote_number,
        customer_name: data.customer_name,
        total_amount: data.total_amount,
      },
    });

    // 8. Return successfully created quotation
    return NextResponse.json(
      {
        success: true,
        message: "Quotation created successfully",
        quotation: data,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Quotation API error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Something went wrong while creating quotation",
      },
      { status: 500 },
    );
  }
}

export async function GET() {
  try {
    const user = await requireAuth();

    if (!user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 },
      );
    }
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("quotations")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Supabase quotation retrieval error:", error);

      return NextResponse.json(
        {
          success: false,
          message: "Could not retrieve quotations",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      count: data.length,
      quotations: data,
    });
  } catch (error) {
    console.error("Quotation retrieval API error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Something went wrong while retrieving quotations",
      },
      { status: 500 },
    );
  }
}
