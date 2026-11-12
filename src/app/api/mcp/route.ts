import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { logQuotationEvent } from "@/lib/quotation-events";
import { timingSafeEqual } from "crypto";

function isAuthorized(request: Request) {
  const apiKey = process.env.MCP_API_KEY;

  if (!apiKey) return false;

  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) return false;

  const suppliedToken = authorization.slice(7);

  const expected = Buffer.from(apiKey);
  const supplied = Buffer.from(suppliedToken);

  if (expected.length !== supplied.length) return false;

  return timingSafeEqual(expected, supplied);
}

function generateQuoteNumber() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = crypto.randomUUID().slice(0, 6).toUpperCase();

  return `QT-${timestamp}-${random}`;
}

function createMcpServer() {
  const server = new McpServer({
    name: "QuoteFlow",
    version: "1.0.0",
  });

  // TOOL 1: CREATE QUOTATION
  server.registerTool(
    "create_quotation",
    {
      title: "Create Quotation",
      description:
        "Create a new quotation in QuoteFlow. Provide customer details, line items, tax rate and validity. The server calculates all totals and saves the quotation as a draft.",
      inputSchema: {
        customer_name: z.string().trim().min(1).max(150),
        customer_email: z.string().trim().email().optional(),
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
      },
    },
    async (input) => {
      const supabase = createAdminClient();

      const subtotal = input.items.reduce(
        (total, item) => total + item.quantity * item.unit_price,
        0,
      );

      const taxAmount = Number(((subtotal * input.tax_rate) / 100).toFixed(2));

      const totalAmount = Number((subtotal + taxAmount).toFixed(2));

      const validUntil = new Date();
      validUntil.setUTCDate(validUntil.getUTCDate() + input.validity_days);

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

      const { data, error } = await supabase
        .from("quotations")
        .insert(quotation)
        .select(
          "id, quote_number, customer_name, customer_email, customer_phone, service_description, items, subtotal, tax_rate, tax_amount, total_amount, status, valid_until, created_at",
        )
        .single();

      if (error) {
        console.error("MCP quotation creation error:", error);

        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: "Could not create the quotation. Please try again.",
            },
          ],
        };
      }

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

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                message: "Quotation created successfully in QuoteFlow.",
                quotation: data,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  // TOOL 2: LIST QUOTATIONS
  server.registerTool(
    "list_quotations",
    {
      title: "List Quotations",
      description:
        "Retrieve quotations from QuoteFlow, ordered from newest to oldest. Optionally filter by quotation status.",
      inputSchema: {
        status: z.enum(["draft", "sent", "accepted", "rejected"]).optional(),
        limit: z.number().int().min(1).max(100).default(50),
      },
    },
    async ({ status, limit }) => {
      const supabase = createAdminClient();

      let query = supabase
        .from("quotations")
        .select(
          "id, quote_number, customer_name, customer_email, total_amount, status, valid_until, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(limit);

      if (status) {
        query = query.eq("status", status);
      }

      const { data, error } = await query;

      if (error) {
        console.error("MCP quotation list error:", error);

        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: "Could not retrieve quotations.",
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                count: data.length,
                quotations: data,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  // TOOL 3: GET QUOTATION DETAILS
  server.registerTool(
    "get_quotation",
    {
      title: "Get Quotation Details",
      description:
        "Retrieve the full details of a specific quotation using its QuoteFlow quotation ID.",
      inputSchema: {
        id: z.string().uuid(),
      },
    },
    async ({ id }) => {
      const supabase = createAdminClient();

      const { data, error } = await supabase
        .from("quotations")
        .select(
          "id, quote_number, customer_name, customer_email, customer_phone, service_description, items, subtotal, tax_rate, tax_amount, total_amount, status, valid_until, created_at, updated_at",
        )
        .eq("id", id)
        .single();

      if (error || !data) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: "Quotation not found.",
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(data, null, 2),
          },
        ],
      };
    },
  );

  // TOOL 4: UPDATE QUOTATION STATUS
  server.registerTool(
    "update_quotation_status",
    {
      title: "Update Quotation Status",
      description:
        "Change a quotation's status in QuoteFlow. Allowed statuses: draft, sent, accepted and rejected.",
      inputSchema: {
        id: z.string().uuid(),
        status: z.enum(["draft", "sent", "accepted", "rejected"]),
      },
    },
    async ({ id, status }) => {
      const supabase = createAdminClient();

      const { data: existing, error: fetchError } = await supabase
        .from("quotations")
        .select("id, quote_number, status")
        .eq("id", id)
        .single();

      if (fetchError || !existing) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: "Quotation not found.",
            },
          ],
        };
      }

      const { data, error } = await supabase
        .from("quotations")
        .update({
          status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select(
          "id, quote_number, customer_name, total_amount, status, updated_at",
        )
        .single();

      if (error) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: "Could not update quotation status.",
            },
          ],
        };
      }

      if (existing.status !== status) {
        await logQuotationEvent({
          quotationId: id,
          eventType: "status_changed",
          description: `Quotation ${existing.quote_number} status changed from ${existing.status} to ${status}.`,
          metadata: {
            quote_number: existing.quote_number,
            previous_status: existing.status,
            new_status: status,
          },
        });
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                message: "Quotation status updated successfully.",
                quotation: data,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  return server;
}

async function handleMcpRequest(request: Request) {
  if (!isAuthorized(request)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const server = createMcpServer();

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  try {
    await server.connect(transport);
    return await transport.handleRequest(request);
  } catch (error) {
    console.error("MCP request error:", error);

    return new Response("Internal MCP server error", {
      status: 500,
    });
  } finally {
    await server.close().catch(() => {});
  }
}

export async function GET(request: Request) {
  return handleMcpRequest(request);
}

export async function POST(request: Request) {
  return handleMcpRequest(request);
}

export async function DELETE(request: Request) {
  return handleMcpRequest(request);
}
