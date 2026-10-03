import { Injectable, Logger } from "@nestjs/common";
import { createWorker, PSM, OEM } from "tesseract.js";
import sharp from "sharp";

const BANK_KEYWORD_RE = /octo|cimb|livin|mandiri|bca|bri|bni|jenius|permata|maybank|danamon|brimo|bca mobile|mybca|gopay|ovo|dana|shopeepay|qris/i;
@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);
  private worker: Awaited<ReturnType<typeof createWorker>> | null = null;

  async initialize(): Promise<void> {
    if (this.worker) return;

    this.worker = await createWorker("eng+ind", 1, {
      logger: (m) => {
        if (m.status === "recognizing text") {
          this.logger.debug(`OCR progress: ${Math.round(m.progress * 100)}%`);
        }
      },
    });

    await this.worker.setParameters({
      tessedit_pageseg_mode: PSM.SPARSE_TEXT,
      tessedit_oem: OEM.LSTM_ONLY,
      preserve_interword_spaces: "1",
      tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,:-/()[]{}@#%&*+=|\\_ ",
    });
  }

  private async preprocessImage(imageBuffer: Buffer): Promise<{ thresholded: Buffer; enhanced: Buffer; original: Buffer }> {
    // Pipeline 1: thresholded (clean text, good for amounts, dates)
    const thresholded = await sharp(imageBuffer)
      .resize({ width: 2000, withoutEnlargement: false, kernel: sharp.kernel.lanczos3 })
      .greyscale()
      .normalize()
      .sharpen()
      .threshold(128)
      .png({ compressionLevel: 9 })
      .toBuffer();

    // Pipeline 2: enhanced color (preserves logos, bank names in color)
    const enhanced = await sharp(imageBuffer)
      .resize({ width: 2000, withoutEnlargement: false, kernel: sharp.kernel.lanczos3 })
      .normalize()
      .sharpen()
      .modulate({ brightness: 1.1, saturation: 1.3 })
      .png({ compressionLevel: 9 })
      .toBuffer();

    // Pipeline 3: original size, just normalize (for small headers that resize might distort)
    const original = await sharp(imageBuffer)
      .normalize()
      .sharpen()
      .png({ compressionLevel: 9 })
      .toBuffer();

    return { thresholded, enhanced, original };
  }

  async recognize(imageBuffer: Buffer): Promise<{ text: string; confidence: number }> {
    if (!this.worker) {
      await this.initialize();
    }

    const { thresholded, enhanced, original } = await this.preprocessImage(imageBuffer);

    // Try multiple PSM modes on all pipelines
    const pipelines = [
      { name: "thresholded", buffer: thresholded },
      { name: "enhanced", buffer: enhanced },
      { name: "original", buffer: original },
    ];
    // More PSM modes to catch header text at top of receipt
    const psmModes = [
      PSM.SPARSE_TEXT,      // 11 - sparse text (good for scattered)
      PSM.SINGLE_BLOCK,     // 6 - single text block
      PSM.AUTO,             // 3 - fully automatic
      PSM.SINGLE_COLUMN,    // 4 - single column of text
      PSM.SINGLE_WORD,      // 13 - single word
      PSM.CIRCLE_WORD,      // 14 - single word in circle
      PSM.SINGLE_CHAR,      // 10 - single character
    ];
    let bestResult: { text: string; confidence: number } | null = null;

    for (const pipeline of pipelines) {
      for (const psm of psmModes) {
        try {
          await this.worker!.setParameters({ tessedit_pageseg_mode: psm });
          const result = await this.worker!.recognize(pipeline.buffer);
          const textPreview = result.data.text.slice(0, 200).replace(/\n/g, " | ");
          this.logger.debug(`${pipeline.name} PSM ${psm}: confidence=${result.data.confidence}%, text="${textPreview}"`);
          
          // Prioritize results that contain bank/app keywords
          const hasBankKeyword = BANK_KEYWORD_RE.test(result.data.text);
          const textLongEnough = result.data.text.trim().length >= 20;

          // Skip tiny fragments from single-word/single-char PSM modes ("A", "x", "2")
          // unless they contain a bank keyword — they inflate confidence and
          // otherwise win over real full-text results.
          if (!textLongEnough && !hasBankKeyword) {
            continue;
          }

          const bestHasBankKeyword = bestResult
            ? BANK_KEYWORD_RE.test(bestResult.text)
            : false;

          if (
            !bestResult ||
            (hasBankKeyword && !bestHasBankKeyword) ||
            (hasBankKeyword === bestHasBankKeyword &&
              result.data.confidence > bestResult.confidence)
          ) {
            bestResult = {
              text: result.data.text,
              confidence: result.data.confidence,
            };
          }
        } catch (e) {
          this.logger.warn(`${pipeline.name} PSM ${psm} failed: ${e}`);
        }
      }
    }

    return bestResult ?? { text: "", confidence: 0 };
  }

  async terminate(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
    }
  }
}