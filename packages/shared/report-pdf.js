const { jsPDF } = require("jspdf");
const { autoTable } = require("jspdf-autotable");
function formatPercent(value, digits = 1) {
  if (!Number.isFinite(value)) return "0%";
  return `${value.toFixed(digits).replace(/\.0+$/, "")}%`;
}
function savingsRate(income, expense) {
  return income ? ((income - expense) / income) * 100 : 0;
}
// jsPDF's default fonts only cover Latin-1; "Rp" and digits are safe,
// so format IDR without relying on the "id-ID" currency glyph set.
function idr(amount) {
  const grouped = Math.round(Math.abs(amount))
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${amount < 0 ? "-" : ""}Rp ${grouped}`;
}
const INK = [32, 51, 43];
const GREEN = [36, 91, 69];
const MUTED = [112, 124, 107];
const CLAY = [177, 110, 79];
const PAPER = [245, 247, 240];
function createReportPdf(data, generatedAt = new Date()) {
  const doc = new jsPDF();
  const net = data.totalIncome - data.totalExpense;
  const rate = savingsRate(data.totalIncome, data.totalExpense);
  const categoryRows = Object.entries(data.byCategory)
    .map(([name, value]) => ({ name, ...value }))
    .sort((a, b) => b.expense - a.expense || b.income - a.income);
  const walletRows = Object.entries(data.byWallet)
    .map(([name, value]) => ({ name, ...value }))
    .sort((a, b) => b.expense - a.expense || b.income - a.income);
  const spending = categoryRows.filter((row) => row.expense > 0);
  const largest = spending[0];
  const spentShare =
    data.totalIncome > 0 ? (data.totalExpense / data.totalIncome) * 100 : null;
  const period =
    data.periodLabel === data.dateRangeLabel
      ? data.periodLabel
      : `${data.periodLabel} - ${data.dateRangeLabel}`;
  const generated = generatedAt.toLocaleString("en-GB", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  doc.setProperties({
    title: `Financial report - ${data.dateRangeLabel}`,
    subject: period,
    creator: "Finance Tracker",
  });
  function text(value, x, y, size = 10, color = INK, bold = false) {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(...color);
    doc.text(value, x, y);
  }
  function fit(value, x, y, width, size = 15, color = INK) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(size);
    while (doc.getTextWidth(value) > width && size > 7)
      doc.setFontSize((size -= 0.5));
    doc.setTextColor(...color);
    doc.text(value, x, y);
  }
  function wrapped(value, x, y, width, size = 9, color = MUTED) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(size);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(value, width);
    doc.text(lines, x, y);
    return y + lines.length * size * 0.4;
  }
  // Header
  doc.setFillColor(...GREEN);
  doc.roundedRect(14, 14, 182, 40, 3, 3, "F");
  text("FINANCE TRACKER / YOUR FINANCIAL PICTURE", 21, 24, 8, [210, 231, 191]);
  text("Financial report", 21, 36, 23, [255, 255, 255], true);
  text(period, 21, 46, 9, [220, 233, 219]);
  text(`Generated ${generated} WIB`, 14, 60, 7, MUTED);
  // Summary figures
  const figures = [
    {
      label: "MONEY IN",
      value: idr(data.totalIncome),
      note: "Recorded income",
      color: GREEN,
    },
    {
      label: "MONEY OUT",
      value: idr(data.totalExpense),
      note: "Recorded spending",
      color: CLAY,
    },
    {
      label: "NET CASH FLOW",
      value: idr(net),
      note: "Income minus spending",
      color: net < 0 ? CLAY : INK,
    },
    {
      label: "INCOME RETAINED",
      value: data.totalIncome > 0 ? formatPercent(rate) : "N/A",
      note: "Net / income",
      color: net < 0 ? CLAY : GREEN,
    },
  ];
  figures.forEach((figure, index) => {
    const x = 14 + index * 47;
    doc.setFillColor(...PAPER);
    doc.roundedRect(x, 66, 41, 30, 2, 2, "F");
    text(figure.label, x + 3, 73, 6.5, MUTED, true);
    fit(figure.value, x + 3, 83, 35, 14, figure.color);
    text(figure.note, x + 3, 91, 6, MUTED);
  });
  const takeaway =
    data.totalIncome > 0
      ? net >= 0
        ? `You retained ${formatPercent(rate)} of recorded income.`
        : `Spending exceeded income by ${idr(Math.abs(net))}.`
      : data.totalExpense > 0
        ? "Spending is recorded, but no income appears in this period."
        : "No financial activity recorded for this period.";
  const detail =
    data.totalIncome > 0
      ? `For every Rp 100 earned, Rp ${Math.round(spentShare).toLocaleString("id-ID")} went to spending.`
      : "Totals follow transaction dates. Try a wider period if income or expenses are missing.";
  text("THE TAKEAWAY", 14, 107, 8, MUTED, true);
  doc.setFillColor(237, 242, 227);
  doc.roundedRect(14, 112, 182, 25, 2, 2, "F");
  text(takeaway, 19, 121, 9, GREEN, true);
  wrapped(detail, 19, 129, 172, 8);
  text("Cash flow at a glance", 14, 149, 12, INK, true);
  const flowMax = Math.max(data.totalIncome, data.totalExpense, 1);
  [
    { label: "Income", amount: data.totalIncome, color: GREEN },
    { label: "Spending", amount: data.totalExpense, color: CLAY },
  ].forEach((row, index) => {
    const y = 160 + index * 21;
    text(row.label, 14, y, 8, MUTED);
    doc.setFontSize(8);
    doc.setTextColor(...INK);
    doc.text(idr(row.amount), 196, y, { align: "right" });
    doc.setFillColor(...PAPER);
    doc.roundedRect(14, y + 3, 182, 7, 1, 1, "F");
    if (row.amount > 0) {
      doc.setFillColor(...row.color);
      doc.roundedRect(
        14,
        y + 3,
        Math.max(0.5, (row.amount / flowMax) * 182),
        7,
        1,
        1,
        "F",
      );
    }
  });
  text("What drove your spending?", 14, 208, 12, INK, true);
  if (largest) {
    wrapped(
      `${largest.name} led spending: ${idr(largest.expense)} (${formatPercent((largest.expense / data.totalExpense) * 100)} of total spending).`,
      14,
      216,
      182,
      8,
    );
    spending.slice(0, 5).forEach((row, index) => {
      const y = 231 + index * 9;
      doc.setFontSize(8);
      const name = doc.splitTextToSize(row.name, 65)[0];
      text(name, 14, y, 8);
      doc.setFillColor(...PAPER);
      doc.rect(82, y - 3, 49, 3, "F");
      doc.setFillColor(...GREEN);
      doc.rect(82, y - 3, (row.expense / data.totalExpense) * 49, 3, "F");
      text(
        formatPercent((row.expense / data.totalExpense) * 100),
        134,
        y,
        7,
        MUTED,
      );
      doc.setFontSize(8);
      doc.setTextColor(...INK);
      doc.text(idr(row.expense), 196, y, { align: "right" });
    });
  } else
    wrapped(
      "No spending recorded. Add an expense or choose another reporting period to see a category breakdown.",
      14,
      218,
      182,
      9,
    );
  if (categoryRows.length || walletRows.length) {
    doc.addPage();
    text("Behind the numbers", 14, 23, 20, INK, true);
    text(period, 14, 31, 9, MUTED);
    let finalY = 43;
    function table(title, firstColumn, rows, note) {
      if (finalY > 235) {
        doc.addPage();
        finalY = 22;
      }
      text(title, 14, finalY, 12, INK, true);
      finalY = wrapped(note, 14, finalY + 6, 182, 8) + 3;
      autoTable(doc, {
        startY: finalY,
        margin: { top: 20, bottom: 22, left: 14, right: 14 },
        head: [[firstColumn, "Income", "Spending", "Net flow", "Spend share"]],
        body: rows.map((row) => [
          row.name,
          idr(row.income),
          idr(row.expense),
          idr(row.income - row.expense),
          data.totalExpense > 0
            ? formatPercent((row.expense / data.totalExpense) * 100)
            : "N/A",
        ]),
        foot: [
          [
            "Total",
            idr(data.totalIncome),
            idr(data.totalExpense),
            idr(net),
            data.totalExpense > 0 ? "100%" : "N/A",
          ],
        ],
        showFoot: "lastPage",
        theme: "plain",
        styles: {
          font: "helvetica",
          fontSize: 8,
          cellPadding: 3.5,
          textColor: INK,
          overflow: "linebreak",
        },
        columnStyles: {
          0: { cellWidth: 48 },
        },
        didParseCell: ({ cell, column }) => {
          cell.styles.halign = column.index === 0 ? "left" : "right";
        },
        headStyles: {
          fillColor: GREEN,
          textColor: [255, 255, 255],
          fontStyle: "bold",
        },
        alternateRowStyles: { fillColor: PAPER },
        footStyles: {
          fillColor: [232, 239, 223],
          textColor: INK,
          fontStyle: "bold",
        },
        rowPageBreak: "avoid",
      });
      finalY = doc.lastAutoTable.finalY + 15;
    }
    // By Category
    if (categoryRows.length)
      table(
        "Category breakdown",
        "Category",
        categoryRows,
        "Income and spending grouped by category. Spend share is a percentage of all spending.",
      );
    // By Wallet
    if (walletRows.length)
      table(
        "Wallet cash flow",
        "Wallet",
        walletRows,
        "Period activity only. Net flow excludes starting balances and is not your current wallet balance.",
      );
  }
  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page++) {
    doc.setPage(page);
    doc.setDrawColor(225, 230, 219);
    doc.line(14, 282, 196, 282);
    text(
      "Finance Tracker | IDR | Based on recorded transactions",
      14,
      288,
      7,
      MUTED,
    );
    doc.setFontSize(7);
    doc.text(`${page} / ${pageCount}`, 196, 288, { align: "right" });
  }
  return doc;
}

module.exports = { createReportPdf };
