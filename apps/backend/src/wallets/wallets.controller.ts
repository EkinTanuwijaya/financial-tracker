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
import { WalletsService } from "./wallets.service";

@ApiTags("wallets")
@ApiBearerAuth()
@Controller("wallets")
export class WalletsController {
  constructor(private readonly walletsService: WalletsService) {}

  @Post()
  @ApiOperation({ summary: "Create a new wallet" })
  async create(
    @Body()
    body: { name: string; type: string; currency?: string; balance?: number },
    @Query("userId") userId: string,
  ) {
    return this.walletsService.create(userId, body);
  }

  @Get()
  @ApiOperation({ summary: "Get all wallets for user" })
  async findAll(@Query("userId") userId: string) {
    return this.walletsService.findAll(userId);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get wallet by ID" })
  async findById(@Param("id") id: string, @Query("userId") userId: string) {
    return this.walletsService.findById(id, userId);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update wallet" })
  async update(
    @Param("id") id: string,
    @Query("userId") userId: string,
    @Body()
    body: Partial<{
      name: string;
      type: string;
      currency: string;
      balance: number;
    }>,
  ) {
    return this.walletsService.update(id, userId, body);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete wallet" })
  async delete(@Param("id") id: string, @Query("userId") userId: string) {
    return this.walletsService.delete(id, userId);
  }
}
