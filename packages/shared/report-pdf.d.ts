import type { jsPDF } from "jspdf";

export interface ReportData {
  periodLabel: string;
  dateRangeLabel: string;
  totalIncome: number;
  totalExpense: number;
  byCategory: Record<string, { income: number; expense: number }>;
  byWallet: Record<string, { income: number; expense: number }>;
}

export function createReportPdf(data: ReportData, generatedAt?: Date): jsPDF;
