"use client";

import { Suspense, useEffect, useState, type ChangeEvent } from "react";
import { useParams, useRouter } from "next/navigation";

type QuotationItem = {
  name: string;
  description?: string;
  quantity: number;
  unit_price: number;
};

type Quotation = {
  id: string;
  quote_number: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  service_description: string | null;
  items: QuotationItem[];
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total_amount: number;
  status: string;
  valid_until: string;
  public_token: string;
  created_at: string;
  updated_at: string;
};

type QuotationEvent = {
  id: string;
  event_type: string;
  description: string;
  created_at: string;
  metadata: Record<string, unknown>;
};

function QuotationDetailsContent() {
  const params = useParams();
  const router = useRouter();

  const id = params.id as string;

  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [events, setEvents] = useState<QuotationEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailMessage, setEmailMessage] = useState("");
  const [emailError, setEmailError] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const handleStatusChange = async (event: ChangeEvent<HTMLSelectElement>) => {
    if (!quotation) return;

    const newStatus = event.target.value;
    const previousStatus = quotation.status;

    try {
      const response = await fetch(`/api/quotations/${quotation.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: newStatus,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Could not update status");
      }

      setQuotation(data.quotation);
    } catch (error) {
      setQuotation((current) =>
        current ? { ...current, status: previousStatus } : current,
      );
      setError(
        error instanceof Error
          ? error.message
          : "Something went wrong while updating status.",
      );
    }
  };

  const handleSendQuotation = async () => {
    if (!quotation) return;

    if (!quotation.customer_email) {
      setEmailError("Customer email address is missing.");
      return;
    }

    const confirmed = window.confirm(
      `Send quotation ${quotation.quote_number} to ${quotation.customer_email}?`,
    );
    if (!confirmed) return;

    try {
      setSendingEmail(true);
      setEmailMessage("");
      setEmailError("");

      const response = await fetch("/api/send-quotation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quotationId: quotation.id }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Could not send quotation.");
      }

      setQuotation((current) =>
        current ? { ...current, status: "sent" } : current,
      );
      setEmailMessage(data.message || "Quotation email sent successfully.");
    } catch (sendError) {
      setEmailError(
        sendError instanceof Error
          ? sendError.message
          : "Something went wrong.",
      );
    } finally {
      setSendingEmail(false);
    }
  };

  useEffect(() => {
    async function fetchQuotation() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(`/api/quotations/${id}`);
        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.message || "Could not load quotation.");
        }

        setQuotation(result.quotation);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      } finally {
        setLoading(false);
      }
    }

    async function fetchEvents() {
      try {
        setEventsLoading(true);

        const response = await fetch(`/api/quotations/${id}/events`);
        const result = await response.json();

        if (response.ok && result.success) {
          setEvents(result.events || []);
        }
      } catch (err) {
        console.error("Could not load quotation activity:", err);
      } finally {
        setEventsLoading(false);
      }
    }

    if (id) {
      fetchQuotation();
      fetchEvents();
    }
  }, [id]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (date: string) => {
    if (!date) return "—";

    return new Intl.DateTimeFormat("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(date));
  };

  const formatDateTime = (date: string) => {
    if (!date) return "—";

    return new Intl.DateTimeFormat("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "Asia/Kolkata",
    }).format(new Date(date));
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-500">Loading quotation...</p>
      </main>
    );
  }

  if (error || !quotation) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-semibold text-gray-900">
            Quotation not found
          </h1>

          <p className="mt-2 text-sm text-gray-500">
            {error || "We couldn't find this quotation."}
          </p>

          <button
            onClick={() => router.push("/")}
            className="mt-6 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            Back to Dashboard
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        {/* Header Actions */}
        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <button
              onClick={() => router.push("/")}
              className="mb-4 text-sm text-gray-500 hover:text-gray-900"
            >
              ← Back to Dashboard
            </button>

            <h1 className="text-2xl font-bold tracking-tight text-gray-900">
              Quotation Details
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              View and manage your quotation.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleSendQuotation}
              disabled={
                sendingEmail ||
                !quotation.customer_email ||
                quotation.status === "accepted" ||
                quotation.status === "rejected"
              }
              className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {sendingEmail ? "Sending..." : "Send Quotation"}
            </button>
            <button
              onClick={() => window.print()}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              Print Quotation
            </button>
          </div>
        </div>

        {emailMessage && (
          <div className="mb-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">
            {emailMessage}
          </div>
        )}

        {emailError && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {emailError}
          </div>
        )}

        {/* Quotation Document */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm sm:p-10">
          {/* Quotation Header */}
          <div className="flex flex-col justify-between gap-6 border-b border-gray-200 pb-8 sm:flex-row">
            <div>
              <h2 className="text-2xl font-bold text-blue-600">QuoteFlow</h2>

              <p className="mt-1 text-sm text-gray-500">
                Professional Quotations
              </p>
            </div>

            <div className="sm:text-right">
              <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
                Quotation Number
              </p>

              <h3 className="mt-1 text-lg font-bold text-gray-900">
                {quotation.quote_number}
              </h3>

              <div className="flex items-center gap-3">
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${
                    quotation.status === "accepted"
                      ? "bg-green-100 text-green-700"
                      : quotation.status === "sent"
                        ? "bg-blue-100 text-blue-700"
                        : quotation.status === "rejected"
                          ? "bg-red-100 text-red-700"
                          : "bg-gray-100 text-gray-700"
                  }`}
                >
                  {quotation.status}
                </span>

                <select
                  value={quotation.status}
                  onChange={handleStatusChange}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700"
                >
                  <option value="draft">Draft</option>
                  <option value="sent">Sent</option>
                  <option value="accepted">Accepted</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
            </div>
          </div>

          {/* Customer and Quotation Information */}
          <div className="grid gap-8 border-b border-gray-200 py-8 sm:grid-cols-2">
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
                Billed To
              </p>

              <h3 className="text-base font-semibold text-gray-900">
                {quotation.customer_name}
              </h3>

              {quotation.customer_email && (
                <p className="mt-1 text-sm text-gray-500">
                  {quotation.customer_email}
                </p>
              )}

              {quotation.customer_phone && (
                <p className="mt-1 text-sm text-gray-500">
                  {quotation.customer_phone}
                </p>
              )}
            </div>

            <div className="sm:text-right">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
                Quotation Information
              </p>

              <p className="text-sm text-gray-600">
                <span className="font-medium text-gray-800">Created:</span>{" "}
                {formatDate(quotation.created_at)}
              </p>

              <p className="mt-2 text-sm text-gray-600">
                <span className="font-medium text-gray-800">Valid Until:</span>{" "}
                {formatDate(quotation.valid_until)}
              </p>
            </div>
          </div>

          {/* Service Description */}
          {quotation.service_description && (
            <div className="border-b border-gray-200 py-6">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                Project / Service
              </p>

              <p className="text-sm text-gray-700">
                {quotation.service_description}
              </p>
            </div>
          )}

          {/* Items Table */}
          <div className="py-8">
            <h3 className="mb-5 text-base font-semibold text-gray-900">
              Items & Services
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-left">
                <thead>
                  <tr className="border-b border-gray-200 text-xs uppercase tracking-wider text-gray-400">
                    <th className="pb-3 font-semibold">Item</th>

                    <th className="pb-3 text-center font-semibold">Quantity</th>

                    <th className="pb-3 text-right font-semibold">
                      Unit Price
                    </th>

                    <th className="pb-3 text-right font-semibold">Amount</th>
                  </tr>
                </thead>

                <tbody>
                  {quotation.items.map((item, index) => (
                    <tr key={index} className="border-b border-gray-100">
                      <td className="py-4 pr-4">
                        <p className="text-sm font-medium text-gray-900">
                          {item.name}
                        </p>

                        {item.description && (
                          <p className="mt-1 text-xs text-gray-500">
                            {item.description}
                          </p>
                        )}
                      </td>

                      <td className="py-4 text-center text-sm text-gray-600">
                        {item.quantity}
                      </td>

                      <td className="py-4 text-right text-sm text-gray-600">
                        {formatCurrency(item.unit_price)}
                      </td>

                      <td className="py-4 text-right text-sm font-medium text-gray-900">
                        {formatCurrency(item.quantity * item.unit_price)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Total Summary */}
          <div className="flex justify-end border-t border-gray-200 pt-6">
            <div className="w-full space-y-3 sm:max-w-sm">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Subtotal</span>
                <span>{formatCurrency(quotation.subtotal)}</span>
              </div>

              <div className="flex justify-between text-sm text-gray-600">
                <span>Tax ({quotation.tax_rate}%)</span>
                <span>{formatCurrency(quotation.tax_amount)}</span>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <div className="flex justify-between text-lg font-bold text-gray-900">
                  <span>Grand Total</span>
                  <span className="text-blue-600">
                    {formatCurrency(quotation.total_amount)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-10 border-t border-gray-200 pt-6">
            <p className="text-center text-xs text-gray-400">
              This quotation is valid until {formatDate(quotation.valid_until)}.
            </p>
          </div>
        </div>
        {/* Activity History */}
        <div className="mt-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900">
              Activity History
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              A record of everything that has happened with this quotation.
            </p>
          </div>

          {eventsLoading ? (
            <p className="text-sm text-gray-500">Loading activity history...</p>
          ) : events.length === 0 ? (
            <p className="rounded-lg bg-gray-50 p-4 text-sm text-gray-500">
              No activity has been recorded yet.
            </p>
          ) : (
            <div className="relative">
              <div className="absolute bottom-4 left-[15px] top-4 w-px bg-gray-200" />

              <div className="space-y-6">
                {events.map((event) => {
                  const eventDetails: Record<
                    string,
                    { label: string; color: string; icon: string }
                  > = {
                    quotation_created: {
                      label: "Quotation Created",
                      color: "bg-blue-100 text-blue-700",
                      icon: "＋",
                    },
                    quotation_sent: {
                      label: "Quotation Sent",
                      color: "bg-indigo-100 text-indigo-700",
                      icon: "✉",
                    },
                    status_changed: {
                      label: "Status Updated",
                      color: "bg-amber-100 text-amber-700",
                      icon: "↻",
                    },
                    customer_accepted: {
                      label: "Quotation Accepted",
                      color: "bg-green-100 text-green-700",
                      icon: "✓",
                    },
                    customer_rejected: {
                      label: "Quotation Rejected",
                      color: "bg-red-100 text-red-700",
                      icon: "✕",
                    },
                  };

                  const details = eventDetails[event.event_type] || {
                    label: "Activity",
                    color: "bg-gray-100 text-gray-700",
                    icon: "•",
                  };

                  return (
                    <div key={event.id} className="relative flex gap-4">
                      <div
                        className={`z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${details.color}`}
                      >
                        {details.icon}
                      </div>

                      <div className="min-w-0 flex-1 pb-1">
                        <div className="flex flex-col justify-between gap-1 sm:flex-row sm:items-center">
                          <h3 className="text-sm font-semibold text-gray-900">
                            {details.label}
                          </h3>

                          <span className="text-xs text-gray-400">
                            {formatDateTime(event.created_at)}
                          </span>
                        </div>

                        <p className="mt-1 text-sm leading-6 text-gray-600">
                          {event.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body {
            background: white !important;
          }

          main {
            background: white !important;
            padding: 0 !important;
          }

          button {
            display: none !important;
          }

          .shadow-sm {
            box-shadow: none !important;
          }

          .rounded-xl {
            border: none !important;
          }
        }
      `}</style>
    </main>
  );
}

export default function QuotationDetailsPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-gray-50">
          <p className="text-sm text-gray-500">Loading quotation...</p>
        </main>
      }
    >
      <QuotationDetailsContent />
    </Suspense>
  );
}
