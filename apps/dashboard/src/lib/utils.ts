// Single currency app: Rupiah. IDR has no minor unit, so every amount is a
// whole number and "." is always the thousands separator.
export const CURRENCY_CODE = "IDR";
export const CURRENCY_SYMBOL = "Rp";
export const CURRENCY_LABEL = "Indonesian Rupiah";

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: CURRENCY_CODE,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatNumberForInput(amount: number): string {
  if (!amount) return "0";
  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(amount));
}

// IDR has no decimals, so any "." or "," the user types is grouping, never a
// decimal point. Stripping every non-digit keeps "100.000" meaning 100000.
// A single leading "-" is kept so credit cards can start overdrawn.
export function parseAmountInput(raw: string): number {
  const cleaned = raw.replace(/[^\d-]/g, "").replace(/(?!^)-/g, "");
  const digits = cleaned.replace(/-/g, "");
  if (!digits) return 0;
  const value = parseInt(digits, 10);
  if (!Number.isFinite(value)) return 0;
  return cleaned.startsWith("-") ? -value : value;
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString("id-ID", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function formatDateShort(date: string | Date): string {
  return new Date(date).toLocaleDateString("id-ID", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ");
}

export function formatPercent(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return "0%";
  return `${value.toFixed(digits).replace(/\.0+$/, "")}%`;
}

export function shareOf(part: number, whole: number): number {
  if (!whole) return 0;
  return (part / whole) * 100;
}

export function savingsRate(income: number, expense: number): number {
  if (!income) return 0;
  return shareOf(income - expense, income);
}

export function formatCompact(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";
  if (abs >= 1_000_000_000)
    return `${sign}Rp ${(abs / 1_000_000_000).toFixed(1)}M`;
  if (abs >= 1_000_000) return `${sign}Rp ${(abs / 1_000_000).toFixed(1)}jt`;
  if (abs >= 1_000) return `${sign}Rp ${(abs / 1_000).toFixed(1)}rb`;
  return formatCurrency(amount);
}

export interface CategorySlice {
  name: string;
  amount: number;
  percent: number;
}

export function topCategories(
  byCategory: Record<string, { income: number; expense: number }> | undefined,
  limit = 5,
): CategorySlice[] {
  if (!byCategory) return [];
  return Object.entries(byCategory)
    .map(([name, data]) => ({ name, amount: data.expense }))
    .filter((c) => c.amount > 0)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit)
    .map((c) => ({
      ...c,
      percent: shareOf(c.amount, totalExpense(byCategory)),
    }));
}

export function walletSlices(
  wallets: { name: string; balance: number | string }[],
): CategorySlice[] {
  const positive = wallets.map((w) => ({
    name: w.name,
    amount: Number(w.balance),
  }));
  const total = positive.reduce((sum, w) => sum + w.amount, 0);
  return positive
    .filter((w) => w.amount > 0)
    .sort((a, b) => b.amount - a.amount)
    .map((w) => ({ ...w, percent: shareOf(w.amount, total) }));
}

export function totalExpense(
  byCategory: Record<string, { income: number; expense: number }>,
): number {
  return Object.values(byCategory).reduce((sum, c) => sum + c.expense, 0);
}

export const CHART_COLORS = [
  "bg-blue-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-violet-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-lime-500",
  "bg-indigo-500",
  "bg-orange-500",
  "bg-teal-500",
  "bg-fuchsia-500",
  "bg-sky-500",
] as const;

export const CHART_SOFT_COLORS = [
  "bg-blue-100 text-blue-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-violet-100 text-violet-700",
  "bg-rose-100 text-rose-700",
  "bg-cyan-100 text-cyan-700",
  "bg-lime-100 text-lime-700",
  "bg-indigo-100 text-indigo-700",
  "bg-orange-100 text-orange-700",
  "bg-teal-100 text-teal-700",
  "bg-fuchsia-100 text-fuchsia-700",
  "bg-sky-100 text-sky-700",
] as const;

export function chartColor(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length];
}

export function chartSoftColor(index: number): string {
  return CHART_SOFT_COLORS[index % CHART_SOFT_COLORS.length];
}
