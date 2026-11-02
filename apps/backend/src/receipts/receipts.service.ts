import { Injectable } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";
import { OcrService } from "../ocr/ocr.service";
import { AiService } from "../ai/ai.service";
import { compactOcrText } from "../ai/compact-ocr-text";
import { receiptAmount } from "./receipt-amount";

@Injectable()
export class ReceiptsService {
  constructor(
    private prisma: PrismaService,
    private ocr: OcrService,
    private ai: AiService,
  ) {}

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

  async processReceipt(receiptId: string, imageBuffer: Buffer, caption?: string): Promise<void> {
    await this.updateProcessingStatus(receiptId, "PROCESSING");

    try {
      const { text, confidence } = await this.ocr.recognize(imageBuffer);

      this.logger.log(`OCR result (confidence: ${confidence}%): ${text?.slice(0, 500)}`);

      if (!text || text.trim().length < 10) {
        await this.updateProcessingStatus(receiptId, "FAILED", null, text);
        return;
      }

      const receipt = await this.prisma.receipt.findUnique({ where: { id: receiptId } });
      if (!receipt) {
        await this.updateProcessingStatus(receiptId, "FAILED", null, text);
        return;
      }

      const [wallets, categories] = await Promise.all([
        this.prisma.wallet.findMany({ where: { userId: receipt.userId } }),
        this.prisma.category.findMany({ where: { userId: receipt.userId } }),
      ]);

      this.logger.debug(`User wallets: ${wallets.map(w => w.name).join(", ")}`);
      this.logger.debug(`User categories: ${categories.map(c => c.name).join(", ")}`);

      let extraction;
      try {
        const aiText = compactOcrText(text);
        this.logger.debug(`OCR input compacted: ${text.length} to ${aiText.length} characters`);
        extraction = await this.ai.extractTransaction(aiText, {
          wallets: wallets.map((w) => w.name),
          categories: categories.map((c) => c.name),
        }, caption);
        if (extraction) {
          extraction.amount = receiptAmount(aiText) ?? extraction.amount;
          if (!Number.isFinite(extraction.amount) || extraction.amount <= 0) {
            throw new Error("Could not detect a valid positive receipt amount.");
          }
        }
      } catch (aiError) {
        const msg = aiError instanceof Error ? aiError.message : String(aiError);
        this.logger.error(`AI extraction failed: ${msg}`);
        this.logger.error(`OCR text that failed: ${text}`);
        await this.updateProcessingStatus(receiptId, "FAILED", { error: msg, rawOcr: text }, text);
        return;
      }

      if (!extraction) {
        this.logger.warn(`AI returned null extraction for OCR: ${text}`);
        await this.updateProcessingStatus(receiptId, "FAILED", { rawOcr: text }, text);
        return;
      }

      this.logger.log(`AI extraction success: ${JSON.stringify(extraction)}`);
      await this.updateProcessingStatus(receiptId, "WAITING_CONFIRMATION", extraction, text);
    } catch (error) {
      this.logger.error(`OCR processing failed for receipt ${receiptId}:`, error);
      await this.updateProcessingStatus(receiptId, "FAILED");
    }
  }

  private logger = new (require("@nestjs/common").Logger)(ReceiptsService.name);
}
