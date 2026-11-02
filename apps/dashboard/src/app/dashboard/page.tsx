"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { transactionsApi, walletsApi } from "@/lib/api";
import {
  formatCurrency,
  formatDateShort,
  formatPercent,
  savingsRate,
  topCategories,
} from "@/lib/utils";
import {
  currentMonth,
  overviewPeriod,
  type FinancialSummary,
} from "@/lib/overview";
import FinanceIcon from "@/components/FinanceIcon";
import MonthPicker from "@/components/MonthPicker";

type Wallet = {
  id: string;
  name: string;
  balance: number | string;
  type: string;
};
type Transaction = {
  id: string;
  amount: number | string;
  description?: string;
  transactionDate: string;
  category?: { name: string; type: string };
  wallet?: { name: string };
};
const SPENDING_COLORS = [
  "#245b45",
  "#87ad76",
  "#d6b86c",
  "#cc896c",
  "#9a97b4",
  "#ccd3ca",
];

export default function DashboardPage() {
  const [month, setMonth] = useState(currentMonth);
  const [allTime, setAllTime] = useState(false);
  const [revision, setRevision] = useState(0);
  const [data, setData] = useState<{
    summary: FinancialSummary;
    wallets: Wallet[];
    recent: Transaction[];
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const period = overviewPeriod(month, allTime);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError("");
    const range = overviewPeriod(month, allTime);
    Promise.all([
      transactionsApi.summary(range.params),
      walletsApi.list(),
      transactionsApi.list({ ...range.params, limit: "6" }),
    ])
      .then(([summary, wallets, recent]) => {
        if (!cancelled) setData({ summary, wallets, recent });
      })
      .catch(() => {
        if (!cancelled)
          setError("We couldn’t load your finances. Please try again.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [month, allTime, revision]);

  const income = data?.summary.totalIncome ?? 0;
  const expense = data?.summary.totalExpense ?? 0;
  const net = income - expense;
  const balance =
    data?.wallets.reduce((sum, wallet) => sum + Number(wallet.balance), 0) ?? 0;
  const rate = savingsRate(income, expense);
  const categories = topCategories(data?.summary.byCategory, 5);
  const remainingExpense = Math.max(
    0,
    expense - categories.reduce((sum, item) => sum + item.amount, 0),
  );
  const slices = [
    ...categories,
    ...(remainingExpense > 0
      ? [
          {
            name: "Other categories",
            amount: remainingExpense,
            percent: (remainingExpense / expense) * 100,
          },
        ]
      : []),
  ];
  let progress = 0;
  const donut = slices
    .map((slice, index) => {
      const start = progress;
      progress += slice.percent;
      return `${SPENDING_COLORS[index]} ${start}% ${progress}%`;
    })
    .join(", ");
  const flowMax = Math.max(income, expense, 1);
  const negativeWallets =
    data?.wallets.filter((wallet) => Number(wallet.balance) < 0).length ?? 0;
  const transactionLink = `/dashboard/transactions?${new URLSearchParams(period.params)}`;

  return (
    <div className="overview-page">
      <div className="overview-heading">
        <div>
          <p className="eyebrow">THE BIG PICTURE</p>
          <h1>
            Financial overview<span>.</span>
          </h1>
          <p>Your money, with a little more perspective.</p>
        </div>
        <Link href="/dashboard/transactions/new" className="primary-action">
          <FinanceIcon name="plus" />
          Add transaction
        </Link>
      </div>

      <div className="period-toolbar">
        <div className="period-controls">
          <div
            className="period-toggle"
            role="group"
            aria-label="Overview period"
          >
            <button aria-pressed={!allTime} onClick={() => setAllTime(false)}>
              Monthly
            </button>
            <button aria-pressed={allTime} onClick={() => setAllTime(true)}>
              All time
            </button>
          </div>
          <MonthPicker
            value={month}
            onChange={(value) => {
              setMonth(value);
              setAllTime(false);
            }}
          />
        </div>
        <div className="period-context">
          <span>{period.label}</span>
          <button
            className="refresh-button"
            onClick={() => setRevision((value) => value + 1)}
            disabled={isLoading}
            aria-label="Refresh finances"
          >
            <FinanceIcon
              name="refresh"
              className={isLoading ? "animate-spin" : ""}
            />
          </button>
        </div>
      </div>

      {error ? (
        <div className="overview-error" role="alert">
          <p>{error}</p>
          <button onClick={() => setRevision((value) => value + 1)}>
            Try again
          </button>
        </div>
      ) : isLoading ? (
        <div
          className="overview-skeleton"
          role="status"
          aria-label="Loading financial overview"
        >
          <div />
          <div />
          <div />
          <div />
          <span>Gathering your financial picture…</span>
        </div>
      ) : (
        data && (
          <>
            {/* Headline figures */}
            <section className="metric-grid" aria-label="Financial summary">
              <article className="metric-card balance-card">
                <div className="metric-top">
                  <span>Total balance</span>
                  <FinanceIcon name="wallet" />
                </div>
                <p className="metric-value">{formatCurrency(balance)}</p>
                <div className="metric-foot">
                  <span className="balance-dot" />
                  {data.wallets.length}{" "}
                  {data.wallets.length === 1 ? "wallet" : "wallets"} · current
                  balance
                </div>
              </article>
              <article className="metric-card">
                <div className="metric-top">
                  <span>Money in</span>
                  <span className="metric-icon income-icon">
                    <FinanceIcon name="down" />
                  </span>
                </div>
                <p className="metric-value income-text">
                  {formatCurrency(income)}
                </p>
                <div className="metric-foot">Income · {period.label}</div>
              </article>
              <article className="metric-card">
                <div className="metric-top">
                  <span>Money out</span>
                  <span className="metric-icon expense-icon">
                    <FinanceIcon name="up" />
                  </span>
                </div>
                <p className="metric-value expense-text">
                  {formatCurrency(expense)}
                </p>
                <div className="metric-foot">Spending · {period.label}</div>
              </article>
              <article className="metric-card">
                <div className="metric-top">
                  <span>Net cash flow</span>
                  <span className="metric-icon">
                    <FinanceIcon name="transactions" />
                  </span>
                </div>
                <p className={`metric-value ${net < 0 ? "expense-text" : ""}`}>
                  {net > 0 ? "+" : ""}
                  {formatCurrency(net)}
                </p>
                <div className="metric-foot">Income minus spending</div>
              </article>
            </section>

            <div className="insight-banner">
              <span className="insight-symbol">
                <FinanceIcon name="spark" />
              </span>
              <div>
                <strong>
                  {income > 0
                    ? net >= 0
                      ? `You kept ${formatPercent(rate)} of your income.`
                      : "Spending exceeded your income."
                    : expense > 0
                      ? "Spending recorded. No income in this period."
                      : "A fresh page for your finances."}
                </strong>
                <p>
                  {income > 0
                    ? net >= 0
                      ? `${formatCurrency(net)} left after spending in ${period.label.toLowerCase()}.`
                      : `${formatCurrency(Math.abs(net))} more went out than came in during this period.`
                    : "Totals use transaction dates, even when you upload a receipt later."}
                </p>
              </div>
              {!allTime && (
                <button onClick={() => setAllTime(true)}>
                  See all time <FinanceIcon name="arrow" />
                </button>
              )}
            </div>

            <div className="overview-chart-grid">
              {/* Net position */}
              <section className="overview-panel flow-panel">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">IN & OUT</p>
                    <h2>Make sense of your cash flow</h2>
                  </div>
                  <span className="subtle-badge">{period.label}</span>
                </div>
                <p className="panel-description">
                  What you earned, what you spent, and what stayed with you.
                </p>
                <div
                  className="flow-chart"
                  role="img"
                  aria-label={`Income ${formatCurrency(income)}, spending ${formatCurrency(expense)}`}
                >
                  <div className="flow-row">
                    <div>
                      <span>
                        <i className="legend-dot income-dot" />
                        Income
                      </span>
                      <strong>{formatCurrency(income)}</strong>
                    </div>
                    <div className="flow-track">
                      <div
                        className="flow-bar income-bar"
                        style={{ width: `${(income / flowMax) * 100}%` }}
                      />
                    </div>
                  </div>
                  <div className="flow-row">
                    <div>
                      <span>
                        <i className="legend-dot expense-dot" />
                        Spending
                      </span>
                      <strong>{formatCurrency(expense)}</strong>
                    </div>
                    <div className="flow-track">
                      <div
                        className="flow-bar expense-bar"
                        style={{ width: `${(expense / flowMax) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
                <div className="flow-bottom">
                  <div>
                    <span>Income retained</span>
                    <strong>{income > 0 ? formatPercent(rate) : "—"}</strong>
                  </div>
                  <p>
                    {income > 0
                      ? `For every Rp 100 earned, you spent Rp ${Math.round((expense / income) * 100).toLocaleString("id-ID")}.`
                      : "Record income to see how much you retain."}
                  </p>
                </div>
              </section>

              {/* Top spending categories */}
              <section className="overview-panel spending-panel">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">SPENDING BREAKDOWN</p>
                    <h2>Where your money goes</h2>
                  </div>
                  <Link
                    href="/dashboard/categories"
                    className="icon-link"
                    aria-label="View categories"
                  >
                    <FinanceIcon name="arrow" />
                  </Link>
                </div>
                {slices.length ? (
                  <>
                    <div
                      className="spending-donut"
                      role="img"
                      aria-label={slices
                        .map(
                          (slice) =>
                            `${slice.name}: ${formatPercent(slice.percent)}`,
                        )
                        .join(", ")}
                      style={{ background: `conic-gradient(${donut})` }}
                    >
                      <div>
                        <span>Total spent</span>
                        <strong>{formatCurrency(expense)}</strong>
                      </div>
                    </div>
                    <div className="spending-legend">
                      {slices.map((slice, index) => (
                        <div key={slice.name}>
                          <span>
                            <i
                              className="legend-dot"
                              style={{ background: SPENDING_COLORS[index] }}
                            />
                            {slice.name}
                          </span>
                          <strong>{formatCurrency(slice.amount)}</strong>
                          <span>{formatPercent(slice.percent, 0)}</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="chart-empty">
                    <span className="empty-ring">
                      <FinanceIcon name="categories" />
                    </span>
                    <strong>No spending to break down</strong>
                    <p>Add an expense or choose another period.</p>
                  </div>
                )}
              </section>
            </div>

            <div className="overview-bottom-grid">
              {/* Recent activity */}
              <section className="overview-panel activity-panel">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">THE DETAILS</p>
                    <h2>Recent activity</h2>
                  </div>
                  <Link href={transactionLink} className="text-action">
                    View all <FinanceIcon name="arrow" />
                  </Link>
                </div>
                <p className="panel-description">
                  Latest entries in {period.label.toLowerCase()}, by transaction
                  date.
                </p>
                {!data.recent.length ? (
                  <div className="activity-empty">
                    <FinanceIcon name="transactions" />
                    <strong>No activity in this period</strong>
                    <p>
                      Your earlier transactions are still available under All
                      time.
                    </p>
                    <button
                      className="text-action"
                      onClick={() => setAllTime(true)}
                    >
                      Show all-time activity <FinanceIcon name="arrow" />
                    </button>
                  </div>
                ) : (
                  <div className="activity-list">
                    {data.recent.map((transaction) => {
                      const incoming = transaction.category?.type === "INCOME";
                      return (
                        <div className="activity-row" key={transaction.id}>
                          <span
                            className={`activity-icon ${incoming ? "income-icon" : "expense-icon"}`}
                          >
                            <FinanceIcon name={incoming ? "down" : "up"} />
                          </span>
                          <div className="activity-description">
                            <strong>
                              {transaction.description ||
                                transaction.category?.name ||
                                "Transaction"}
                            </strong>
                            <span>
                              {transaction.wallet?.name ?? "Wallet"}{" "}
                              <span aria-hidden="true">·</span>{" "}
                              {formatDateShort(transaction.transactionDate)}
                            </span>
                          </div>
                          <div className="activity-amount">
                            <strong className={incoming ? "income-text" : ""}>
                              {incoming ? "+" : "−"}
                              {formatCurrency(Number(transaction.amount))}
                            </strong>
                            <span>{transaction.category?.name}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* Wallet distribution */}
              <section className="overview-panel wallets-panel">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">YOUR ACCOUNTS</p>
                    <h2>Wallet balances</h2>
                  </div>
                  <Link
                    href="/dashboard/wallets"
                    className="icon-link"
                    aria-label="Manage wallets"
                  >
                    <FinanceIcon name="arrow" />
                  </Link>
                </div>
                <p className="panel-description">
                  Current balances, across every period.
                </p>
                {!data.wallets.length ? (
                  <div className="activity-empty">
                    <FinanceIcon name="wallet" />
                    <strong>A home for your money</strong>
                    <p>Add your first wallet to start tracking.</p>
                    <Link href="/dashboard/wallets" className="text-action">
                      Add a wallet <FinanceIcon name="arrow" />
                    </Link>
                  </div>
                ) : (
                  <>
                    <div className="wallet-list">
                      {data.wallets.map((wallet, index) => (
                        <div key={wallet.id}>
                          <span
                            className="wallet-monogram"
                            style={{
                              background: ["#e8eedb", "#f4e8d8", "#e8e7f1"][
                                index % 3
                              ],
                            }}
                          >
                            {wallet.name.slice(0, 1).toUpperCase()}
                          </span>
                          <span>
                            <strong>{wallet.name}</strong>
                            <small>
                              {wallet.type.replace(/_/g, " ").toLowerCase()}
                            </small>
                          </span>
                          <strong
                            className={
                              Number(wallet.balance) < 0 ? "expense-text" : ""
                            }
                          >
                            {formatCurrency(Number(wallet.balance))}
                          </strong>
                        </div>
                      ))}
                    </div>
                    <div className="wallet-note">
                      <FinanceIcon name="spark" />
                      <span>
                        {negativeWallets
                          ? `${negativeWallets} ${negativeWallets === 1 ? "wallet has a negative balance" : "wallets have negative balances"}. Review your account activity.`
                          : "Balances include your starting amounts and all recorded transactions."}
                      </span>
                    </div>
                  </>
                )}
              </section>
            </div>
          </>
        )
      )}
    </div>
  );
}
