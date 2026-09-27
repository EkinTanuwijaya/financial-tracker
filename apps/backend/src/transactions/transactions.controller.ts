import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { TransactionsService } from "./transactions.service";

@ApiTags("transactions")
@ApiBearerAuth()
@Controller("transactions")
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Post()
  @ApiOperation({ summary: "Create a new transaction" })
  async create(
    @Body()
    body: {
      walletId: string;
      categoryId: string;
      amount: number;
      currency?: string;
      description?: string;
      transactionDate: string;
      source?: string;
    },
    @Query("userId") userId: string,
  ) {
    return this.transactionsService.create(userId, {
      ...body,
      transactionDate: new Date(body.transactionDate),
    });
  }

  @Get()
  @ApiOperation({ summary: "Get all transactions for user" })
  async findAll(
    @Query("userId") userId: string,
    @Query("walletId") walletId?: string,
    @Query("categoryId") categoryId?: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
    @Query("limit") limit?: number,
    @Query("offset") offset?: number,
  ) {
    return this.transactionsService.findAll(userId, {
      walletId,
      categoryId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      limit,
      offset,
    });
  }

  @Get("summary")
  @ApiOperation({ summary: "Get transaction summary" })
  async getSummary(
    @Query("userId") userId: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
  ) {
    return this.transactionsService.getSummary(
      userId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  @Get(":id")
  @ApiOperation({ summary: "Get transaction by ID" })
  async findById(@Param("id") id: string, @Query("userId") userId: string) {
    return this.transactionsService.findById(id, userId);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update transaction" })
  async update(
    @Param("id") id: string,
    @Query("userId") userId: string,
    @Body()
    body: Partial<{
      walletId: string;
      categoryId: string;
      amount: number;
      currency: string;
      description: string;
      transactionDate: string;
    }>,
  ) {
    const data: any = { ...body };
    if (body.transactionDate) {
      data.transactionDate = new Date(body.transactionDate);
    }
    return this.transactionsService.update(id, userId, data);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete transaction" })
  async delete(@Param("id") id: string, @Query("userId") userId: string) {
    return this.transactionsService.delete(id, userId);
  }
}
