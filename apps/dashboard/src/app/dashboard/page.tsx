"use client";

import { useState, useEffect } from "react";
import { transactionsApi, walletsApi, categoriesApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  formatCurrency,
  formatDateShort,
  formatPercent,
  savingsRate,
  topCategories,
  walletSlices,
  chartColor,
} from "@/lib/utils";

export default function DashboardPage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<any>(null);
  const [wallets, setWallets] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [recent, setRecent] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        const [summaryData, walletsData, categoriesData, recentData] =
          await Promise.all([
            transactionsApi.summary({
              startDate: monthStart.toISOString().split("T")[0],
              endDate: now.toISOString().split("T")[0],
            }),
            walletsApi.list(),
            categoriesApi.list(),
            transactionsApi.list(),
          ]);

        setSummary(summaryData);
        setWallets(walletsData);
        setCategories(categoriesData);
        setRecent(recentData.slice(0, 6));
      } catch (error) {
        console.error("Failed to load dashboard data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const income = summary?.totalIncome ?? 0;
  const expense = summary?.totalExpense ?? 0;
  const net = income - expense;
  const rate = savingsRate(income, expense);
  const netWorth = wallets.reduce((sum, w) => sum + Number(w.balance), 0);
  const spendBreakdown = topCategories(summary?.byCategory, 5);
  const walletShare = walletSlices(wallets);
  const monthName = new Date().toLocaleDateString("id-ID", { month: "long" });
  const unusedCategories = categories.filter(
    (c) => !spendBreakdown.some((s) => s.name === c.name),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500">
          {monthName} overview for {user?.name || user?.email}
        </p>
      </div>

      {/* Headline figures */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm p-6 border md:col-span-2">
          <p className="text-sm font-medium text-gray-500">Net worth</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">
            {formatCurrency(netWorth)}
          </p>
          <p className="mt-2 text-sm text-gray-500">
            Across {wallets.length}{" "}
            {wallets.length === 1 ? "wallet" : "wallets"}
            {walletShare.length > 0 &&
              ` · largest ${walletShare[0].name} at ${formatPercent(walletShare[0].percent, 0)}`}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border">
          <p className="text-sm font-medium text-gray-500">Income</p>
          <p className="mt-2 text-2xl font-bold text-green-600">
            {formatCurrency(income)}
          </p>
          <p className="mt-2 text-sm text-gray-500">This month</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border">
          <p className="text-sm font-medium text-gray-500">Spending</p>
          <p className="mt-2 text-2xl font-bold text-red-600">
            {formatCurrency(expense)}
          </p>
          <p className="mt-2 text-sm text-gray-500">
            {income > 0 ? `${formatPercent(rate)} saved` : "No income yet"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Net position */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-lg font-semibold text-gray-900">Month to date</h2>
          <div className="mt-4 space-y-3">
            <div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Saved</span>
                <span
                  className={`font-medium ${net >= 0 ? "text-green-600" : "text-red-600"}`}
                >
                  {formatCurrency(net)}
                </span>
              </div>
              <div className="mt-1.5 h-2 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className={`h-full rounded-full ${net >= 0 ? "bg-green-500" : "bg-red-500"}`}
                  style={{
                    width: `${income > 0 ? Math.min(100, Math.abs(rate)) : 0}%`,
                  }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Spent of income</span>
                <span className="font-medium text-gray-900">
                  {income > 0 ? formatPercent(100 - rate) : "—"}
                </span>
              </div>
              <div className="mt-1.5 h-2 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-red-500"
                  style={{
                    width: `${income > 0 ? Math.min(100, 100 - rate) : 0}%`,
                  }}
                />
              </div>
            </div>
          </div>
          <dl className="mt-5 pt-4 border-t space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Savings rate</dt>
              <dd className="font-medium text-gray-900">
                {income > 0 ? formatPercent(rate) : "—"}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Average daily spend</dt>
              <dd className="font-medium text-gray-900">
                {formatCurrency(expense / Math.max(1, new Date().getDate()))}
              </dd>
            </div>
          </dl>
        </div>

        {/* Top spending categories */}
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="px-6 py-4 border-b">
            <h2 className="text-lg font-semibold text-gray-900">
              Where the money went
            </h2>
            <p className="text-sm text-gray-500">
              Top {spendBreakdown.length} spending{" "}
              {spendBreakdown.length === 1 ? "category" : "categories"} this
              month
            </p>
          </div>
          <div className="p-6 space-y-4">
            {spendBreakdown.length === 0 ? (
              <p className="text-sm text-gray-500">
                No spending recorded for this month.
              </p>
            ) : (
              spendBreakdown.map((slice) => (
                <div key={slice.name}>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-700 font-medium">
                      {slice.name}
                    </span>
                    <span className="text-gray-500">
                      {formatCurrency(slice.amount)}
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-red-400"
                      style={{ width: `${slice.percent}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-400">
                    {formatPercent(slice.percent)} of spending
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Wallet distribution */}
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="px-6 py-4 border-b">
            <h2 className="text-lg font-semibold text-gray-900">
              Wallet distribution
            </h2>
            <p className="text-sm text-gray-500">
              Share of net worth by account
            </p>
          </div>
          <div className="p-6 space-y-4">
            {walletShare.length === 0 ? (
              <p className="text-sm text-gray-500">
                {wallets.length === 0
                  ? "No wallets yet."
                  : "No wallet holds a positive balance."}
              </p>
            ) : (
              <>
                <div className="flex h-2.5 rounded-full overflow-hidden bg-gray-100">
                  {walletShare.map((s, i) => (
                    <div
                      key={s.name}
                      className={`h-full ${chartColor(i)}`}
                      style={{ width: `${s.percent}%` }}
                      title={`${s.name} ${formatCurrency(s.amount)} · ${formatPercent(s.percent)}`}
                    />
                  ))}
                </div>
                <div className="mt-4 space-y-3">
                  {walletShare.map((slice, i) => (
                    <div key={slice.name}>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-700 font-medium inline-flex items-center gap-2">
                          <span
                            className={`w-2.5 h-2.5 rounded-sm ${chartColor(i)}`}
                          />
                          {slice.name}
                        </span>
                        <span className="text-gray-500">
                          {formatCurrency(slice.amount)}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-gray-400">
                        {formatPercent(slice.percent)} of net worth
                      </p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Recent activity */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">
            Recent activity
          </h2>
          <p className="text-sm text-gray-500">
            Your {recent.length} most recent{" "}
            {recent.length === 1 ? "entry" : "entries"}
          </p>
        </div>
        {recent.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <p className="text-sm text-gray-500">
              Nothing recorded yet. Add a transaction to see it here.
            </p>
            {unusedCategories.length === 0 && (
              <p className="mt-1 text-xs text-gray-400">
                {categories.length} categories ready to use
              </p>
            )}
          </div>
        ) : (
          <div className="divide-y">
            {recent.map((t) => {
              const isIncome = t.category?.type === "INCOME";
              return (
                <div
                  key={t.id}
                  className="px-6 py-4 flex items-center justify-between"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 truncate">
                      {t.description || t.category?.name}
                    </p>
                    <p className="text-sm text-gray-500">
                      {formatDateShort(t.transactionDate)} · {t.category?.name}{" "}
                      · {t.wallet?.name}
                    </p>
                  </div>
                  <p
                    className={`ml-4 font-semibold whitespace-nowrap ${
                      isIncome ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {isIncome ? "+" : "−"}
                    {formatCurrency(Number(t.amount))}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
