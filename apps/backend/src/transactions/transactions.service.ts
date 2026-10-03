import { Injectable } from "@nestjs/common";
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
  amount: number,
): number {
  return categoryType === "INCOME" ? amount : -amount;
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
      orderBy: { transactionDate: "desc" },
      take: options?.limit || 50,
      skip: options?.offset || 0,
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
    return this.prisma.transaction.findFirst({
      where: { id, userId },
      include: {
        wallet: true,
        category: true,
        receipt: true,
      },
    });
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
  ) {
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const transaction = await tx.transaction.create({
        data: {
          ...data,
          userId,
          currency: data.currency || "IDR",
          source:
            (data.source as TransactionSource) || TransactionSource.MANUAL,
        },
        include: {
          wallet: true,
          category: true,
        },
      });

      // A transaction has no sign of its own: `Transaction` stores a positive
      // amount and the direction comes from its category. Income adds to the
      // wallet, an expense takes from it. The balance update used to always
      // increment, which inflated every wallet that recorded a spend.
      const category = await tx.category.findUnique({
        where: { id: data.categoryId },
        select: { type: true },
      });

      await tx.wallet.update({
        where: { id: data.walletId },
        data: {
          balance: {
            increment: signedAmount(category?.type, data.amount),
          },
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
    const existing = await this.prisma.transaction.findFirst({
      where: { id, userId },
    });

    if (!existing) return null;

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const oldCategory = await tx.category.findUnique({
        where: { id: existing.categoryId },
        select: { type: true },
      });
      const newCategoryId = data.categoryId || existing.categoryId;
      const newCategory =
        newCategoryId === existing.categoryId
          ? oldCategory
          : await tx.category.findUnique({
              where: { id: newCategoryId },
              select: { type: true },
            });

      const oldAmount = Number(existing.amount);
      const newAmount = data.amount !== undefined ? data.amount : oldAmount;

      // Undo the old effect, then apply the new one. Doing both unconditionally
      // is correct even when nothing changed, since undo-then-apply nets out.
      await tx.wallet.update({
        where: { id: existing.walletId },
        data: {
          balance: {
            increment: -signedAmount(oldCategory?.type, oldAmount),
          },
        },
      });

      const newWalletId = data.walletId || existing.walletId;
      await tx.wallet.update({
        where: { id: newWalletId },
        data: {
          balance: {
            increment: signedAmount(newCategory?.type, newAmount),
          },
        },
      });

      return tx.transaction.update({
        where: { id },
        data,
        include: {
          wallet: true,
          category: true,
        },
      });
    });
  }

  async delete(id: string, userId: string) {
    const existing = await this.prisma.transaction.findFirst({
      where: { id, userId },
    });

    if (!existing) return null;

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const category = await tx.category.findUnique({
        where: { id: existing.categoryId },
        select: { type: true },
      });

      // Undo the effect this transaction had, which means adding it back if it
      // was an expense and taking it back if it was income.
      await tx.wallet.update({
        where: { id: existing.walletId },
        data: {
          balance: {
            increment: -signedAmount(category?.type, Number(existing.amount)),
          },
        },
      });

      return tx.transaction.delete({
        where: { id },
      });
    });
  }

  async getSummary(userId: string, startDate?: Date, endDate?: Date) {
    const where: any = { userId };
    if (startDate || endDate) {
      where.transactionDate = {};
      if (startDate) where.transactionDate.gte = startDate;
      if (endDate) where.transactionDate.lte = endDate;
    }

    const transactions = await this.prisma.transaction.findMany({
      where,
      include: {
        category: true,
        wallet: true,
      },
    });

    const summary = {
      totalIncome: 0,
      totalExpense: 0,
      byCategory: {} as Record<string, { income: number; expense: number }>,
      byWallet: {} as Record<string, { income: number; expense: number }>,
    };

    for (const t of transactions) {
      const amount = Number(t.amount);
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
