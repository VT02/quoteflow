"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Quotation = {
  id: string;
  quote_number: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  service_description: string | null;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  status: string;
  valid_until: string;
  created_at: string;
};

type ApiResponse = {
  success: boolean;
  quotations?: Quotation[];
  message?: string;
};

type SortOption = "newest" | "oldest" | "highest" | "lowest";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(date: string) {
  if (!date) return "—";

  return new Date(date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function getStatusClass(status: string) {
  switch (status.toLowerCase()) {
    case "accepted":
      return "bg-green-100 text-green-700";

    case "sent":
      return "bg-blue-100 text-blue-700";

    case "rejected":
      return "bg-red-100 text-red-700";

    case "expired":
      return "bg-orange-100 text-orange-700";

    case "draft":
    default:
      return "bg-gray-100 text-gray-700";
  }
}

export default function AllQuotationsPage() {
  const router = useRouter();

  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState<SortOption>("newest");

  useEffect(() => {
    async function fetchQuotations() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch("/api/quotations");
        const data: ApiResponse = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.message || "Could not load quotations.");
        }

        setQuotations(data.quotations || []);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Something went wrong while loading quotations.",
        );
      } finally {
        setLoading(false);
      }
    }

    fetchQuotations();
  }, []);

  const filteredQuotations = useMemo(() => {
    let result = [...quotations];

    // Search quotations
    if (search.trim()) {
      const query = search.toLowerCase().trim();

      result = result.filter((quote) => {
        return (
          quote.quote_number?.toLowerCase().includes(query) ||
          quote.customer_name?.toLowerCase().includes(query) ||
          quote.customer_email?.toLowerCase().includes(query) ||
          quote.customer_phone?.toLowerCase().includes(query) ||
          quote.service_description?.toLowerCase().includes(query)
        );
      });
    }

    // Filter by status
    if (statusFilter !== "all") {
      result = result.filter(
        (quote) => quote.status.toLowerCase() === statusFilter,
      );
    }

    // Sort quotations
    result.sort((a, b) => {
      switch (sortBy) {
        case "oldest":
          return (
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );

        case "highest":
          return b.total_amount - a.total_amount;

        case "lowest":
          return a.total_amount - b.total_amount;

        case "newest":
        default:
          return (
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
      }
    });

    return result;
  }, [quotations, search, statusFilter, sortBy]);

  const totalValue = quotations.reduce(
    (sum, quote) => sum + Number(quote.total_amount || 0),
    0,
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="mx-auto max-w-7xl px-6 py-10">
        {/* Header */}
        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <button
              onClick={() => router.push("/")}
              className="mb-3 text-sm font-medium text-indigo-600 hover:text-indigo-800"
            >
              ← Back to Dashboard
            </button>

            <h1 className="text-3xl font-bold tracking-tight text-gray-900">
              All Quotations
            </h1>

            <p className="mt-2 text-sm text-gray-500">
              Manage, search and track all your quotations in one place.
            </p>
          </div>

          <button
            onClick={() => router.push("/quotations/new")}
            className="rounded-lg bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
          >
            + Create Quotation
          </button>
        </div>

        {/* Summary cards */}
        <div className="mb-8 grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-gray-500">
              Total Quotations
            </p>

            <p className="mt-2 text-3xl font-bold text-gray-900">
              {quotations.length}
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-gray-500">
              Total Quotation Value
            </p>

            <p className="mt-2 text-3xl font-bold text-gray-900">
              {formatCurrency(totalValue)}
            </p>
          </div>
        </div>

        {/* Search and filters */}
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="md:col-span-1">
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Search
              </label>

              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by quote number, customer..."
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Filter by Status
              </label>

              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm text-gray-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              >
                <option value="all">All Statuses</option>
                <option value="draft">Draft</option>
                <option value="sent">Sent</option>
                <option value="accepted">Accepted</option>
                <option value="rejected">Rejected</option>
                <option value="expired">Expired</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Sort By
              </label>

              <select
                value={sortBy}
                onChange={(event) =>
                  setSortBy(event.target.value as SortOption)
                }
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm text-gray-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="highest">Highest Value</option>
                <option value="lowest">Lowest Value</option>
              </select>
            </div>
          </div>
        </div>

        {/* Quotations table */}
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-200 px-6 py-5">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Quotations
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Showing {filteredQuotations.length} of {quotations.length}{" "}
                quotations
              </p>
            </div>
          </div>

          {loading ? (
            <div className="py-16 text-center text-sm text-gray-500">
              Loading quotations...
            </div>
          ) : error ? (
            <div className="py-16 text-center">
              <p className="text-sm text-red-600">{error}</p>

              <button
                onClick={() => window.location.reload()}
                className="mt-3 text-sm font-medium text-indigo-600 hover:underline"
              >
                Try again
              </button>
            </div>
          ) : filteredQuotations.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-base font-medium text-gray-900">
                No quotations found
              </p>

              <p className="mt-2 text-sm text-gray-500">
                Try changing your search or filters.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Quote Number
                    </th>

                    <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Customer
                    </th>

                    <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Created On
                    </th>

                    <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Valid Until
                    </th>

                    <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Amount
                    </th>

                    <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Status
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {filteredQuotations.map((quote) => (
                    <tr
                      key={quote.id}
                      onClick={() => router.push(`/quotations/${quote.id}`)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          router.push(`/quotations/${quote.id}`);
                        }
                      }}
                      tabIndex={0}
                      role="link"
                      aria-label={`View quotation ${quote.quote_number}`}
                      className="cursor-pointer text-sm transition hover:bg-indigo-50 focus:bg-indigo-50 focus:outline-none"
                    >
                      <td className="whitespace-nowrap px-6 py-5 font-semibold text-indigo-600">
                        {quote.quote_number}
                      </td>

                      <td className="px-6 py-5">
                        <p className="font-medium text-gray-900">
                          {quote.customer_name}
                        </p>

                        <p className="mt-1 text-xs text-gray-500">
                          {quote.customer_email || "No email provided"}
                        </p>
                      </td>

                      <td className="whitespace-nowrap px-6 py-5 text-gray-600">
                        {formatDate(quote.created_at)}
                      </td>

                      <td className="whitespace-nowrap px-6 py-5 text-gray-600">
                        {formatDate(quote.valid_until)}
                      </td>

                      <td className="whitespace-nowrap px-6 py-5 font-semibold text-gray-900">
                        {formatCurrency(Number(quote.total_amount))}
                      </td>

                      <td className="whitespace-nowrap px-6 py-5">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${getStatusClass(quote.status)}`}
                        >
                          {quote.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
