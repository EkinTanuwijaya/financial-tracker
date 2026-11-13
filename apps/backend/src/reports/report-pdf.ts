import {
  createReportPdf,
  type ReportData,
} from "../../../../packages/shared/report-pdf";

export type ReportSummary = Omit<ReportData, "periodLabel" | "dateRangeLabel">;

export interface ReportPeriodInfo {
  label: string;
  dateRangeLabel: string;
}

export function generateReportPdf(
  summary: ReportSummary,
  period: ReportPeriodInfo,
  generatedAt = new Date(),
): Buffer {
  const doc = createReportPdf(
    {
      ...summary,
      periodLabel: period.label,
      dateRangeLabel: period.dateRangeLabel,
    },
    generatedAt,
  );
  return Buffer.from(doc.output("arraybuffer"));
}
