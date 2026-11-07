"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { transactionsApi, walletsApi, categoriesApi } from "@/lib/api";
import { dateInputValue } from "@/lib/utils";

export default function TransactionForm({
  transactionId,
}: {
  transactionId?: string;
}) {
  const router = useRouter();
  const [wallets, setWallets] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    walletId: "",
    categoryId: "",
    amount: "",
    description: "",
    transactionDate: dateInputValue(),
    currency: "IDR",
  });

  useEffect(() => {
    let active = true;
    const fetchData = async () => {
      setIsLoading(true);
      setError("");
      setFormData({
        walletId: "",
        categoryId: "",
        amount: "",
        description: "",
        transactionDate: dateInputValue(),
        currency: "IDR",
      });
      try {
        const [walletsData, categoriesData, transaction] = await Promise.all([
          walletsApi.list(),
          categoriesApi.list(),
          transactionId
            ? transactionsApi.get(transactionId)
            : Promise.resolve(null),
        ]);
        if (!active) return;
        setWallets(walletsData);
        setCategories(categoriesData);

        if (transaction) {
          setFormData({
            walletId: transaction.walletId,
            categoryId: transaction.categoryId,
            amount: String(transaction.amount),
            description: transaction.description || "",
            transactionDate: transaction.transactionDate.slice(0, 10),
            currency: transaction.currency,
          });
          return;
        }
        if (walletsData.length > 0) {
          setFormData((prev) => ({ ...prev, walletId: walletsData[0].id }));
        }
        if (categoriesData.length > 0) {
          setFormData((prev) => ({
            ...prev,
            categoryId: categoriesData[0].id,
          }));
        }
      } catch (error) {
        if (!active) return;
        setError(
          error instanceof Error
            ? error.message
            : "Failed to load transaction details",
        );
      } finally {
        if (active) setIsLoading(false);
      }
    };

    fetchData();
    return () => {
      active = false;
    };
  }, [transactionId]);

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const data = {
        ...formData,
        amount: Number(formData.amount),
      };
      if (transactionId) await transactionsApi.update(transactionId, data);
      else await transactionsApi.create(data);
      router.push("/dashboard/transactions");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Failed to create transaction");
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {transactionId ? "Edit Transaction" : "New Transaction"}
          </h1>
          <p className="text-gray-500">
            {transactionId
              ? "Update this transaction"
              : "Record a new transaction"}
          </p>
        </div>
        <Link
          href="/dashboard/transactions"
          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium"
        >
          Back to List
        </Link>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-lg shadow-sm p-6 border space-y-6"
      >
        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div>
          <label
            htmlFor="walletId"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Wallet <span className="text-red-500">*</span>
          </label>
          <select
            id="walletId"
            value={formData.walletId}
            onChange={(e) => handleChange("walletId", e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {wallets.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name} ({w.currency})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="categoryId"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Category <span className="text-red-500">*</span>
          </label>
          <select
            id="categoryId"
            value={formData.categoryId}
            onChange={(e) => handleChange("categoryId", e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.type})
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="amount"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Amount <span className="text-red-500">*</span>
            </label>
            <input
              id="amount"
              type="number"
              step="0.01"
              min="0.01"
              value={formData.amount}
              onChange={(e) => handleChange("amount", e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="0.00"
            />
          </div>

          <div>
            <label
              htmlFor="currency"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Currency
            </label>
            <input
              id="currency"
              type="text"
              value={formData.currency}
              readOnly
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="transactionDate"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Date <span className="text-red-500">*</span>
          </label>
          <input
            id="transactionDate"
            type="date"
            value={formData.transactionDate}
            onChange={(e) => handleChange("transactionDate", e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label
            htmlFor="description"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Description
          </label>
          <textarea
            id="description"
            value={formData.description}
            onChange={(e) => handleChange("description", e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Optional description"
          />
        </div>

        <div className="flex justify-end space-x-3 pt-4 border-t">
          <Link
            href="/dashboard/transactions"
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting || !formData.walletId || !formData.categoryId}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting
              ? "Saving..."
              : transactionId
                ? "Update Transaction"
                : "Create Transaction"}
          </button>
        </div>
      </form>
    </div>
  );
}
