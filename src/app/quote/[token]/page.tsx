"use client";

import { useParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

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
  service_description: string | null;
  items: QuotationItem[];
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total_amount: number;
  status: string;
  valid_until: string;
  created_at: string;
  is_expired: boolean;
};

type ApiResponse = {
  success: boolean;
  quotation?: Quotation;
  message?: string;
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(date: string) {
  if (!date || Number.isNaN(new Date(date).getTime())) return "—";

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(date));
}

function PublicQuotationContent() {
  const { token } = useParams<{ token: string }>();

  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [decisionLoading, setDecisionLoading] = useState(false);
  const [decisionMessage, setDecisionMessage] = useState("");
  const [decisionError, setDecisionError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function fetchQuotation() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(
          `/api/public/quotations/${encodeURIComponent(token)}`,
          { signal: controller.signal },
        );

        const data: ApiResponse = await response.json();

        if (!response.ok || !data.success || !data.quotation) {
          throw new Error(data.message || "Could not load quotation.");
        }

        setQuotation(data.quotation);
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Something went wrong.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    if (token) void fetchQuotation();

    return () => controller.abort();
  }, [token]);

  async function handleDecision(decision: "accepted" | "rejected") {
    const action = decision === "accepted" ? "accept" : "reject";

    const confirmed = window.confirm(
      `Are you sure you want to ${action} this quotation?`,
    );

    if (!confirmed) return;

    try {
      setDecisionLoading(true);
      setDecisionMessage("");
      setDecisionError("");

      const response = await fetch(
        `/api/public/quotations/${encodeURIComponent(token)}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ decision }),
        },
      );

      const data: ApiResponse = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Could not update quotation.");
      }

      setQuotation((current) =>
        current ? { ...current, status: decision } : current,
      );

      setDecisionMessage(
        decision === "accepted"
          ? "You have successfully accepted this quotation."
          : "You have successfully rejected this quotation.",
      );
    } catch (err) {
      setDecisionError(
        err instanceof Error ? err.message : "Something went wrong.",
      );
    } finally {
      setDecisionLoading(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-500">Loading quotation…</p>
      </main>
    );
  }

  if (error || !quotation) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-semibold text-gray-900">
            Quotation unavailable
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            {error || "We could not find this quotation."}
          </p>
        </div>
      </main>
    );
  }

  const isExpired = quotation.is_expired;
  const canRespond = !isExpired && ["draft", "sent"].includes(quotation.status);

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">QuoteFlow</h1>
            <p className="mt-1 text-sm text-gray-500">
              Your quotation, made simple.
            </p>
          </div>

          <button
            onClick={() => window.print()}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            Print / Save PDF
          </button>
        </header>

        <article className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 p-8 sm:p-10">
            <div className="flex flex-col justify-between gap-6 sm:flex-row">
              <div>
                <p className="text-sm font-medium uppercase tracking-wider text-indigo-600">
                  Quotation
                </p>
                <h2 className="mt-2 text-3xl font-bold text-gray-900">
                  {quotation.quote_number}
                </h2>
                <p className="mt-3 text-sm text-gray-500">
                  Issued on {formatDate(quotation.created_at)}
                </p>
              </div>

              <span className="inline-flex h-fit rounded-full bg-gray-100 px-4 py-2 text-sm font-semibold capitalize text-gray-700">
                {quotation.status}
              </span>
            </div>
          </div>

          <div className="grid gap-8 border-b border-gray-200 p-8 sm:grid-cols-2 sm:p-10">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                Prepared for
              </p>
              <p className="mt-3 text-lg font-semibold text-gray-900">
                {quotation.customer_name}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                Valid until
              </p>
              <p className="mt-3 text-lg font-semibold text-gray-900">
                {formatDate(quotation.valid_until)}
              </p>

              {isExpired && quotation.status !== "accepted" && (
                <p className="mt-1 text-xs text-red-600">
                  This quotation has expired.
                </p>
              )}
            </div>
          </div>

          <div className="p-8 sm:p-10">
            <h3 className="text-lg font-semibold text-gray-900">
              Quotation Details
            </h3>

            {quotation.service_description && (
              <p className="mt-2 text-sm text-gray-500">
                {quotation.service_description}
              </p>
            )}

            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[560px] text-left">
                <thead>
                  <tr className="border-b border-gray-200 text-xs uppercase tracking-wider text-gray-400">
                    <th className="py-4 pr-4">Item</th>
                    <th className="px-4 py-4 text-center">Qty</th>
                    <th className="px-4 py-4 text-right">Unit Price</th>
                    <th className="py-4 pl-4 text-right">Total</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {quotation.items.map((item, index) => (
                    <tr key={`${item.name}-${index}`}>
                      <td className="py-5 pr-4">
                        <p className="font-medium text-gray-900">{item.name}</p>

                        {item.description && (
                          <p className="mt-1 text-xs text-gray-500">
                            {item.description}
                          </p>
                        )}
                      </td>

                      <td className="px-4 py-5 text-center text-gray-600">
                        {item.quantity}
                      </td>

                      <td className="whitespace-nowrap px-4 py-5 text-right text-gray-600">
                        {formatCurrency(item.unit_price)}
                      </td>

                      <td className="whitespace-nowrap py-5 pl-4 text-right font-medium text-gray-900">
                        {formatCurrency(item.quantity * item.unit_price)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="ml-auto mt-8 max-w-sm space-y-4">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Subtotal</span>
                <span>{formatCurrency(quotation.subtotal)}</span>
              </div>

              <div className="flex justify-between text-sm text-gray-600">
                <span>Tax ({quotation.tax_rate}%)</span>
                <span>{formatCurrency(quotation.tax_amount)}</span>
              </div>

              <div className="flex justify-between border-t border-gray-200 pt-4 text-lg font-bold text-gray-900">
                <span>Total Amount</span>
                <span>{formatCurrency(quotation.total_amount)}</span>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-200 bg-white p-8 sm:p-10">
            {canRespond && (
              <div className="text-center">
                <h3 className="text-lg font-semibold text-gray-900">
                  Your decision
                </h3>

                <p className="mt-2 text-sm text-gray-500">
                  Please review the quotation and let us know your decision.
                </p>

                <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
                  <button
                    onClick={() => handleDecision("accepted")}
                    disabled={decisionLoading}
                    className="rounded-lg bg-green-600 px-6 py-3 text-sm font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {decisionLoading ? "Please wait..." : "Accept Quotation"}
                  </button>

                  <button
                    onClick={() => handleDecision("rejected")}
                    disabled={decisionLoading}
                    className="rounded-lg border border-red-300 px-6 py-3 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {decisionLoading ? "Please wait..." : "Reject Quotation"}
                  </button>
                </div>
              </div>
            )}

            {decisionMessage && (
              <p className="mt-4 text-center text-sm font-medium text-green-700">
                {decisionMessage}
              </p>
            )}

            {decisionError && (
              <p className="mt-4 text-center text-sm font-medium text-red-600">
                {decisionError}
              </p>
            )}

            {!canRespond && (
              <p className="text-center text-sm text-gray-500">
                {quotation.status === "accepted"
                  ? "This quotation has been accepted."
                  : quotation.status === "rejected"
                    ? "This quotation has been rejected."
                    : "This quotation is no longer available for a decision."}
              </p>
            )}

            <div className="mt-8 text-center">
              <p className="text-sm text-gray-500">
                Thank you for considering our services.
              </p>
              <p className="mt-2 text-xs text-gray-400">
                This quotation is generated through QuoteFlow.
              </p>
            </div>
          </div>
        </article>
      </div>

      <style jsx global>{`
        @media print {
          body {
            background: white !important;
          }
          button {
            display: none !important;
          }
          .min-h-screen {
            min-height: auto !important;
          }
          .shadow-sm {
            box-shadow: none !important;
          }
        }
      `}</style>
    </main>
  );
}

export default function PublicQuotationPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-gray-50">
          <p className="text-sm text-gray-500">Loading quotation…</p>
        </main>
      }
    >
      <PublicQuotationContent />
    </Suspense>
  );
}
