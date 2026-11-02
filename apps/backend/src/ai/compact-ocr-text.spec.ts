import { compactOcrText } from "./compact-ocr-text";

describe("compactOcrText", () => {
  it("removes spacing noise while preserving receipt fields and repeated items", () => {
    const text = "  OCTO   Mobile\r\n\r\n  Total\tRp 1.600.000,50  \r\n  28/03/2025\r\n  Ke  BCA\r\n  0012345678\r\n Kopi 25.000\r\n Kopi 25.000\r\n";
    expect(compactOcrText(text)).toBe(
      "OCTO Mobile\nTotal Rp 1.600.000,50\n28/03/2025\nKe BCA\n0012345678\nKopi 25.000\nKopi 25.000",
    );
  });

  it("handles empty input and preserves non-Latin names", () => {
    expect(compactOcrText(" \t\r\n\n")).toBe("");
    expect(compactOcrText(" Toko 東京 \n Rp 16.000,00")).toBe("Toko 東京\nRp 16.000,00");
  });
});
