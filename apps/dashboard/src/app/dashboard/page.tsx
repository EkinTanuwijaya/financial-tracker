"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { transactionsApi, walletsApi, categoriesApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function DashboardPage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<any>(null);
  const [wallets, setWallets] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [summaryData, walletsData, categoriesData] = await Promise.all([
          transactionsApi.summary(),
          walletsApi.list(),
          categoriesApi.list(),
        ]);
        setSummary(summaryData);
        setWallets(walletsData);
        setCategories(categoriesData);
      } catch (error) {
        console.error("Failed to load dashboard data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500">
            Welcome back, {user?.name || user?.email}!
          </p>
        </div>
        <div className="flex space-x-3">
          <Link
            href="/dashboard/transactions/new"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            New Transaction
          </Link>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-sm p-6 border">
          <h3 className="text-sm font-medium text-gray-500">Total Income</h3>
          <p className="mt-2 text-3xl font-bold text-green-600">
            {summary ? formatCurrency(summary.totalIncome) : "Rp0"}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6 border">
          <h3 className="text-sm font-medium text-gray-500">Total Expense</h3>
          <p className="mt-2 text-3xl font-bold text-red-600">
            {summary ? formatCurrency(summary.totalExpense) : "Rp0"}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6 border">
          <h3 className="text-sm font-medium text-gray-500">Balance</h3>
          <p className="mt-2 text-3xl font-bold text-blue-600">
            {summary
              ? formatCurrency(summary.totalIncome - summary.totalExpense)
              : "Rp0"}
          </p>
        </div>
      </div>

      {/* Wallets */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="px-6 py-4 border-b flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-900">Wallets</h2>
          <Link
            href="/dashboard/wallets"
            className="text-sm text-blue-600 hover:text-blue-500"
          >
            View all
          </Link>
        </div>
        <div className="divide-y">
          {wallets.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500">
              No wallets yet.{" "}
              <Link href="/dashboard/wallets" className="text-blue-600">
                Create one
              </Link>
            </div>
          ) : (
            wallets.slice(0, 5).map((wallet) => (
              <div
                key={wallet.id}
                className="px-6 py-4 flex justify-between items-center"
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
                    <p className="font-medium text-gray-900">{wallet.name}</p>
                    <p className="text-sm text-gray-500">
                      {wallet.type} • {wallet.currency}
                    </p>
                  </div>
                </div>
                <p className="font-semibold text-gray-900">
                  {formatCurrency(Number(wallet.balance))}
                </p>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link
          href="/dashboard/transactions"
          className="bg-white rounded-lg shadow-sm p-6 border hover:shadow-md transition-shadow"
        >
          <h3 className="text-lg font-semibold text-gray-900">Transactions</h3>
          <p className="mt-2 text-gray-500">
            View and manage your transactions
          </p>
        </Link>
        <Link
          href="/dashboard/wallets"
          className="bg-white rounded-lg shadow-sm p-6 border hover:shadow-md transition-shadow"
        >
          <h3 className="text-lg font-semibold text-gray-900">Wallets</h3>
          <p className="mt-2 text-gray-500">Manage your wallets and accounts</p>
        </Link>
        <Link
          href="/dashboard/categories"
          className="bg-white rounded-lg shadow-sm p-6 border hover:shadow-md transition-shadow"
        >
          <h3 className="text-lg font-semibold text-gray-900">Categories</h3>
          <p className="mt-2 text-gray-500">
            Organize your spending categories
          </p>
        </Link>
        <Link
          href="/dashboard/reports"
          className="bg-white rounded-lg shadow-sm p-6 border hover:shadow-md transition-shadow"
        >
          <h3 className="text-lg font-semibold text-gray-900">Reports</h3>
          <p className="mt-2 text-gray-500">
            View spending reports and analytics
          </p>
        </Link>
      </div>
    </div>
  );
}
