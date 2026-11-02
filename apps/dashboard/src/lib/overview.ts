export interface FinancialSummary {
  totalIncome: number;
  totalExpense: number;
  byCategory: Record<string, { income: number; expense: number }>;
  byWallet: Record<string, { income: number; expense: number }>;
}

export function currentMonth(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function overviewPeriod(month: string, allTime: boolean) {
  if (allTime)
    return { label: "All time", params: {} as Record<string, string> };
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))
    throw new Error("Choose a valid month.");
  const start = new Date(`${month}-01T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);
  end.setUTCMilliseconds(-1);
  return {
    label: new Intl.DateTimeFormat("en", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(start),
    params: {
      startDate: start.toISOString(),
      endDate: end.toISOString(),
    } as Record<string, string>,
  };
}
