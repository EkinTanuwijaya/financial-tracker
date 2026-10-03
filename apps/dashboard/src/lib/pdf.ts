import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { formatPercent, savingsRate } from "./utils";

export interface ReportData {
  periodLabel: string;
  dateRangeLabel: string;
  totalIncome: number;
  totalExpense: number;
  byCategory: Record<string, { income: number; expense: number }>;
  byWallet: Record<string, { income: number; expense: number }>;
}

// jsPDF's default fonts only cover Latin-1; "Rp" and digits are safe,
// so format IDR without relying on the "id-ID" currency glyph set.
function idr(amount: number): string {
  const grouped = Math.round(Math.abs(amount))
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const sign = amount < 0 ? "-" : "";
  return `${sign}Rp ${grouped}`;
}

export function exportReportPdf(data: ReportData): void {
  const doc = new jsPDF();
  const net = data.totalIncome - data.totalExpense;
  const rate = savingsRate(data.totalIncome, data.totalExpense);

  // Header
  doc.setFontSize(20);
  doc.setTextColor(17, 24, 39);
  doc.text("Financial Report", 14, 22);

  doc.setFontSize(11);
  doc.setTextColor(107, 114, 128);
  doc.text(`${data.periodLabel}  -  ${data.dateRangeLabel}`, 14, 30);
  doc.text(`Generated: ${new Date().toLocaleString("id-ID")}`, 14, 36);

  doc.setDrawColor(209, 213, 219);
  doc.line(14, 40, 196, 40);

  // Summary figures
  const colX = [14, 62, 110, 158];
  const labels = ["INCOME", "EXPENSE", "NET", "SAVINGS RATE"];
  const values = [
    idr(data.totalIncome),
    idr(data.totalExpense),
    idr(net),
    data.totalIncome > 0 ? formatPercent(rate) : "-",
  ];
  const valueColors: [number, number, number][] = [
    [16, 185, 129],
    [239, 68, 68],
    [17, 24, 39],
    [16, 185, 129],
  ];

  doc.setFontSize(9);
  labels.forEach((label, i) => {
    doc.setTextColor(107, 114, 128);
    doc.text(label, colX[i], 50);
    doc.setFontSize(14);
    doc.setTextColor(
      valueColors[i][0],
      valueColors[i][1],
      valueColors[i][2],
    );
    doc.text(values[i], colX[i], 59);
    doc.setFontSize(9);
  });

  let finalY = 72;

  // By Category
  const categoryRows = Object.entries(data.byCategory)
    .map(([name, d]) => ({
      name,
      income: d.income,
      expense: d.expense,
      net: d.income - d.expense,
    }))
    .sort((a, b) => b.expense - a.expense);

  if (categoryRows.length > 0) {
    doc.setFontSize(13);
    doc.setTextColor(17, 24, 39);
    doc.text("By Category", 14, finalY);
    autoTable(doc, {
      startY: finalY + 4,
      head: [["Category", "Income", "Expense", "Net"]],
      body: categoryRows.map((r) => [
        r.name,
        idr(r.income),
        idr(r.expense),
        idr(r.net),
      ]),
      foot: [["Total", idr(data.totalIncome), idr(data.totalExpense), idr(net)]],
      styles: { cellPadding: 3 },
      headStyles: { fillColor: [37, 99, 235] },
      footStyles: {
        fillColor: [243, 244, 246],
        textColor: [17, 24, 39],
        fontStyle: "bold",
      },
    });
    finalY = (doc as unknown as { lastAutoTable: { finalY: number } })
      .lastAutoTable.finalY + 14;
  }

  // By Wallet
  const walletRows = Object.entries(data.byWallet)
    .map(([name, d]) => ({
      name,
      income: d.income,
      expense: d.expense,
      net: d.income - d.expense,
    }))
    .sort((a, b) => b.expense - a.expense);

  if (walletRows.length > 0) {
    if (finalY > 235) {
      doc.addPage();
      finalY = 20;
    }
    doc.setFontSize(13);
    doc.setTextColor(17, 24, 39);
    doc.text("By Wallet", 14, finalY);
    autoTable(doc, {
      startY: finalY + 4,
      head: [["Wallet", "Income", "Expense", "Net"]],
      body: walletRows.map((r) => [
        r.name,
        idr(r.income),
        idr(r.expense),
        idr(r.net),
      ]),
      styles: { cellPadding: 3 },
      headStyles: { fillColor: [37, 99, 235] },
    });
  }

  doc.save(
    `financial-report-${data.periodLabel.toLowerCase().replace(/\s+/g, "-")}.pdf`,
  );
}
