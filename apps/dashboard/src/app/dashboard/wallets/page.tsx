"use client";

import { useState, useEffect } from "react";
import { walletsApi, ApiError } from "@/lib/api";
import {
  formatCurrency,
  formatPercent,
  walletSlices,
  chartColor,
  chartSoftColor,
  CURRENCY_CODE,
  CURRENCY_SYMBOL,
  CURRENCY_LABEL,
  formatNumberForInput,
  parseAmountInput,
} from "@/lib/utils";

export default function WalletsPage() {
  const [wallets, setWallets] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingWallet, setEditingWallet] = useState<any | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    type: "CASH",
    currency: CURRENCY_CODE,
    balance: 0,
  });
  const [balanceInput, setBalanceInput] = useState("0");

  useEffect(() => {
    const fetchWallets = async () => {
      try {
        const data = await walletsApi.list();
        setWallets(data);
      } catch (error) {
        setError(
          error instanceof Error ? error.message : "Failed to load wallets",
        );
      } finally {
        setIsLoading(false);
      }
    };
    fetchWallets();
  }, []);

  const resetForm = () => {
    setFormData({
      name: "",
      type: "CASH",
      currency: CURRENCY_CODE,
      balance: 0,
    });
    setBalanceInput("0");
    setEditingWallet(null);
    setShowForm(false);
    setError("");
  };

  const handleEdit = (wallet: any) => {
    setEditingWallet(wallet);
    setFormData({
      name: wallet.name,
      type: wallet.type,
      currency: CURRENCY_CODE,
      balance: Number(wallet.balance),
    });
    setBalanceInput(formatNumberForInput(Number(wallet.balance)));
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this wallet?")) return;

    try {
      await walletsApi.delete(id);
      setWallets(wallets.filter((w) => w.id !== id));
    } catch (error) {
      alert("Failed to delete wallet");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      if (editingWallet) {
        await walletsApi.update(editingWallet.id, formData);
      } else {
        await walletsApi.create(formData);
      }
      resetForm();
      const data = await walletsApi.list();
      setWallets(data);
    } catch (err: unknown) {
      setError(
        err instanceof ApiError
          ? `${err.statusCode} ${err.errorMsg}: ${err.message}`
          : "Failed to save wallet",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError("");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const share = walletSlices(wallets);
  const netWorth = wallets.reduce((sum, w) => sum + Number(w.balance), 0);
  const colorFor = new Map(share.map((s, i) => [s.name, i]));
  const typeCount = wallets.reduce<Record<string, number>>((acc, w) => {
    acc[w.type] = (acc[w.type] ?? 0) + 1;
    return acc;
  }, {});
  const typeBreakdown = Object.entries(typeCount).sort((a, b) => b[1] - a[1]);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Wallets</h1>
          <p className="text-gray-500">
            {wallets.length === 0
              ? "No accounts yet"
              : `${wallets.length} ${wallets.length === 1 ? "account" : "accounts"} · ${typeBreakdown
                  .map(
                    ([type, n]) =>
                      `${n} ${type.toLowerCase().replace(/_/g, " ")}`,
                  )
                  .join(", ")}`}
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          className="text-sm text-blue-600 hover:text-blue-800 font-medium whitespace-nowrap"
        >
          + Add wallet
        </button>
      </div>

      {!showForm && error && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {error}
        </p>
      )}

      {/* Net worth */}
      {wallets.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg shadow-sm p-6 border md:col-span-1">
            <p className="text-sm font-medium text-gray-500">Net worth</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">
              {formatCurrency(netWorth)}
            </p>
            <p className="mt-1 text-sm text-gray-500">
              {netWorth < 0
                ? "Accounts are overdrawn"
                : `${share.length} funded ${
                    share.length === 1 ? "account" : "accounts"
                  }`}
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 border md:col-span-2">
            <p className="text-sm font-medium text-gray-500">Concentration</p>
            {share.length === 0 ? (
              <p className="mt-2 text-sm text-gray-500">
                No account holds a positive balance.
              </p>
            ) : (
              <>
                <p className="mt-2 text-sm text-gray-700">
                  {share[0].name} holds{" "}
                  <span className="font-semibold text-gray-900">
                    {formatPercent(share[0].percent, 0)}
                  </span>{" "}
                  of your balance
                  {share.length > 1 && (
                    <>
                      , {share[1].name} {formatPercent(share[1].percent, 0)}
                    </>
                  )}
                </p>
                <div className="mt-3 flex h-2.5 rounded-full overflow-hidden bg-gray-100">
                  {share.map((s, i) => (
                    <div
                      key={s.name}
                      className={`h-full ${chartColor(i)}`}
                      style={{ width: `${s.percent}%` }}
                      title={`${s.name} ${formatCurrency(s.amount)} · ${formatPercent(s.percent)}`}
                    />
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-gray-600">
                  {share.map((s, i) => (
                    <span
                      key={s.name}
                      className="inline-flex items-center gap-1.5"
                    >
                      <span
                        className={`w-2.5 h-2.5 rounded-sm ${chartColor(i)}`}
                      />
                      <span className="text-gray-700">{s.name}</span>
                      <span className="text-gray-400">
                        {formatCurrency(s.amount)}
                      </span>
                      <span className="text-gray-400">
                        {formatPercent(s.percent, 0)}
                      </span>
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {showForm && (
        <div className="bg-white rounded-lg shadow-sm p-6 border space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900">
              {editingWallet ? "Edit Wallet" : "New Wallet"}
            </h2>
            <button
              onClick={resetForm}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 text-red-600 p-4 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="name"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., BCA, Cash, GoPay"
                />
              </div>

              <div>
                <label
                  htmlFor="type"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Type <span className="text-red-500">*</span>
                </label>
                <select
                  id="type"
                  value={formData.type}
                  onChange={(e) => handleChange("type", e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="CASH">Cash</option>
                  <option value="BANK">Bank Account</option>
                  <option value="EWALLET">E-Wallet</option>
                  <option value="CREDIT_CARD">Credit Card</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Currency
                </label>
                <div className="w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-50 text-sm text-gray-600">
                  {CURRENCY_CODE} — {CURRENCY_LABEL} ({CURRENCY_SYMBOL})
                </div>
              </div>

              <div>
                <label
                  htmlFor="balance"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Initial Balance
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 pointer-events-none">
                    {CURRENCY_SYMBOL}
                  </span>
                  <input
                    id="balance"
                    type="text"
                    inputMode="numeric"
                    value={balanceInput}
                    onChange={(e) => {
                      const raw = e.target.value
                        .replace(/[^\d-]/g, "")
                        .replace(/(?!^)-/g, "");
                      setBalanceInput(raw);
                      setFormData((prev) => ({
                        ...prev,
                        balance: parseAmountInput(raw),
                      }));
                      setError("");
                    }}
                    onBlur={() =>
                      setBalanceInput(formatNumberForInput(formData.balance))
                    }
                    className="w-full pl-12 px-3 py-2 border border-gray-300 rounded-md text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0"
                  />
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Rupiah has no decimals · {formatCurrency(formData.balance)}
                </p>
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? "Saving..." : editingWallet ? "Update" : "Create"}
              </button>
            </div>
          </form>
        </div>
      )}

      {wallets.length === 0 ? (
        showForm ? null : (
          <div className="bg-white rounded-lg shadow-sm p-12 border text-center">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">
              No wallets
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Get started by creating a new wallet.
            </p>
          </div>
        )
      ) : (
        <div className="bg-white rounded-lg shadow-sm border divide-y">
          {wallets.map((wallet) => {
            const colorIndex = colorFor.get(wallet.name);
            const swatch =
              colorIndex === undefined
                ? "bg-gray-100 text-gray-400"
                : chartSoftColor(colorIndex);
            return (
              <div
                key={wallet.id}
                className="p-6 flex items-center justify-between hover:bg-gray-50"
              >
                <div className="flex items-center space-x-4">
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center ${swatch}`}
                  >
                    <svg
                      className="w-6 h-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      {wallet.name}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {wallet.type} • {CURRENCY_CODE}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <span className="font-semibold text-gray-900">
                    {formatCurrency(Number(wallet.balance))}
                  </span>
                  <button
                    onClick={() => handleEdit(wallet)}
                    className="text-blue-600 hover:text-blue-900 text-sm font-medium"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(wallet.id)}
                    className="text-red-600 hover:text-red-900 text-sm font-medium"
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
