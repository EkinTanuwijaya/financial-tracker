import { Module } from "@nestjs/common";
import { ReceiptsService } from "./receipts.service";
import { ReceiptsController } from "./receipts.controller";
import { OcrModule } from "../ocr/ocr.module";
import { AiModule } from "../ai/ai.module";

@Module({
  imports: [OcrModule, AiModule],
  controllers: [ReceiptsController],
  providers: [ReceiptsService],
  exports: [ReceiptsService],
})
export class ReceiptsModule {}
