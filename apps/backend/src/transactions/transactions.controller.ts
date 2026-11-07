import {
  CreateTransactionDto,
  UpdateTransactionDto,
  TransactionQueryDto,
} from "../common/request.dto";
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Request,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { TransactionsService } from "./transactions.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";

@ApiTags("transactions")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("transactions")
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Post()
  @ApiOperation({ summary: "Create a new transaction" })
  async create(
    @Body()
    body: CreateTransactionDto,
    @Request() req: any,
  ) {
    return this.transactionsService.create(req.user.id, {
      ...body,
      transactionDate: new Date(body.transactionDate),
    });
  }

  @Get()
  @ApiOperation({ summary: "Get all transactions for user" })
  async findAll(@Request() req: any, @Query() query: TransactionQueryDto) {
    return this.transactionsService.findAll(req.user.id, {
      ...query,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
    });
  }

  @Get("summary")
  @ApiOperation({ summary: "Get transaction summary" })
  async getSummary(@Request() req: any, @Query() query: TransactionQueryDto) {
    return this.transactionsService.getSummary(
      req.user.id,
      query.startDate ? new Date(query.startDate) : undefined,
      query.endDate ? new Date(query.endDate) : undefined,
    );
  }

  @Get(":id")
  @ApiOperation({ summary: "Get transaction by ID" })
  async findById(@Param("id") id: string, @Request() req: any) {
    return this.transactionsService.findById(id, req.user.id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update transaction" })
  async update(
    @Param("id") id: string,
    @Request() req: any,
    @Body()
    body: UpdateTransactionDto,
  ) {
    const data: any = { ...body };
    if (body.transactionDate) {
      data.transactionDate = new Date(body.transactionDate);
    }
    return this.transactionsService.update(id, req.user.id, data);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete transaction" })
  async delete(@Param("id") id: string, @Request() req: any) {
    return this.transactionsService.delete(id, req.user.id);
  }
}
