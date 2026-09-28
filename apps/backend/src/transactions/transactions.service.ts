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

      // Update wallet balance
      await tx.wallet.update({
        where: { id: data.walletId },
        data: {
          balance: {
            increment: data.amount,
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
      // Revert old balance change
      await tx.wallet.update({
        where: { id: existing.walletId },
        data: {
          balance: {
            decrement: Number(existing.amount),
          },
        },
      });

      // Apply new balance change
      const newWalletId = data.walletId || existing.walletId;
      const newAmount =
        data.amount !== undefined ? data.amount : Number(existing.amount);

      await tx.wallet.update({
        where: { id: newWalletId },
        data: {
          balance: {
            increment: newAmount,
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
      // Revert balance change
      await tx.wallet.update({
        where: { id: existing.walletId },
        data: {
          balance: {
            decrement: Number(existing.amount),
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
