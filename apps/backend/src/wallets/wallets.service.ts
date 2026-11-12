import { Injectable } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";

@Injectable()
export class WalletsService {
  constructor(private prisma: PrismaService) {}

  async findAll(userId: string) {
    return this.prisma.wallet.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
  }

  async findByName(userId: string, name: string) {
    return this.prisma.wallet.findFirst({
      where: { userId, name: { equals: name, mode: "insensitive" } },
    });
  }

  async findById(id: string, userId: string) {
    return this.prisma.wallet.findFirst({
      where: { id, userId },
    });
  }

  async create(
    userId: string,
    data: { name: string; type: string; currency?: string; balance?: number },
  ) {
    return this.prisma.wallet.create({
      data: {
        ...data,
        userId,
        currency: data.currency || "IDR",
        balance: data.balance || 0,
      },
    });
  }

  async update(
    id: string,
    userId: string,
    data: Partial<{
      name: string;
      type: string;
      currency: string;
      balance: number;
    }>,
  ) {
    return this.prisma.wallet.update({
      where: { id, userId },
      data,
    });
  }

  async delete(id: string, userId: string) {
    return this.prisma.wallet.delete({
      where: { id, userId },
    });
  }

  async updateBalance(id: string, amount: number) {
    return this.prisma.wallet.update({
      where: { id },
      data: {
        balance: {
          increment: amount,
        },
      },
    });
  }
}
