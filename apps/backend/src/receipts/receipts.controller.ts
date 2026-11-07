import { NotFoundException } from "@nestjs/common";
import {
  CreateReceiptDto,
  ReceiptStatusDto,
  ReceiptLinkDto,
} from "../common/request.dto";
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  UseGuards,
  Request,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { ReceiptsService } from "./receipts.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";

@ApiTags("receipts")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("receipts")
export class ReceiptsController {
  constructor(private readonly receiptsService: ReceiptsService) {}

  @Post()
  @ApiOperation({ summary: "Create a new receipt record" })
  async create(@Body() body: CreateReceiptDto, @Request() req: any) {
    return this.receiptsService.create(req.user.id, body);
  }

  @Get()
  @ApiOperation({ summary: "Get all receipts for user" })
  async findAll(@Request() req: any) {
    return this.receiptsService.findAll(req.user.id);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get receipt by ID" })
  async findById(@Param("id") id: string, @Request() req: any) {
    const receipt = await this.receiptsService.findById(id, req.user.id);
    if (!receipt) throw new NotFoundException("Receipt not found");
    return receipt;
  }

  @Patch(":id/status")
  @ApiOperation({ summary: "Update receipt processing status" })
  async updateStatus(
    @Param("id") id: string,
    @Request() req: any,
    @Body() body: ReceiptStatusDto,
  ) {
    return this.receiptsService.updateProcessingStatus(
      id,
      body.status,
      body.extractedData,
      body.rawText,
      req.user.id,
    );
  }

  @Patch(":id/link-transaction")
  @ApiOperation({ summary: "Link receipt to transaction" })
  async linkTransaction(
    @Param("id") id: string,
    @Request() req: any,
    @Body() body: ReceiptLinkDto,
  ) {
    return this.receiptsService.linkTransaction(
      id,
      body.transactionId,
      req.user.id,
    );
  }
}
