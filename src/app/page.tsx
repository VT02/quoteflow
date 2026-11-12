"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import LogoutButton from "@/components/LogoutButton";

type Quotation = {
  id: string;
  quote_number: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  service_description: string | null;
  total_amount: number | string;
  status: string;
  created_at: string;
};

type ApiResponse = {
  success: boolean;
  quotations?: Quotation[];
  message?: string;
};

function getCurrentDate() {
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());
}

function subscribeToDate() {
  return () => {};
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(date: string) {
  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) return "—";

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsedDate);
}

function formatStatus(status: string) {
  const labels: Record<string, string> = {
    draft: "Draft",
    sent: "Sent",
    accepted: "Accepted",
    rejected: "Rejected",
    expired: "Expired",
  };
  return labels[status] || status;
}

function getStatusClass(status: string) {
  const styles: Record<string, string> = {
    draft: "bg-gray-100 text-gray-600",
    sent: "bg-blue-50 text-blue-700",
    accepted: "bg-green-50 text-green-700",
    rejected: "bg-red-50 text-red-700",
    expired: "bg-amber-50 text-amber-700",
  };
  return styles[status] || "bg-gray-100 text-gray-600";
}

export default function Home() {
  const router = useRouter();

  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const currentDate = useSyncExternalStore(
    subscribeToDate,
    getCurrentDate,
    () => "",
  );

  useEffect(() => {
    let active = true;
    async function fetchQuotations() {
      try {
        const response = await fetch("/api/quotations");
        const result: ApiResponse = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.message || "Could not load quotations.");
        }
        if (active) setQuotations(result.quotations || []);
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Something went wrong while loading quotations.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    void fetchQuotations();
    return () => {
      active = false;
    };
  }, []);

  const pendingQuotations = quotations.filter(
    (quote) => quote.status === "sent",
  ).length;

  const acceptedQuotations = quotations.filter(
    (quote) => quote.status === "accepted",
  ).length;

  const totalValue = quotations.reduce(
    (total, quote) => total + Number(quote.total_amount || 0),
    0,
  );

  const stats = [
    {
      title: "Total Quotations",
      value: quotations.length.toString(),
      description: "All quotations",
      icon: "▤",
    },
    {
      title: "Pending Approval",
      value: pendingQuotations.toString(),
      description: "Awaiting response",
      icon: "◷",
    },
    {
      title: "Accepted",
      value: acceptedQuotations.toString(),
      description: "Accepted quotations",
      icon: "✓",
    },
    {
      title: "Total Value",
      value: formatCurrency(totalValue),
      description: "Total quotation value",
      icon: "₹",
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <aside className="relative min-h-screen border-r border-gray-200 bg-white px-6 py-7 md:fixed md:inset-y-0 md:left-0 md:w-64">
        <div className="mb-10 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 font-bold text-white">
            Q
          </div>
          <div>
            <p className="font-bold">QuoteFlow</p>
            <p className="text-xs text-gray-400">Quotation Management</p>
          </div>
        </div>
        <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-400">
          Workspace
        </p>
        <nav className="space-y-2">
          <Link
            href="/"
            className="flex items-center gap-3 rounded-lg bg-indigo-50 px-4 py-3 text-sm font-semibold text-indigo-700"
          >
            <span>▦</span> Overview
          </Link>
          <Link
            href="/quotations"
            className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm text-gray-600 transition hover:bg-gray-50"
          >
            <span>▤</span> Quotations
          </Link>
          <Link
            href="/customers"
            className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm text-gray-600 transition hover:bg-gray-50"
          >
            <span>♙</span> Customers
          </Link>
        </nav>
        <p className="mb-4 mt-10 text-xs font-semibold uppercase tracking-wider text-gray-400">
          Settings
        </p>
        <nav className="space-y-2">
          <Link
            href="/settings"
            className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm text-gray-600 transition hover:bg-gray-50"
          >
            <span>⚙</span> Settings
          </Link>
          <Link
            href="/help"
            className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm text-gray-600 transition hover:bg-gray-50"
          >
            <span>?</span> Help &amp; Support
          </Link>
        </nav>
        <div className="mt-10 border-t border-gray-100 pt-5 md:absolute md:bottom-7 md:left-6 md:right-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 font-semibold text-indigo-700">
              VT
            </div>
            <div>
              <p className="text-sm font-semibold">Varchasv Tyagi</p>
              <p className="text-xs text-gray-400">Business Owner</p>
            </div>
          </div>
        </div>
      </aside>
      <main className="min-h-screen px-5 py-7 md:ml-64 md:px-10">
        <header className="mb-10 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="mb-1 text-sm text-gray-500">{currentDate}</p>
            <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
            <p className="mt-1 text-sm text-gray-500">
              Here&apos;s what&apos;s happening with your quotations.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <LogoutButton />
            <Link
              href="/quotations/new"
              className="rounded-lg bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
            >
              + Create Quotation
            </Link>
          </div>
        </header>
        <section className="mb-10 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => (
            <div
              key={stat.title}
              className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
            >
              <div className="mb-5 flex items-center justify-between">
                <p className="text-sm text-gray-500">{stat.title}</p>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 font-semibold text-indigo-600">
                  {stat.icon}
                </div>
              </div>
              <h2 className="mb-2 text-2xl font-bold">
                {loading ? "..." : stat.value}
              </h2>
              <p className="text-xs text-gray-400">{stat.description}</p>
            </div>
          ))}
        </section>
        <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-100 p-6">
            <div>
              <h2 className="text-lg font-bold">Recent Quotations</h2>
              <p className="mt-1 text-sm text-gray-500">
                Manage and track your latest quotations.
              </p>
            </div>
            <Link
              href="/quotations"
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
            >
              View all →
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left">
              <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-400">
                <tr>
                  <th className="px-6 py-4 font-semibold">Quote ID</th>
                  <th className="px-6 py-4 font-semibold">Customer</th>
                  <th className="px-6 py-4 font-semibold">Service</th>
                  <th className="px-6 py-4 font-semibold">Date</th>
                  <th className="px-6 py-4 font-semibold">Amount</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-10 text-center text-sm text-gray-400"
                    >
                      Loading quotations...
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-10 text-center text-sm text-red-500"
                    >
                      {error}
                    </td>
                  </tr>
                ) : quotations.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-10 text-center text-sm text-gray-400"
                    >
                      No quotations found. Create your first quotation.
                    </td>
                  </tr>
                ) : (
                  quotations.slice(0, 5).map((quote) => (
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
                      <td className="px-6 py-5 font-medium text-indigo-600">
                        {quote.quote_number}
                      </td>
                      <td className="px-6 py-5">
                        <p className="font-medium">{quote.customer_name}</p>
                        <p className="mt-1 text-xs text-gray-400">
                          {quote.customer_email || "No email provided"}
                        </p>
                      </td>
                      <td className="px-6 py-5 text-gray-500">
                        {quote.service_description || "—"}
                      </td>
                      <td className="whitespace-nowrap px-6 py-5 text-gray-500">
                        {formatDate(quote.created_at)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-5 font-semibold">
                        {formatCurrency(Number(quote.total_amount))}
                      </td>
                      <td className="px-6 py-5">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-medium ${getStatusClass(
                            quote.status,
                          )}`}
                        >
                          {formatStatus(quote.status)}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="border-t border-gray-100 px-6 py-4 text-sm text-gray-400">
            {loading
              ? "Loading..."
              : `Showing ${Math.min(quotations.length, 5)} of ${quotations.length} quotations`}
          </div>
        </section>
        <footer className="mt-8 text-center text-xs text-gray-400">
          © 2026 QuoteFlow. All rights reserved.
        </footer>
      </main>
    </div>
  );
}
