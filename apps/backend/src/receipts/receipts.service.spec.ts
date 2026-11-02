import { ReceiptsService } from "./receipts.service";

describe("ReceiptsService receipt extraction", () => {
  const extraction = { amount: 16, currency: "IDR", wallet: "", category: "", date: "2026-09-06" };
  let service: ReceiptsService;
  let update: jest.Mock;

  beforeEach(() => {
    update = jest.fn().mockResolvedValue({});
    service = new ReceiptsService(
      {
        receipt: { update, findUnique: jest.fn().mockResolvedValue({ userId: "user" }) },
        wallet: { findMany: jest.fn().mockResolvedValue([]) },
        category: { findMany: jest.fn().mockResolvedValue([]) },
      } as any,
      { recognize: jest.fn().mockResolvedValue({ text: "AMOUNT\nIDR 16,00000\nTransaction Time\n06 Sep 2026 10:19", confidence: 98 }) } as any,
      { extractTransaction: jest.fn().mockResolvedValue({ ...extraction }) } as any,
    );
  });

  it("corrects an AI amount of 16 using the OCR total without changing the receipt date", async () => {
    await service.processReceipt("receipt", Buffer.from("image"));
    expect(update).toHaveBeenLastCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        processingStatus: "WAITING_CONFIRMATION",
        extractedData: { ...extraction, amount: 16000 },
      }),
    }));
  });
});
