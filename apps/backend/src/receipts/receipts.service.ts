import { Injectable } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";

@Injectable()
export class ReceiptsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, data: { fileUrl: string }) {
    return this.prisma.receipt.create({
      data: {
        ...data,
        userId,
      },
    });
  }

  async findAll(userId: string) {
    return this.prisma.receipt.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: {
        transaction: {
          include: {
            wallet: true,
            category: true,
          },
        },
      },
    });
  }

  async findById(id: string, userId: string) {
    return this.prisma.receipt.findFirst({
      where: { id, userId },
      include: {
        transaction: {
          include: {
            wallet: true,
            category: true,
          },
        },
      },
    });
  }

  async updateProcessingStatus(
    id: string,
    status: string,
    extractedData?: any,
    rawText?: string,
  ) {
    return this.prisma.receipt.update({
      where: { id },
      data: {
        processingStatus: status as any,
        extractedData,
        rawText,
      },
    });
  }

  async linkTransaction(receiptId: string, transactionId: string) {
    return this.prisma.receipt.update({
      where: { id: receiptId },
      data: {
        transactionId,
        processingStatus: "COMPLETED",
      },
    });
  }
}
