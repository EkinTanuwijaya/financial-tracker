const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

require.extensions[".ts"] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021, esModuleInterop: true },
  }).outputText, filename);
};
const { createReportPdf } = require("../src/lib/pdf.ts");
const { generateReportPdf } = require("../../backend/src/reports/report-pdf.ts");
const fixture = {
  periodLabel: "All time", dateRangeLabel: "All time", totalIncome: 32000, totalExpense: 16500,
  byCategory: { Salary: { income: 32000, expense: 0 }, Food: { income: 0, expense: 16000 }, Transport: { income: 0, expense: 500 } },
  byWallet: { "CIMB Niaga": { income: 32000, expense: 16500 } },
};

test("exports correct income, cash flow, spending shares, details, and Jakarta generation time", () => {
  const doc = createReportPdf(fixture, new Date("2026-11-02T01:02:00Z"));
  const output = doc.output();
  for (const value of ["Rp 32.000", "Rp 16.500", "Rp 15.500", "48.4%", "97%", "Category breakdown", "Wallet cash flow", "08:02 WIB", "excludes starting balances"]) assert.ok(output.includes(value), value);
  assert.equal(doc.getNumberOfPages(), 2);
  const table = doc.lastAutoTable;
  for (const row of [...table.head, ...table.body, ...table.foot]) {
    for (const column of table.columns) {
      const cell = row.cells[column.index];
      assert.equal(cell.styles.halign, column.index === 0 ? "left" : "right");
      const reference = table.head[0].cells[column.index];
      assert.ok(Math.abs(cell.x + cell.width - reference.x - reference.width) < 0.01);
    }
  }
  const directory = path.resolve(__dirname, "../../../test-results/pdf");
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, "financial-report-preview.pdf"), Buffer.from(doc.output("arraybuffer")));
});

test("empty periods and spending without income avoid invalid ratios", () => {
  for (const expense of [0, 500]) {
    const doc = createReportPdf({ ...fixture, totalIncome: 0, totalExpense: expense, byCategory: {}, byWallet: {} });
    const output = doc.output();
    assert.equal(doc.getNumberOfPages(), 1);
    assert.ok(output.includes("N/A"));
    assert.ok(!output.includes("NaN"));
    assert.ok(!output.includes("Infinity"));
    assert.ok(output.includes(expense ? "no income appears" : "No financial activity"));
  }
});

test("negative cash flow is shown as a shortfall", () => {
  const output = createReportPdf({ ...fixture, totalIncome: 10000 }).output();
  assert.ok(output.includes("Spending exceeded income by Rp 6.500"));
  assert.ok(output.includes("-65%"));
});

test("Telegram and dashboard exports contain identical report pages for the same data", () => {
  const generatedAt = new Date("2026-11-02T01:02:00Z");
  const pages = (pdf) => [...pdf.matchAll(/\nstream\r?\n([\s\S]*?)\r?\nendstream/g)].map((match) => match[1]);
  for (const data of [fixture, { ...fixture, totalIncome: 10000 }, {
    ...fixture, totalIncome: 0, totalExpense: 0, byCategory: {}, byWallet: {},
  }]) {
    const dashboard = createReportPdf(data, generatedAt).output();
    const telegram = generateReportPdf(data, {
      label: data.periodLabel, dateRangeLabel: data.dateRangeLabel,
    }, generatedAt);
    assert.ok(Buffer.isBuffer(telegram));
    assert.ok(pages(dashboard).length > 0);
    assert.deepEqual(pages(telegram.toString("latin1")), pages(dashboard));
  }
});

test("long category and wallet lists paginate and retain the last rows and page counts", () => {
  const byCategory = Object.fromEntries(Array.from({ length: 70 }, (_, index) => [`Category ${index} with a long descriptive name`, { income: 0, expense: 1000 }]));
  const byWallet = Object.fromEntries(Array.from({ length: 60 }, (_, index) => [`Wallet ${index} with a long account name`, { income: 2000, expense: 1000 }]));
  const doc = createReportPdf({ ...fixture, totalIncome: 120000, totalExpense: 70000, byCategory, byWallet });
  const output = doc.output();
  assert.ok(doc.getNumberOfPages() > 3);
  assert.ok(output.includes("Category 69"));
  assert.ok(output.includes("Wallet 59"));
  assert.ok(output.includes(`${doc.getNumberOfPages()} / ${doc.getNumberOfPages()}`));
});
