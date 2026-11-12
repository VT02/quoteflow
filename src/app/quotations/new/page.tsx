"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type QuotationItem = {
  name: string;
  description: string;
  quantity: string;
  unit_price: string;
};

export default function NewQuotationPage() {
  const router = useRouter();

  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [serviceDescription, setServiceDescription] = useState("");

  const [items, setItems] = useState<QuotationItem[]>([
    {
      name: "",
      description: "",
      quantity: "1",
      unit_price: "",
    },
  ]);

  const [taxRate, setTaxRate] = useState("18");
  const [validityDays, setValidityDays] = useState("15");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Calculate subtotal
  const subtotal = items.reduce((total, item) => {
    const quantity = Number(item.quantity) || 0;
    const price = Number(item.unit_price) || 0;

    return total + quantity * price;
  }, 0);

  // Calculate tax and final amount
  const taxAmount = subtotal * ((Number(taxRate) || 0) / 100);
  const totalAmount = subtotal + taxAmount;

  // Format amounts in Indian Rupees
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(amount);
  };

  // Update an item
  const updateItem = (
    index: number,
    field: keyof QuotationItem,
    value: string,
  ) => {
    setItems((currentItems) =>
      currentItems.map((item, i) =>
        i === index ? { ...item, [field]: value } : item,
      ),
    );
  };

  // Add a new item
  const addItem = () => {
    setItems((currentItems) => [
      ...currentItems,
      {
        name: "",
        description: "",
        quantity: "1",
        unit_price: "",
      },
    ]);
  };

  // Remove an item
  const removeItem = (index: number) => {
    setItems((currentItems) => currentItems.filter((_, i) => i !== index));
  };

  // Save quotation
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    if (!customerName.trim()) {
      setError("Please enter the customer's name.");
      return;
    }

    const validItems = items.filter((item) => item.name.trim() !== "");

    if (validItems.length === 0) {
      setError("Please add at least one quotation item.");
      return;
    }

    for (const item of validItems) {
      const quantity = Number(item.quantity);
      const price = Number(item.unit_price);

      if (!Number.isFinite(quantity) || quantity <= 0) {
        setError("Item quantities must be greater than zero.");
        return;
      }

      if (!Number.isFinite(price) || price < 0) {
        setError("Item prices must be zero or greater.");
        return;
      }
    }

    const tax = Number(taxRate);
    const validity = Number(validityDays);

    if (!Number.isFinite(tax) || tax < 0 || tax > 100) {
      setError("Tax rate must be between 0 and 100.");
      return;
    }

    if (!Number.isInteger(validity) || validity < 1 || validity > 365) {
      setError("Validity must be between 1 and 365 days.");
      return;
    }

    const payload = {
      customer_name: customerName.trim(),
      customer_email: customerEmail.trim(),
      customer_phone: customerPhone.trim(),
      service_description: serviceDescription.trim(),
      items: validItems.map((item) => ({
        name: item.name.trim(),
        description: item.description.trim(),
        quantity: Number(item.quantity),
        unit_price: Number(item.unit_price),
      })),
      tax_rate: tax,
      validity_days: validity,
    };

    try {
      setSaving(true);

      const response = await fetch("/api/quotations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Could not create quotation.");
      }

      router.push("/");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    "w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

  const labelClass = "mb-1.5 block text-sm font-medium text-gray-700";

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-8">
          <button
            type="button"
            onClick={() => router.push("/")}
            className="mb-5 text-sm text-gray-500 transition hover:text-gray-900"
          >
            ← Back to Dashboard
          </button>

          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">
              Create Quotation
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Add customer details and items to generate a new quotation.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Customer Details */}
          <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-5">
              <h2 className="text-lg font-semibold text-gray-900">
                Customer Details
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Enter the details of the customer receiving this quotation.
              </p>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className={labelClass}>
                  Customer Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                  className={inputClass}
                  required
                />
              </div>

              <div>
                <label className={labelClass}>Email Address</label>
                <input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="customer@example.com"
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Phone Number</label>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Service Description</label>
                <input
                  type="text"
                  value={serviceDescription}
                  onChange={(e) => setServiceDescription(e.target.value)}
                  placeholder="e.g. Website development"
                  className={inputClass}
                />
              </div>
            </div>
          </section>

          {/* Quotation Items */}
          <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Quotation Items
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Add the products or services included in this quotation.
                </p>
              </div>

              <button
                type="button"
                onClick={addItem}
                className="shrink-0 rounded-lg border border-blue-200 px-3 py-2 text-sm font-medium text-blue-600 transition hover:bg-blue-50"
              >
                + Add Item
              </button>
            </div>

            <div className="space-y-5">
              {items.map((item, index) => (
                <div
                  key={index}
                  className="rounded-lg border border-gray-200 bg-gray-50 p-4"
                >
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-700">
                      Item {index + 1}
                    </h3>

                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItem(index)}
                        className="text-sm font-medium text-red-500 transition hover:text-red-700"
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className={labelClass}>Item Name</label>
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) =>
                          updateItem(index, "name", e.target.value)
                        }
                        placeholder="e.g. Website Design"
                        className={inputClass}
                      />
                    </div>

                    <div>
                      <label className={labelClass}>Description</label>
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) =>
                          updateItem(index, "description", e.target.value)
                        }
                        placeholder="Optional description"
                        className={inputClass}
                      />
                    </div>

                    <div>
                      <label className={labelClass}>Quantity</label>
                      <input
                        type="number"
                        min="0.01"
                        step="any"
                        value={item.quantity}
                        onChange={(e) =>
                          updateItem(index, "quantity", e.target.value)
                        }
                        className={inputClass}
                      />
                    </div>

                    <div>
                      <label className={labelClass}>Unit Price (₹)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unit_price}
                        onChange={(e) =>
                          updateItem(index, "unit_price", e.target.value)
                        }
                        placeholder="e.g. 15000"
                        className={inputClass}
                      />
                    </div>
                  </div>

                  <div className="mt-4 flex justify-end border-t border-gray-200 pt-3">
                    <p className="text-sm text-gray-600">
                      Amount:{" "}
                      <span className="font-semibold text-gray-900">
                        {formatCurrency(
                          (Number(item.quantity) || 0) *
                            (Number(item.unit_price) || 0),
                        )}
                      </span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Tax and Validity */}
          <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-5 text-lg font-semibold text-gray-900">
              Additional Settings
            </h2>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Tax Rate (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={taxRate}
                  onChange={(e) => setTaxRate(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Validity (Days)</label>
                <input
                  type="number"
                  min="1"
                  max="365"
                  step="1"
                  value={validityDays}
                  onChange={(e) => setValidityDays(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
          </section>

          {/* Quotation Summary */}
          <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-5 text-lg font-semibold text-gray-900">
              Quotation Summary
            </h2>

            <div className="ml-auto max-w-sm space-y-3">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>

              <div className="flex justify-between text-sm text-gray-600">
                <span>Tax ({Number(taxRate) || 0}%)</span>
                <span>{formatCurrency(taxAmount)}</span>
              </div>

              <div className="border-t border-gray-200 pt-3">
                <div className="flex justify-between text-base font-semibold text-gray-900">
                  <span>Total Amount</span>
                  <span>{formatCurrency(totalAmount)}</span>
                </div>
              </div>
            </div>
          </section>

          {/* Error Message */}
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col-reverse justify-end gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => router.push("/")}
              disabled={saving}
              className="rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Creating Quotation..." : "Create Quotation"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
