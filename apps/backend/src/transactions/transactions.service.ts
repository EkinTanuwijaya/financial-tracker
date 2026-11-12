import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";
import { Prisma } from "@prisma/client";

const TransactionSource = {
  TEXT: "TEXT" as const,
  RECEIPT: "RECEIPT" as const,
  MANUAL: "MANUAL" as const,
} as const;

type TransactionSource =
  (typeof TransactionSource)[keyof typeof TransactionSource];

/**
 * The effect of a transaction on a wallet balance. Income is positive, an
 * expense negative. An unknown category is treated as an expense, which is the
 * safer default: it never inflates a balance.
 */
function signedAmount(
  categoryType: string | undefined,
  amount: Prisma.Decimal.Value,
): Prisma.Decimal {
  const value = new Prisma.Decimal(amount);
  return categoryType === "INCOME" ? value : value.negated();
}

function validateInput(data: {
  amount?: number;
  currency?: string;
  transactionDate?: Date;
}) {
  if (
    data.amount !== undefined &&
    (typeof data.amount !== "number" ||
      !Number.isFinite(data.amount) ||
      data.amount < 0.01 ||
      data.amount > Number.MAX_SAFE_INTEGER)
  )
    throw new BadRequestException(
      "Amount must be at least 0.01 and within the supported range",
    );
  if (data.currency !== undefined && data.currency !== "IDR")
    throw new BadRequestException("Only IDR is supported");
  if (
    data.transactionDate !== undefined &&
    (!(data.transactionDate instanceof Date) ||
      !Number.isFinite(data.transactionDate.getTime()))
  )
    throw new BadRequestException("Invalid transaction date");
}

function validateRange(start?: Date, end?: Date) {
  if (
    (start && !Number.isFinite(start.getTime())) ||
    (end && !Number.isFinite(end.getTime())) ||
    (start && end && start > end)
  )
    throw new BadRequestException("Choose a valid date range");
}

@Injectable()
export class TransactionsService {
  constructor(private prisma: PrismaService) {}

  async findAll(
    userId: string,
    options?: {
      walletId?: string;
      categoryId?: string;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      offset?: number;
    },
  ) {
    validateRange(options?.startDate, options?.endDate);
    const where: any = { userId };

    if (options?.walletId) where.walletId = options.walletId;
    if (options?.categoryId) where.categoryId = options.categoryId;
    if (options?.startDate || options?.endDate) {
      where.transactionDate = {};
      if (options?.startDate) where.transactionDate.gte = options.startDate;
      if (options?.endDate) where.transactionDate.lte = options.endDate;
    }

    return this.prisma.transaction.findMany({
      where,
      include: {
        wallet: true,
        category: true,
      },
      orderBy: [{ transactionDate: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      take: options?.limit ?? 50,
      skip: options?.offset ?? 0,
    });
  }

  /**
   * Total amount per category in a period. Prisma cannot group by a relation, so
   * rows are grouped by `categoryId` and the names are resolved afterwards.
   * Aggregating here keeps the result independent of any display row cap.
   */
  async sumByCategory(
    userId: string,
    options?: { startDate?: Date; endDate?: Date },
  ) {
    validateRange(options?.startDate, options?.endDate);
    const where: any = { userId };

    if (options?.startDate || options?.endDate) {
      where.transactionDate = {};
      if (options?.startDate) where.transactionDate.gte = options.startDate;
      if (options?.endDate) where.transactionDate.lte = options.endDate;
    }

    const grouped = await this.prisma.transaction.groupBy({
      by: ["categoryId"],
      where,
      _sum: { amount: true },
      _count: { _all: true },
    });

    if (grouped.length === 0) return [];

    const categories = await this.prisma.category.findMany({
      where: { userId, id: { in: grouped.map((row) => row.categoryId) } },
    });
    const names = new Map(categories.map((c) => [c.id, c]));

    return grouped
      .map((row) => {
        const category = names.get(row.categoryId);
        return {
          categoryId: row.categoryId,
          categoryName: category?.name ?? "Uncategorized",
          categoryType: category?.type ?? "EXPENSE",
          total: Number(row._sum?.amount ?? 0),
          count: row._count?._all ?? 0,
        };
      })
      .sort((a, b) => b.total - a.total);
  }

  async findById(id: string, userId: string) {
    const transaction = await this.prisma.transaction.findFirst({
      where: { id, userId },
      include: {
        wallet: true,
        category: true,
        receipt: true,
      },
    });
    if (!transaction) throw new NotFoundException("Transaction not found");
    return transaction;
  }

  async create(
    userId: string,
    data: {
      walletId: string;
      categoryId: string;
      amount: number;
      currency?: string;
      description?: string;
      transactionDate: Date;
      source?: string;
    },
    receiptId?: string,
  ) {
    validateInput(data);
    return this.prisma.serializable(async (tx: Prisma.TransactionClient) => {
      const wallet = await tx.wallet.findFirst({
        where: { id: data.walletId, userId },
      });
      const category = await tx.category.findFirst({
        where: { id: data.categoryId, userId },
      });
      if (!wallet || !category)
        throw new NotFoundException("Wallet or category not found");
      if (receiptId) {
        const receipt = await tx.receipt.findFirst({
          where: { id: receiptId, userId },
        });
        if (!receipt) throw new NotFoundException("Receipt not found");
        if (receipt.transactionId)
          throw new ConflictException("Receipt already has a transaction");
      }

      // A transaction has no sign of its own: `Transaction` stores a positive
      // amount and the direction comes from its category. Income adds to the
      // wallet, an expense takes from it. The balance update used to always
      // increment, which inflated every wallet that recorded a spend.
      await tx.wallet.update({
        where: { id: data.walletId, userId },
        data: {
          balance: { increment: signedAmount(category.type, data.amount) },
        },
      });
      const transaction = await tx.transaction.create({
        data: {
          ...data,
          userId,
          currency: data.currency || "IDR",
          source:
            (data.source as TransactionSource) || TransactionSource.MANUAL,
        },
        include: { wallet: true, category: true },
      });
      if (receiptId)
        await tx.receipt.update({
          where: { id: receiptId, userId },
          data: {
            transactionId: transaction.id,
            processingStatus: "COMPLETED",
          },
        });
      return transaction;
    });
  }

  async update(
    id: string,
    userId: string,
    data: Partial<{
      walletId: string;
      categoryId: string;
      amount: number;
      currency: string;
      description: string;
      transactionDate: Date;
    }>,
  ) {
    validateInput(data);
    return this.prisma.serializable(async (tx: Prisma.TransactionClient) => {
      const existing = await tx.transaction.findFirst({
        where: { id, userId },
      });
      if (!existing) throw new NotFoundException("Transaction not found");
      const oldCategory = await tx.category.findFirst({
        where: { id: existing.categoryId, userId },
        select: { type: true },
      });
      const newCategoryId = data.categoryId || existing.categoryId;
      const newCategory =
        newCategoryId === existing.categoryId
          ? oldCategory
          : await tx.category.findFirst({
              where: { id: newCategoryId, userId },
              select: { type: true },
            });

      const newWalletId = data.walletId || existing.walletId;
      if (
        !oldCategory ||
        !newCategory ||
        !(await tx.wallet.findFirst({ where: { id: newWalletId, userId } }))
      )
        throw new NotFoundException("Wallet or category not found");
      const oldAmount = existing.amount;
      const newAmount = data.amount !== undefined ? data.amount : oldAmount;

      // Undo the old effect, then apply the new one. Doing both unconditionally
      // is correct even when nothing changed, since undo-then-apply nets out.
      const reversal = signedAmount(oldCategory.type, oldAmount).negated();
      if (newWalletId !== existing.walletId)
        await tx.wallet.update({
          where: { id: existing.walletId, userId },
          data: { balance: { increment: reversal } },
        });
      await tx.wallet.update({
        where: { id: newWalletId, userId },
        data: {
          balance: {
            increment: signedAmount(newCategory.type, newAmount).plus(
              newWalletId === existing.walletId ? reversal : 0,
            ),
          },
        },
      });

      return tx.transaction.update({
        where: { id, userId },
        data,
        include: {
          wallet: true,
          category: true,
        },
      });
    });
  }

  async delete(id: string, userId: string) {
    return this.prisma.serializable(async (tx: Prisma.TransactionClient) => {
      const existing = await tx.transaction.findFirst({
        where: { id, userId },
      });
      if (!existing) throw new NotFoundException("Transaction not found");
      const category = await tx.category.findFirst({
        where: { id: existing.categoryId, userId },
        select: { type: true },
      });

      // Undo the effect this transaction had, which means adding it back if it
      // was an expense and taking it back if it was income.
      await tx.wallet.update({
        where: { id: existing.walletId, userId },
        data: {
          balance: {
            increment: signedAmount(category?.type, existing.amount).negated(),
          },
        },
      });

      return tx.transaction.delete({
        where: { id, userId },
      });
    });
  }

  async getSummary(userId: string, startDate?: Date, endDate?: Date) {
    validateRange(startDate, endDate);
    const where: any = { userId };
    if (startDate || endDate) {
      where.transactionDate = {};
      if (startDate) where.transactionDate.gte = startDate;
      if (endDate) where.transactionDate.lte = endDate;
    }

    const grouped = await this.prisma.transaction.groupBy({
      by: ["categoryId", "walletId"],
      where,
      _sum: { amount: true },
    });
    const [categories, wallets] = grouped.length
      ? await Promise.all([
          this.prisma.category.findMany({
            where: { userId },
            select: { id: true, name: true, type: true },
          }),
          this.prisma.wallet.findMany({
            where: { userId },
            select: { id: true, name: true },
          }),
        ])
      : [[], []];
    const categoryById = new Map(
      categories.map((category) => [category.id, category]),
    );
    const walletById = new Map(wallets.map((wallet) => [wallet.id, wallet]));

    const summary = {
      totalIncome: 0,
      totalExpense: 0,
      byCategory: Object.create(null) as Record<
        string,
        { income: number; expense: number }
      >,
      byWallet: Object.create(null) as Record<
        string,
        { income: number; expense: number }
      >,
    };

    for (const row of grouped) {
      const category = categoryById.get(row.categoryId),
        wallet = walletById.get(row.walletId);
      if (!category || !wallet) continue;
      const t = { category, wallet };
      const amount = Number(row._sum.amount ?? 0);
      const isIncome = t.category.type === "INCOME";

      if (isIncome) {
        summary.totalIncome += amount;
      } else {
        summary.totalExpense += amount;
      }

      if (!summary.byCategory[t.category.name]) {
        summary.byCategory[t.category.name] = { income: 0, expense: 0 };
      }
      if (isIncome) {
        summary.byCategory[t.category.name].income += amount;
      } else {
        summary.byCategory[t.category.name].expense += amount;
      }

      if (!summary.byWallet[t.wallet.name]) {
        summary.byWallet[t.wallet.name] = { income: 0, expense: 0 };
      }
      if (isIncome) {
        summary.byWallet[t.wallet.name].income += amount;
      } else {
        summary.byWallet[t.wallet.name].expense += amount;
      }
    }

    return summary;
  }
}
