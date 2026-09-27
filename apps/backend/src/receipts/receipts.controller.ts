import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { ReceiptsService } from "./receipts.service";

@ApiTags("receipts")
@ApiBearerAuth()
@Controller("receipts")
export class ReceiptsController {
  constructor(private readonly receiptsService: ReceiptsService) {}

  @Post()
  @ApiOperation({ summary: "Create a new receipt record" })
  async create(
    @Body() body: { fileUrl: string },
    @Query("userId") userId: string,
  ) {
    return this.receiptsService.create(userId, body);
  }

  @Get()
  @ApiOperation({ summary: "Get all receipts for user" })
  async findAll(@Query("userId") userId: string) {
    return this.receiptsService.findAll(userId);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get receipt by ID" })
  async findById(@Param("id") id: string, @Query("userId") userId: string) {
    return this.receiptsService.findById(id, userId);
  }

  @Patch(":id/status")
  @ApiOperation({ summary: "Update receipt processing status" })
  async updateStatus(
    @Param("id") id: string,
    @Body() body: { status: string; extractedData?: any; rawText?: string },
  ) {
    return this.receiptsService.updateProcessingStatus(
      id,
      body.status,
      body.extractedData,
      body.rawText,
    );
  }

  @Patch(":id/link-transaction")
  @ApiOperation({ summary: "Link receipt to transaction" })
  async linkTransaction(
    @Param("id") id: string,
    @Body() body: { transactionId: string },
  ) {
    return this.receiptsService.linkTransaction(id, body.transactionId);
  }
}
