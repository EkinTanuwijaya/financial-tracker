import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);

  constructor(private readonly config: ConfigService) {}

  async recognize(imageBuffer: Buffer): Promise<{ text: string; confidence: number }> {
    const baseUrl = this.config.get<string>("OCR_BASE_URL") ?? "http://localhost:8000";
    const started = Date.now();
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/recognize`, {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream" },
      body: new Uint8Array(imageBuffer),
      signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok) {
      throw new Error(`PaddleOCR HTTP ${response.status}`);
    }
    const result = await response.json() as { text?: unknown; confidence?: unknown };
    if (
      typeof result.text !== "string" ||
      typeof result.confidence !== "number" ||
      !Number.isFinite(result.confidence) ||
      result.confidence < 0 || result.confidence > 100
    ) {
      throw new Error("Invalid PaddleOCR response");
    }
    this.logger.log(`PaddleOCR completed in ${Date.now() - started}ms (${result.text.length} characters)`);
    return { text: result.text, confidence: result.confidence };
  }
}
