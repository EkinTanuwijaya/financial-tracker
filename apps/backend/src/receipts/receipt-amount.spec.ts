import { receiptAmount } from "./receipt-amount";

describe("receiptAmount", () => {
  it.each([
    ["AMOUNT\nIDR 16,00000", 16000],
    ["AMOUNT\nIDR 16,000.00", 16000],
    ["Total Rp 16.000,00", 16000],
    ["Grand total: Rp 1.600.000,50", 1600000.5],
    ["AMOUNT\nIDR 1,600,00000", 1600000],
    ["Total Rp 16.00050", 16000.5],
    ["Total Rp 16,50", 16.5],
    ["Total Rp 16000", 16000],
    ["Jumlah transfer\nRp 16.000", 16000],
  ])("reads %s as %s IDR", (text, expected) => {
    expect(receiptAmount(text)).toBe(expected);
  });

  it("ignores recipient account, reference, fee, and subtotal numbers", () => {
    expect(receiptAmount("AMOUNT\nIDR 16,00000\nAccount\n7610736712\nFee IDR 2,500.00\nSubtotal Rp 10.000\nReference 001375045338"))
      .toBe(16000);
    expect(receiptAmount("Account 7610736712\nFee IDR 2,500.00\nSubtotal Rp 10.000")).toBeNull();
  });

  it.each(["Total Rp 16,0000", "Total Rp 0", "Total Rp 16.000\nGrand total Rp 20.000"]) (
    "rejects uncertain totals: %s", (text) => {
      expect(() => receiptAmount(text)).toThrow("Receipt total is ambiguous or unreadable");
    },
  );
});
