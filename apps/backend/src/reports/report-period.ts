// Report periods for the Telegram /report command.
// Boundaries are UTC and the week starts Monday, matching
// the bot's other date handling (see parseRelativeDate).

export type ReportPeriod = "week" | "month" | "year" | "all";

export interface ReportRange {
  period: ReportPeriod;
  label: string;
  dateRangeLabel: string;
  /** Inclusive start; undefined for "all". */
  startDate?: Date;
  /** Inclusive end (end of day); undefined for "all". */
  endDate?: Date;
}

export const REPORT_USAGE = [
  "Usage: /report [week|month|year|all]",
  "",
  "Sends a PDF report for the chosen period.",
  "Default: month.",
].join("\n");

export function parseReportPeriod(input: string): ReportPeriod | null {
  const lower = input.trim().toLowerCase();
  if (!lower) return "month";

  switch (lower) {
    case "week":
    case "minggu":
    case "minggu ini":
    case "this week":
      return "week";
    case "month":
    case "bulan":
    case "bulan ini":
    case "this month":
      return "month";
    case "year":
    case "tahun":
    case "tahun ini":
    case "this year":
      return "year";
    case "all":
    case "all time":
    case "semua":
      return "all";
    default:
      return null;
  }
}

const SHORT_DATE = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

const LONG_MONTH = new Intl.DateTimeFormat("id-ID", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function endOfDayUtc(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999),
  );
}

export function getReportRange(period: ReportPeriod, now = new Date()): ReportRange {
  switch (period) {
    case "week": {
      const mondayOffset = (now.getUTCDay() + 6) % 7;
      const start = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - mondayOffset),
      );
      return {
        period,
        label: "This week",
        dateRangeLabel: `${SHORT_DATE.format(start)} - ${SHORT_DATE.format(now)} ${now.getUTCFullYear()}`,
        startDate: start,
        endDate: endOfDayUtc(now),
      };
    }
    case "year": {
      const start = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
      return {
        period,
        label: "This year",
        dateRangeLabel: String(now.getUTCFullYear()),
        startDate: start,
        endDate: endOfDayUtc(now),
      };
    }
    case "all":
      return { period, label: "All time", dateRangeLabel: "All time" };
    case "month":
    default: {
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      return {
        period,
        label: "This month",
        dateRangeLabel: LONG_MONTH.format(now),
        startDate: start,
        endDate: endOfDayUtc(now),
      };
    }
  }
}
