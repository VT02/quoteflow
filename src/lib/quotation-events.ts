import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type QuotationEventType =
  | "quotation_created"
  | "quotation_sent"
  | "status_changed"
  | "customer_accepted"
  | "customer_rejected";

type LogQuotationEventParams = {
  quotationId: string;
  eventType: QuotationEventType;
  description: string;
  metadata?: Record<string, unknown>;
};

export async function logQuotationEvent({
  quotationId,
  eventType,
  description,
  metadata = {},
}: LogQuotationEventParams) {
  try {
    const supabase = createAdminClient();

    const { error } = await supabase.from("quotation_events").insert({
      quotation_id: quotationId,
      event_type: eventType,
      description,
      metadata,
    });

    if (error) {
      console.error("Could not record quotation activity:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Quotation activity logging failed:", error);
    return false;
  }
}
