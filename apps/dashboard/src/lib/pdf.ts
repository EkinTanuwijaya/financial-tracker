import {
  createReportPdf,
  type ReportData,
} from "../../../../packages/shared/report-pdf";

export { createReportPdf };
export type { ReportData };

export function exportReportPdf(data: ReportData): void {
  createReportPdf(data).save(
    `financial-report-${data.periodLabel.toLowerCase().replace(/\s+/g, "-")}.pdf`,
  );
}
