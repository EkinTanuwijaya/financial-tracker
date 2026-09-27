"use client";

import { useState, useEffect } from "react";
import { transactionsApi } from "@/lib/api";
import {
  formatCurrency,
  formatPercent,
  savingsRate,
  topCategories,
} from "@/lib/utils";

export default function ReportsPage() {
  const [summary, setSummary] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [period, setPeriod] = useState<"month" | "week" | "day">("month");

  useEffect(() => {
    const fetchSummary = async () => {
      setIsLoading(true);
      try {
        const now = new Date();
        let startDate: Date;

        switch (period) {
          case "day":
            startDate = new Date(
              now.getFullYear(),
              now.getMonth(),
              now.getDate(),
            );
            break;
          case "week":
            const day = now.getDay();
            startDate = new Date(
              now.getFullYear(),
              now.getMonth(),
              now.getDate() - day,
            );
            break;
          case "month":
          default:
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            break;
        }

        const data = await transactionsApi.summary({
          startDate: startDate.toISOString().split("T")[0],
          endDate: now.toISOString().split("T")[0],
        });
        setSummary(data);
      } catch (error) {
        console.error("Failed to load summary:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSummary();
  }, [period]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const income = summary?.totalIncome ?? 0;
  const expense = summary?.totalExpense ?? 0;
  const net = income - expense;
  const rate = savingsRate(income, expense);
  const topSpend = topCategories(summary?.byCategory, 3);
  type WalletFlow = { income: number; expense: number };
  const walletEntries = (
    summary?.byWallet
      ? (Object.entries(summary.byWallet) as [string, WalletFlow][])
      : []
  ).sort((a, b) => b[1].expense - a[1].expense);
  const periodLabel = { day: "Today", week: "This week", month: "This month" }[
    period
  ];
  const daysElapsed =
    period === "day" ? 1 : period === "week" ? 7 : new Date().getDate();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="text-gray-500">{periodLabel} at a glance</p>
        </div>
        <div className="flex space-x-2">
          {(["day", "week", "month"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                period === p
                  ? "bg-blue-600 text-white"
                  : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
              }`}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Headline figures */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm p-5 border">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Income
          </p>
          <p className="mt-1.5 text-xl font-bold text-green-600">
            {formatCurrency(income)}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-5 border">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Expense
          </p>
          <p className="mt-1.5 text-xl font-bold text-red-600">
            {formatCurrency(expense)}
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
            Savings rate
          </p>
          <p
            className={`mt-1.5 text-xl font-bold ${rate >= 0 ? "text-green-600" : "text-red-600"}`}
          >
            {income > 0 ? formatPercent(rate) : "—"}
          </p>
          <p className="mt-1 text-xs text-gray-400">
            {formatCurrency(expense / Math.max(1, daysElapsed))} per day
          </p>
        </div>
      </div>

      {/* Insight strip */}
      {(topSpend.length > 0 || walletEntries.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-lg font-semibold text-gray-900">
              Heaviest spending
            </h2>
            {topSpend.length === 0 ? (
              <p className="mt-2 text-sm text-gray-500">
                No expenses in this period.
              </p>
            ) : (
              <>
                <p className="mt-2 text-sm text-gray-600">
                  <span className="font-semibold text-gray-900">
                    {topSpend[0].name}
                  </span>{" "}
                  took the most at{" "}
                  <span className="font-semibold text-gray-900">
                    {formatCurrency(topSpend[0].amount)}
                  </span>{" "}
                  ({formatPercent(topSpend[0].percent, 0)} of all spending).
                </p>
                <div className="mt-4 space-y-3">
                  {topSpend.map((s) => (
                    <div key={s.name}>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-700">{s.name}</span>
                        <span className="text-gray-500">
                          {formatCurrency(s.amount)}
                        </span>
                      </div>
                      <div className="mt-1.5 h-2 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-red-400"
                          style={{ width: `${s.percent}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-lg font-semibold text-gray-900">
              Active accounts
            </h2>
            {walletEntries.length === 0 ? (
              <p className="mt-2 text-sm text-gray-500">
                No activity in this period.
              </p>
            ) : (
              <>
                <p className="mt-2 text-sm text-gray-600">
                  {walletEntries[0][0]} saw the most outflow at{" "}
                  <span className="font-semibold text-gray-900">
                    {formatCurrency(walletEntries[0][1].expense)}
                  </span>
                  .
                </p>
                <ul className="mt-4 space-y-2">
                  {walletEntries.map(([name, data]) => (
                    <li
                      key={name}
                      className="flex justify-between text-sm border-b border-gray-100 pb-2 last:border-0"
                    >
                      <span className="text-gray-700">{name}</span>
                      <span className="text-gray-500">
                        <span className="text-green-600">
                          +{formatCurrency(data.income)}
                        </span>{" "}
                        ·{" "}
                        <span className="text-red-600">
                          −{formatCurrency(data.expense)}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      )}

      {/* By Category */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">By Category</h2>
        </div>
        <div className="divide-y">
          {summary?.byCategory &&
          Object.entries(summary.byCategory).length > 0 ? (
            Object.entries(summary.byCategory).map(
              ([category, data]: [string, any]) => (
                <div
                  key={category}
                  className="px-6 py-4 flex items-center justify-between"
                >
                  <div className="flex items-center space-x-4">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center ${data.expense > 0 ? "bg-red-100" : "bg-green-100"}`}
                    >
                      <svg
                        className={`w-5 h-5 ${data.expense > 0 ? "text-red-600" : "text-green-600"}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d={
                            data.expense > 0
                              ? "M20 12H4M12 4v16"
                              : "M12 6v18M18 12H6"
                          }
                        />
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{category}</p>
                      <p className="text-sm text-gray-500">
                        Income: {formatCurrency(data.income)} • Expense:{" "}
                        {formatCurrency(data.expense)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">
                      {formatCurrency(data.income - data.expense)}
                    </p>
                  </div>
                </div>
              ),
            )
          ) : (
            <div className="px-6 py-8 text-center text-gray-500">
              No data for this period
            </div>
          )}
        </div>
      </div>

      {/* By Wallet */}
      <div className="bg-white rounded-lg shadow-sm border mt-6">
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">By Wallet</h2>
        </div>
        <div className="divide-y">
          {summary?.byWallet && Object.entries(summary.byWallet).length > 0 ? (
            Object.entries(summary.byWallet).map(
              ([wallet, data]: [string, any]) => (
                <div
                  key={wallet}
                  className="px-6 py-4 flex items-center justify-between"
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                      <svg
                        className="w-5 h-5 text-blue-600"
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
                      <p className="font-medium text-gray-900">{wallet}</p>
                      <p className="text-sm text-gray-500">
                        Income: {formatCurrency(data.income)} • Expense:{" "}
                        {formatCurrency(data.expense)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">
                      {formatCurrency(data.income - data.expense)}
                    </p>
                  </div>
                </div>
              ),
            )
          ) : (
            <div className="px-6 py-8 text-center text-gray-500">
              No data for this period
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
