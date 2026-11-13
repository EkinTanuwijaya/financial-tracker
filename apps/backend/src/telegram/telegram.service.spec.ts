import { TelegramService } from "./telegram.service";

describe("Telegram receipt confirmation", () => {
  it.each([false, true])(
    "only offers confirmation with valid wallet/category selections: %s",
    async (matched) => {
      const service = new TelegramService(
        { get: () => "" } as any,
        {} as any,
        {
          findByName: jest
            .fn()
            .mockResolvedValue(matched ? { id: "wallet" } : null),
        } as any,
        {
          findByName: jest
            .fn()
            .mockResolvedValue(matched ? { id: "category" } : null),
        } as any,
        {} as any,
        {
          create: jest.fn().mockResolvedValue({ id: "receipt" }),
          processReceipt: jest.fn(),
          findById: jest.fn().mockResolvedValue({
            processingStatus: "WAITING_CONFIRMATION",
            extractedData: {
              amount: 16000,
              wallet: matched ? "CIMB" : "",
              category: matched ? "Other" : "",
              date: "2026-09-06",
            },
          }),
        } as any,
        {} as any,
        {} as any,
      );
      const bot = service as any;
      bot.findLinkedUser = jest.fn().mockResolvedValue({ id: "user" });
      bot.getFile = jest.fn().mockResolvedValue({ file_path: "receipt.png" });
      bot.downloadFile = jest.fn().mockResolvedValue(Buffer.from("image"));
      bot.sendThinkingMessage = jest.fn().mockResolvedValue(null);
      bot.sendMessage = jest.fn();
      bot.pendingConfirmations.set(123, { walletId: "stale" });

      await bot.handleReceipt({
        chat: { id: 123 },
        photo: [{ file_id: "file" }],
      });

      if (matched) {
        expect(bot.sendMessage).toHaveBeenLastCalledWith(
          123,
          expect.stringContaining("Please confirm:"),
        );
        expect(bot.pendingConfirmations.get(123)).toMatchObject({
          walletId: "wallet",
          categoryId: "category",
          amount: 16000,
        });
      } else {
        expect(bot.sendMessage).toHaveBeenLastCalledWith(
          123,
          expect.stringContaining(
            "Cannot save yet: wallet not matched, category not matched",
          ),
        );
        expect(bot.pendingConfirmations.has(123)).toBe(false);
      }
    },
  );
});

describe("Telegram confirmation safety", () => {
  function bot() {
    return new TelegramService(
      { get: () => "" } as any,
      {} as any,
      {} as any,
      {} as any,
      { create: jest.fn() } as any,
      {} as any,
      {} as any,
      {} as any,
    ) as any;
  }
  it("never matches an empty AI wallet name to the first wallet", () => {
    expect(bot().fuzzyMatch("", [{ id: "wallet", name: "Cash" }])).toBeNull();
  });
  it("uses the actual Telegram API result for the thinking message ID", async () => {
    const service = bot();
    service.call = jest.fn().mockResolvedValue({ message_id: 123 });
    await expect(service.sendThinkingMessage(1)).resolves.toBe(123);
  });
  it("rejects a confirmation after its Telegram account was unlinked", async () => {
    const service = bot();
    service.findLinkedUser = jest.fn().mockResolvedValue(null);
    service.pendingConfirmations.set(1, {
      userId: "user",
      expiresAt: Date.now() + 600000,
    });
    await service.handleUpdate({
      message: { chat: { id: 1, type: "private" }, text: "yes" },
    });
    expect(service.transactions.create).not.toHaveBeenCalled();
    expect(service.pendingConfirmations.has(1)).toBe(false);
  });
  it("saves receipt confirmations with their source and atomic receipt link", async () => {
    const service = bot();
    service.findLinkedUser = jest.fn().mockResolvedValue({ id: "user" });
    service.sendMessage = jest.fn();
    service.pendingConfirmations.set(1, {
      userId: "user",
      walletId: "wallet",
      categoryId: "category",
      receiptId: "receipt",
      amount: 100,
      date: new Date(),
      expiresAt: Date.now() + 600000,
    });
    await service.handleUpdate({
      message: { chat: { id: 1, type: "private" }, text: "yes" },
    });
    expect(service.transactions.create).toHaveBeenCalledWith(
      "user",
      expect.objectContaining({ source: "RECEIPT" }),
      "receipt",
    );
  });
  it("uses Jakarta dates and rejects impossible receipt dates", () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-11-06T18:00:00Z"));
    try {
      expect(bot().parseRelativeDate("today").toISOString()).toBe(
        "2026-11-07T00:00:00.000Z",
      );
      expect(() => bot().parseRelativeDate("2026-02-31")).toThrow(
        "Invalid transaction date",
      );
    } finally {
      jest.useRealTimers();
    }
  });
  it("keeps a successful save when sending the confirmation reply fails", async () => {
    const service = bot();
    service.findLinkedUser = jest.fn().mockResolvedValue({ id: "user" });
    service.sendMessage = jest.fn().mockRejectedValue(new Error("fetch failed"));
    service.logger.error = jest.fn();
    service.pendingConfirmations.set(1, {
      userId: "user",
      walletId: "wallet",
      categoryId: "category",
      amount: 100,
      date: new Date(),
      expiresAt: Date.now() + 600000,
    });

    await expect(service.handleUpdate({
      update_id: 123,
      message: { chat: { id: 1, type: "private" }, text: "yes" },
    })).resolves.toBeUndefined();

    expect(service.transactions.create).toHaveBeenCalledTimes(1);
    expect(service.pendingConfirmations.has(1)).toBe(false);
    expect(service.logger.error).toHaveBeenCalledWith(
      expect.stringContaining("Transaction saved, but Telegram confirmation reply failed"),
    );
  });
  it("identifies the failing Telegram method and network cause without logging the token", async () => {
    const service = new TelegramService(
      { get: () => "private-test-token" } as any,
      {} as any, {} as any, {} as any, {} as any,
      {} as any, {} as any, {} as any,
    ) as any;
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockRejectedValue(Object.assign(new TypeError("fetch failed"), {
      cause: Object.assign(new Error("https://api.telegram.org/botprivate-test-token/sendMessage"), {
        code: "ECONNRESET",
      }),
    }));
    try {
      const error = await service.call("sendMessage", { chat_id: 1, text: "Saved" })
        .catch((failure: Error) => failure);
      expect(error.message).toContain("Telegram sendMessage request failed");
      expect(error.message).toContain("ECONNRESET");
      expect(error.message).toContain("<redacted>");
      expect(error.message).not.toContain("private-test-token");
    } finally {
      global.fetch = originalFetch;
    }
  });
  it("includes connection codes from aggregate network errors", () => {
    const error = Object.assign(new TypeError("fetch failed"), {
      cause: { errors: [{ code: "ETIMEDOUT" }, { code: "ENETUNREACH" }] },
    });
    expect(bot().describe(error)).toContain("ETIMEDOUT; ENETUNREACH");
  });
});
