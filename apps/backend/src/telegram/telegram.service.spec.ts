import { TelegramService } from "./telegram.service";

describe("Telegram receipt confirmation", () => {
  it.each([false, true])("only offers confirmation with valid wallet/category selections: %s", async (matched) => {
    const service = new TelegramService(
      { get: () => "" } as any,
      {} as any,
      { findByName: jest.fn().mockResolvedValue(matched ? { id: "wallet" } : null) } as any,
      { findByName: jest.fn().mockResolvedValue(matched ? { id: "category" } : null) } as any,
      {} as any,
      {
        create: jest.fn().mockResolvedValue({ id: "receipt" }),
        processReceipt: jest.fn(),
        findById: jest.fn().mockResolvedValue({
          processingStatus: "WAITING_CONFIRMATION",
          extractedData: { amount: 16000, wallet: matched ? "CIMB" : "", category: matched ? "Other" : "", date: "2026-09-06" },
        }),
      } as any,
      {} as any,
    );
    const bot = service as any;
    bot.findLinkedUser = jest.fn().mockResolvedValue({ id: "user" });
    bot.getFile = jest.fn().mockResolvedValue({ file_path: "receipt.png" });
    bot.downloadFile = jest.fn().mockResolvedValue(Buffer.from("image"));
    bot.sendThinkingMessage = jest.fn().mockResolvedValue(null);
    bot.sendMessage = jest.fn();
    bot.pendingConfirmations.set(123, { walletId: "stale" });

    await bot.handleReceipt({ chat: { id: 123 }, photo: [{ file_id: "file" }] });

    if (matched) {
      expect(bot.sendMessage).toHaveBeenLastCalledWith(123, expect.stringContaining("Please confirm:"));
      expect(bot.pendingConfirmations.get(123)).toMatchObject({ walletId: "wallet", categoryId: "category", amount: 16000 });
    } else {
      expect(bot.sendMessage).toHaveBeenLastCalledWith(123, expect.stringContaining("Cannot save yet: wallet not matched, category not matched"));
      expect(bot.pendingConfirmations.has(123)).toBe(false);
    }
  });
});
