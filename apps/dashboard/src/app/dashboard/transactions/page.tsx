"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  transactionsApi,
  walletsApi,
  categoriesApi,
  ApiError,
} from "@/lib/api";
import { formatCurrency, formatPercent } from "@/lib/utils";

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [wallets, setWallets] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [queryReady, setQueryReady] = useState(false);
  const [filters, setFilters] = useState({
    walletId: "",
    categoryId: "",
    startDate: "",
    endDate: "",
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setFilters({
      walletId: params.get("walletId") ?? "",
      categoryId: params.get("categoryId") ?? "",
      startDate: params.get("startDate")?.slice(0, 10) ?? "",
      endDate: params.get("endDate")?.slice(0, 10) ?? "",
    });
    setQueryReady(true);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [walletsData, categoriesData] = await Promise.all([
          walletsApi.list(),
          categoriesApi.list(),
        ]);
        setWallets(walletsData);
        setCategories(categoriesData);
      } catch (error) {
        console.error("Failed to load filter data:", error);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (!queryReady) return;
    let cancelled = false;
    const fetchTransactions = async () => {
      setIsLoading(true);
      setError("");
      try {
        const params: Record<string, string> = {};
        if (filters.walletId) params.walletId = filters.walletId;
        if (filters.categoryId) params.categoryId = filters.categoryId;
        if (filters.startDate) params.startDate = filters.startDate;
        if (filters.endDate)
          params.endDate = `${filters.endDate}T23:59:59.999Z`;

        const data = await transactionsApi.list(params);
        if (!cancelled) setTransactions(data);
      } catch (err: unknown) {
        if (!cancelled)
          setError(
            err instanceof ApiError
              ? `${err.statusCode} ${err.errorMsg}: ${err.message}`
              : "Failed to load transactions",
          );
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchTransactions();
    return () => {
      cancelled = true;
    };
  }, [filters, queryReady]);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this transaction?")) return;

    try {
      await transactionsApi.delete(id);
      setTransactions(transactions.filter((t) => t.id !== id));
    } catch (error) {
      alert("Failed to delete transaction");
    }
  };

  const getCategoryColor = (type: string) => {
    return type === "INCOME"
      ? "bg-green-100 text-green-700"
      : "bg-red-100 text-red-700";
  };

  const totalIncome = transactions
    .filter((t) => t.category?.type === "INCOME")
    .reduce((sum, t) => sum + Number(t.amount), 0);
  const totalExpense = transactions
    .filter((t) => t.category?.type !== "INCOME")
    .reduce((sum, t) => sum + Number(t.amount), 0);
  const net = totalIncome - totalExpense;
  const hasFilter = Object.values(filters).some(Boolean);
  const expenseCount = transactions.length
    ? transactions.filter((t) => t.category?.type !== "INCOME").length
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Transactions</h1>
          <p className="text-gray-500">
            {hasFilter
              ? `Filtered view · ${transactions.length} ${transactions.length === 1 ? "entry" : "entries"}`
              : `All time · ${transactions.length} ${transactions.length === 1 ? "entry" : "entries"}`}
          </p>
        </div>
        <Link
          href="/dashboard/transactions/new"
          className="text-sm text-blue-600 hover:text-blue-800 font-medium whitespace-nowrap"
        >
          + Add transaction
        </Link>
      </div>

      {/* Stats derived from the rows currently in view */}
      {transactions.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow-sm p-5 border">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Income
            </p>
            <p className="mt-1.5 text-xl font-bold text-green-600">
              {formatCurrency(totalIncome)}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-5 border">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Expense
            </p>
            <p className="mt-1.5 text-xl font-bold text-red-600">
              {formatCurrency(totalExpense)}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-5 border">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Net
            </p>
            <p
              className={`mt-1.5 text-xl font-bold ${net >= 0 ? "text-gray-900" : "text-red-600"}`}
            >
              {formatCurrency(net)}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-5 border">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Avg expense
            </p>
            <p className="mt-1.5 text-xl font-bold text-gray-900">
              {formatCurrency(expenseCount ? totalExpense / expenseCount : 0)}
            </p>
            <p className="mt-1 text-xs text-gray-400">
              {expenseCount} expense{expenseCount === 1 ? "" : "s"}
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg text-sm border border-red-100">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm p-4 border">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <select
            value={filters.walletId}
            onChange={(e) =>
              setFilters({ ...filters, walletId: e.target.value })
            }
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Wallets</option>
            {wallets.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>

          <select
            value={filters.categoryId}
            onChange={(e) =>
              setFilters({ ...filters, categoryId: e.target.value })
            }
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <input
            type="date"
            value={filters.startDate}
            onChange={(e) =>
              setFilters({ ...filters, startDate: e.target.value })
            }
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Start Date"
          />

          <input
            type="date"
            value={filters.endDate}
            onChange={(e) =>
              setFilters({ ...filters, endDate: e.target.value })
            }
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="End Date"
          />
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        ) : transactions.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No transactions found.{" "}
            <Link href="/dashboard/transactions/new" className="text-blue-600">
              Create one
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Wallet
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {transactions.map((transaction) => (
                  <tr key={transaction.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(transaction.transactionDate).toLocaleDateString(
                        "id-ID",
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {transaction.description || "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getCategoryColor(transaction.category.type)}`}
                      >
                        {transaction.category.name}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {transaction.wallet.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <span
                        className={
                          transaction.category.type === "INCOME"
                            ? "text-green-600"
                            : "text-red-600"
                        }
                      >
                        {transaction.category.type === "INCOME" ? "+" : "-"}
                        {formatCurrency(Number(transaction.amount))}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Link
                        href={`/dashboard/transactions/${transaction.id}`}
                        className="text-blue-600 hover:text-blue-900 mr-3"
                      >
                        Edit
                      </Link>
                      <button
                        onClick={() => handleDelete(transaction.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
