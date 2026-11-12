import { Prisma } from "@prisma/client";
import { TransactionsService } from "./transactions.service";

describe("Transaction ownership and balances", () => {
  let tx: any, service: TransactionsService;
  const data = {
    walletId: "wallet",
    categoryId: "expense",
    amount: 0.3,
    transactionDate: new Date("2026-11-07"),
  };
  beforeEach(() => {
    tx = {
      wallet: {
        findFirst: jest.fn().mockResolvedValue({ id: "wallet" }),
        update: jest.fn(),
      },
      category: {
        findFirst: jest.fn().mockResolvedValue({ type: "EXPENSE" }),
        findMany: jest.fn(),
      },
      transaction: {
        create: jest.fn().mockResolvedValue({ id: "entry" }),
        update: jest.fn(),
        delete: jest.fn(),
        findFirst: jest
          .fn()
          .mockResolvedValue({
            id: "entry",
            walletId: "wallet",
            categoryId: "expense",
            amount: new Prisma.Decimal("0.1"),
          }),
        groupBy: jest.fn(),
      },
      receipt: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: "receipt", transactionId: null }),
        update: jest.fn(),
      },
    };
    service = new TransactionsService({
      ...tx,
      serializable: (run: any) => run(tx),
    } as any);
  });
  it("rejects foreign wallets/categories before writing balances", async () => {
    tx.wallet.findFirst.mockResolvedValue(null);
    await expect(service.create("owner", data)).rejects.toThrow("not found");
    expect(tx.transaction.create).not.toHaveBeenCalled();
    expect(tx.wallet.update).not.toHaveBeenCalled();
    tx.wallet.findFirst.mockResolvedValue({ id: "wallet" });
    tx.category.findFirst.mockResolvedValue(null);
    await expect(
      service.update("entry", "owner", { categoryId: "foreign" }),
    ).rejects.toThrow("not found");
    expect(tx.wallet.update).not.toHaveBeenCalled();
  });
  it("uses exact decimal differences and one wallet write for same-wallet edits", async () => {
    await service.update("entry", "owner", { amount: 0.3 });
    expect(tx.transaction.findFirst).toHaveBeenCalledWith({
      where: { id: "entry", userId: "owner" },
    });
    expect(tx.wallet.update).toHaveBeenCalledTimes(1);
    expect(
      tx.wallet.update.mock.calls[0][0].data.balance.increment.toString(),
    ).toBe("-0.2");
  });
  it("updates the wallet before returning a new transaction and links its receipt atomically", async () => {
    await service.create("owner", { ...data, source: "RECEIPT" }, "receipt");
    expect(tx.wallet.update.mock.invocationCallOrder[0]).toBeLessThan(
      tx.transaction.create.mock.invocationCallOrder[0],
    );
    expect(
      tx.wallet.update.mock.calls[0][0].data.balance.increment.toString(),
    ).toBe("-0.3");
    expect(tx.receipt.update).toHaveBeenCalledWith({
      where: { id: "receipt", userId: "owner" },
      data: { transactionId: "entry", processingStatus: "COMPLETED" },
    });
    tx.receipt.findFirst.mockResolvedValue({ transactionId: "already-saved" });
    await expect(service.create("owner", data, "receipt")).rejects.toThrow(
      "already has",
    );
  });
  it("rejects invalid amounts from internal bot calls too", async () => {
    for (const amount of [NaN, -10, 0, 1e-100])
      await expect(
        service.create("owner", { ...data, amount }),
      ).rejects.toThrow();
    expect(tx.wallet.update).not.toHaveBeenCalled();
  });
  it("aggregates in the database and safely handles prototype-like names", async () => {
    tx.transaction.groupBy.mockResolvedValue([
      {
        categoryId: "expense",
        walletId: "wallet",
        _sum: { amount: new Prisma.Decimal(200) },
      },
    ]);
    tx.category.findMany.mockResolvedValue([
      { id: "expense", name: "__proto__", type: "EXPENSE" },
    ]);
    tx.wallet.findMany = jest
      .fn()
      .mockResolvedValue([{ id: "wallet", name: "constructor" }]);
    service = new TransactionsService(tx);
    const summary = await service.getSummary("owner");
    expect(summary.totalExpense).toBe(200);
    expect(summary.byCategory["__proto__"].expense).toBe(200);
    expect(summary.byWallet.constructor).toEqual({ income: 0, expense: 200 });
    expect(({} as any).expense).toBeUndefined();
  });
});
